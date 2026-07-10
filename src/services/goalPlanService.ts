import { GoalDefinition, GoalSnapshot, PlanOfAttack, PlanStep, CommitmentRecord } from '../types/goals';
import aiService from './ai';

// ── Pure helpers (testable, no LLM / IO) ─────────────────

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Picks step index for today. Steps span the entire goal window — one tile
 * per ~2 days on average. If `now` is past the plan, clamps to last step
 * (goal done / over-achieved).
 */
export function pickTodayStepIndex(plan: PlanOfAttack, today: string, deadline: string): number {
  if (!plan.steps.length) return 0;
  const startMs = new Date(plan.generatedAt).getTime();
  const endMs = new Date(deadline).getTime();
  const nowMs = new Date(today).getTime();
  if (endMs <= startMs) return Math.max(0, plan.steps.length - 1);
  const t = (nowMs - startMs) / (endMs - startMs);
  const idx = Math.min(plan.steps.length - 1, Math.max(0, Math.floor(t * plan.steps.length)));
  return idx;
}

/**
 * Lightweight commitment parser.
 *
 * Goal: turn "I'll read 20 pages of Meditations today" into a structured
 * record so the UI can show it back tomorrow and detect follow-through. We
 * deliberately keep this rule-based (no LLM) so it's deterministic,
 * offline-friendly and *fast*: this is information the user already typed.
 *
 * Heuristics:
 *   1. Detect first verb to classify category.
 *   2. Strip filler ("i", "i'll", "today", "then") from start/end.
 *   3. Extract minutes ("20 min", "half hour", "1 hour").
 *   4. Extract number+unit counts ("20 pages", "1 chapter") and re-phrase
 *      into a clean action noun phrase.
 */
export function parseCommitment(raw: string): CommitmentRecord {
  const text = raw.trim();
  const lower = text.toLowerCase();
  const today = getTodayString();

  // ── minutes ──
  let estimatedMinutes: number | undefined;
  const minMatch = lower.match(/(\d+)\s*(?:min|minute|mins)\b/);
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/);
  const halfHour = /\bhalf\s*(?:an?\s*)?hour\b/.test(lower);
  if (minMatch) estimatedMinutes = parseInt(minMatch[1], 10);
  else if (hourMatch) estimatedMinutes = Math.round(parseFloat(hourMatch[1]) * 60);
  else if (halfHour) estimatedMinutes = 30;

  // ── count ──
  let action = text.replace(/^(i'?ll|i am going to|gonna|let me|planning to|want to|need to|must|should|today[,\s]+?|then[,\s]+?)/i, '').trim();
  action = action.replace(/[.\s]+$/, '');
  if (!action) action = text;
  action = action.charAt(0).toUpperCase() + action.slice(1);

  // Identify the first *meaningful* verb (skipping fillers like "I", "I'll",
  // "let's" so that "I'll read 20 pages" categorizes as reflect, not "other").
  const fillerStripped = lower
    .replace(/^(i'?ll|i'?m|i am|i'?ve|let'?s|gonna|going to|want to|need to|must|should|planning to|just|then)[,\s]+/i, '')
    .trim();
  const firstVerb = (fillerStripped.match(/^[a-z]+/) || [''])[0];
  const category: CommitmentRecord['category'] =
    /^(read|skim|review|study|memorize|highlight|summarise|summarize|take notes|annotate)/.test(firstVerb) ? 'reflect' :
    /^(log|record|count|track|check|enter|note|mark)/.test(firstVerb) ? 'log_units' :
    /^(plan|write|outline|map|design|set|schedule|organize|organise|decompose|update|edit)/.test(firstVerb) ? 'plan' :
    /^(do|practice|practise|complete|finish|build|create|ship|run|work|send|call|email|dm|reach|contact|outreach|find|get|pitch|launch|publish|post|write|solve|drill|play|rehearse|crash|grind)/.test(firstVerb) ? 'do_work' :
    'other';

  // Strip lingering trailing time phrases (we surface `estimatedMinutes` separately)
  const cleaned = action.replace(/\bfor\s+(?:\d+\s*(?:min|minute|hour|hr|h)|half\s+(?:an?\s*)?hour)\b.*$/i, '')
    .replace(/\b(?:in\s+)?(?:\d+\s*(?:min|minute|hour|hr|h)|half\s+(?:an?\s*)?hour)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[.\s]+$/, '')
    .trim();

  return {
    text,
    date: today,
    action: cleaned || text,
    category,
    estimatedMinutes,
  };
}

/**
 * Score yesterday's commitment against today's first check-in.
 * Returns true if honored (i.e. user logged >=1 action today after committing).
 */
export function wasCommitmentHonored(todayHistory: CommitmentRecord | undefined, hasCheckinToday: boolean): boolean | undefined {
  if (!todayHistory && !hasCheckinToday) return undefined;
  return hasCheckinToday;
}

/**
 * Build a heuristic PlanOfAttack — no LLM. Used as a synchronous fallback
 * so the UI has *something* goal-aware the instant the goal is saved, before
 * the LLM enriches it.
 *
 * Pattern: scale the goal into N tiles where N ≈ number of days in window.
 * Each tile says what concrete thing the user should do that day.
 */
export function buildHeuristicPlan(goal: GoalDefinition): PlanOfAttack {
  const today = getTodayString();
  const startMs = new Date(goal.startDate || today).getTime();
  const endMs = new Date(goal.deadline).getTime();
  const totalDays = Math.max(1, Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)));
  const isSkill = goal.category === 'skill';

  // Pace-aware: aim for one tile per ~2 days so the user has uninterrupted momentum
  const tileCount = Math.max(5, Math.min(40, Math.round(totalDays / 2)));
  const totalToCover = Math.max(1, goal.target - goal.startingValue);
  const perStepUnits = Math.max(1, Math.ceil(totalToCover / tileCount));

  const verbs = isSkill
    ? ['Study', 'Practice', 'Drill', 'Apply', 'Refine', 'Test yourself', 'Push past', 'Lock in']
    : ['Reach', 'Log', 'Lock in', 'Progress', 'Advance', 'Move', 'Capture', 'Hit'];

  const steps: PlanStep[] = [];
  for (let i = 0; i < tileCount; i++) {
    const dayNum = i + 1;
    const remaining = Math.max(0, totalToCover - i * perStepUnits);
    const noun = goal.unitLabel || (isSkill ? 'pts' : 'units');
    const verb = verbs[i % verbs.length];
    const label = i === 0
      ? `Start — first move toward "${goal.description.slice(0, 60)}"`
      : `${verb} ~${Math.min(perStepUnits, remaining + perStepUnits)} ${noun} (target ${Math.min(goal.target, goal.startingValue + (i + 1) * perStepUnits)})`;
    const detail = i === 0
      ? `Commit to one small concrete step you can finish today that moves "${goal.description}" forward.`
      : `Day ${dayNum}: take the next measurable chunk of progress (~${perStepUnits} ${noun}). Log it.`;
    steps.push({
      index: i,
      day: dayNum,
      label,
      detail,
      estimatedMinutes: isSkill ? 30 : 20,
    });
  }

  return {
    goalId: goal.id,
    generatedAt: new Date().toISOString(),
    source: 'heuristic',
    summary: `${tileCount}-step plan spaced over ${totalDays} days (~${perStepUnits} ${goal.unitLabel || (isSkill ? 'pts' : 'units')}/2 days).`,
    steps,
    currentStepIndex: 0,
  };
}

/**
 * Build an LLM-driven, goal-aware plan. Falls back to heuristic if AI fails.
 *
 * The LLM is given the user's free-form goal description, target, unit, and
 * deadline so it can suggest a step shape that fits *this specific* goal
 * (rather than hobby-keyed generic theory).
 */
export async function generatePlanOfAttack(goal: GoalDefinition): Promise<PlanOfAttack> {
  const fallback = buildHeuristicPlan(goal);

  try {
    const raw = await (aiService as any).generatePlanOfAttack({
      description: goal.description,
      category: goal.category,
      target: goal.target,
      startingValue: goal.startingValue,
      unit: goal.unitLabel || 'units',
      deadline: goal.deadline,
      startDate: goal.startDate,
    });

    const parsed = safeParsePlan(raw, fallback);
    if (!parsed) return fallback;

    return {
      ...parsed,
      goalId: goal.id,
      generatedAt: new Date().toISOString(),
      source: 'llm',
    };
  } catch {
    return fallback;
  }
}

function safeParsePlan(raw: unknown, fallback: PlanOfAttack): PlanOfAttack | null {
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw.replace(/```json|```/g, '').trim()) : raw;
    if (!obj || typeof obj !== 'object') return null;
    const summary = typeof (obj as any).summary === 'string' ? (obj as any).summary : fallback.summary;
    const rawSteps = Array.isArray((obj as any).steps) ? (obj as any).steps : [];
    if (!rawSteps.length) return null;

    const steps: PlanStep[] = rawSteps
      .filter((s: any) => s && (s.label || s.detail))
      .slice(0, 30)
      .map((s: any, i: number) => ({
        index: i,
        day: typeof s.day === 'number' ? s.day : i + 1,
        label: String(s.label || s.detail || `Step ${i + 1}`).slice(0, 120),
        detail: String(s.detail || s.label || '').slice(0, 280),
        estimatedMinutes: typeof s.estimatedMinutes === 'number'
          ? Math.max(5, Math.min(120, s.estimatedMinutes))
          : 20,
      }));
    if (!steps.length) return null;
    return {
      goalId: fallback.goalId,
      generatedAt: fallback.generatedAt,
      source: fallback.source,
      summary,
      steps,
      currentStepIndex: 0,
    };
  } catch {
    return null;
  }
}

// ── Tile derivation for "Today's Plan" card ───────────────

export interface DerivedDailyTile {
  step?: PlanStep;
  index: number;          // step index, or -1 if none
  total: number;          // total steps in plan
  summary: string;        // one-line plan summary
  isLast: boolean;
  isAhead: boolean;       // currentValue implies we'd be ahead of plan pace
}

export function deriveDailyTile(plan: PlanOfAttack | undefined, goal: GoalDefinition, currentValue: number, totalDays: number): DerivedDailyTile | undefined {
  if (!plan || !plan.steps.length) return undefined;
  const today = getTodayString();
  const idx = pickTodayStepIndex(plan, today, goal.deadline);
  const step = plan.steps[idx];
  const totalToCover = Math.max(1, goal.target - goal.startingValue);
  const totalElapsedDays = Math.max(1, totalDays);
  const expectedValue = goal.startingValue + Math.round((idx + 1) / plan.steps.length * totalToCover);
  const isAhead = currentValue >= expectedValue;
  return {
    step,
    index: idx,
    total: plan.steps.length,
    summary: plan.summary,
    isLast: idx >= plan.steps.length - 1,
    isAhead,
  };
}
