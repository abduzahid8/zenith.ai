import { GoalSnapshot, DailyGoalContent, HelpMode, PlanOfAttack } from '../types/goals';
import aiService from './ai';
import { deriveDailyTile, buildHeuristicPlan, parseCommitment } from './goalPlanService';
import { getRecommendations, recommendGenericTools } from '../data/toolRecommendations';
import { DailyFocusResult } from './dailyFocusEngine';

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

// ── Static fallback content (legacy generic tiles) ────────
//
// Kept for backwards compatibility with goals created before the
// Plan-of-Attack engine existed. New goals render goal-aware tiles.

type FallbackEntry = {
  learnTitle: string;
  learnBody: string;
  doTitle: string;
  doInstructions: string;
  minutes: number;
};

const FALLBACK_BY_MODE: Record<HelpMode, { default: FallbackEntry; skill?: Partial<FallbackEntry>; execution?: Partial<FallbackEntry> }> = {
  milestone: {
    default: {
      learnTitle: 'Start with the smallest real step',
      learnBody: 'Big goals stall when the first move is vague. Pick one concrete, doable action for today rather than trying to plan the whole path.',
      doTitle: 'Write down your first 3 steps',
      doInstructions: 'List the three smallest actions that would move this goal forward, then do the first one now.',
      minutes: 15,
    },
    execution: {
      doInstructions: 'Pick one metric for this goal and log your first data point today — even if it is zero.',
    },
  },
  tactical: {
    default: {
      learnTitle: 'Small daily reps beat big irregular pushes',
      learnBody: 'Consistency compounds faster than intensity. A little progress today, logged, is worth more than a big burst you can\'t repeat.',
      doTitle: 'Log today\'s progress',
      doInstructions: 'Do one unit of real work toward your goal, then check it in below.',
      minutes: 20,
    },
    skill: {
      doInstructions: 'Do one focused practice session on your skill today, then log it below. Quality over duration.',
    },
    execution: {
      doInstructions: 'Do one real batch of work on your goal, then check in your count below.',
    },
  },
  tools: {
    default: {
      learnTitle: 'The right tool removes most of the friction',
      learnBody: 'When pace slips, the fix is usually process, not willpower. A better tool or shortcut often unblocks more than trying harder.',
      doTitle: 'Try one recommended tool',
      doInstructions: 'Pick the suggested tool below, spend a few minutes setting it up, and use it for today\'s progress.',
      minutes: 20,
    },
  },
  troubleshoot: {
    default: {
      learnTitle: 'Naming the blocker is half of solving it',
      learnBody: 'Vague stuckness feels bigger than it is. Being specific about what\'s blocking you usually reveals a small, doable next step.',
      doTitle: 'Do the smallest unblocking action',
      doInstructions: 'Pick the tiniest possible version of the blocked task and finish just that piece today.',
      minutes: 15,
    },
    execution: {
      doInstructions: 'Identify one external factor slowing you down and test one fix for it right now.',
    },
  },
};

function getFallbackEntry(mode: HelpMode, category: 'skill' | 'execution'): FallbackEntry {
  const f = FALLBACK_BY_MODE[mode];
  const base = f.default;
  const overrides = category === 'skill' ? f.skill : f.execution;
  if (!overrides) return base;
  return { ...base, ...overrides };
}

export function getFallbackContent(snapshot: GoalSnapshot, focus?: DailyFocusResult): DailyGoalContent {
  const mode = snapshot.progress.currentMode;
  const category = snapshot.definition.category;
  const f = getFallbackEntry(mode, category);
  const tile = snapshot.progress.planOfAttack
    ? deriveDailyTile(
        snapshot.progress.planOfAttack,
        snapshot.definition,
        snapshot.progress.currentValue,
        snapshot.daysRemaining
      )
    : undefined;
  return {
    goalId: snapshot.definition.id,
    date: getTodayString(),
    mode,
    learn: {
      title: tile?.step?.label || f.learnTitle,
      body: tile?.step?.detail
        ? `${tile.step.detail} (${tile.summary})`
        : f.learnBody,
    },
    doNow: {
      title: tile?.step?.label || f.doTitle,
      instructions: tile?.step?.detail
        ? `Take this step from your plan: ${tile.step.detail}`
        : f.doInstructions,
      estimatedMinutes: tile?.step?.estimatedMinutes || f.minutes,
      toolRecommendation: mode === 'tools' ? snapshot.progress.lastBottleneck?.recommendations?.[0] : undefined,
    },
    isFallback: true,
    focusReason: focus?.reason,
  };
}

// ── Tool recommendations (now LLM-aware with curated fallback) ──

/**
 * Get the best tool recommendation for a goal's bottleneck.
 * Tries: explicit static pattern → LLM with allowlisted generic catalog
 * → purely-local generic catalog. Always returns ≤ 3 picks or null.
 */
export async function getBottleneckTools(input: {
  goalDescription: string;
  bottleneck: string;
}): Promise<{ bottleneck: string; recommendations: Array<{ name: string; reason: string; url?: string; cost?: string; setup?: string }> } | null> {
  // 1) Curated static patterns dominate when they match
  const staticPick = getRecommendations(input.goalDescription);
  if (staticPick) {
    return {
      bottleneck: staticPick.bottleneck,
      recommendations: staticPick.recommendations.slice(0, 3).map(r => ({
        name: r.name,
        reason: r.reason,
        url: r.url,
        cost: r.cost,
        setup: r.setup,
      })),
    };
  }

  // 2) Try LLM, constrained to GENERIC_TOOL_CATALOG
  try {
    const allowed = recommendGenericTools(input.goalDescription, 6);
    const picks = await aiService.recommendToolsForBottleneck({
      goalDescription: input.goalDescription,
      bottleneck: input.bottleneck,
      allowedTools: allowed,
    });
    if (picks && picks.length > 0) {
      return { bottleneck: input.bottleneck, recommendations: picks.slice(0, 3) };
    }
  } catch {
    // fall through
  }

  // 3) Pure local fallback (rule-based on the allowlist)
  const fallback = recommendGenericTools(input.goalDescription, 3);
  if (fallback.length > 0) {
    return { bottleneck: input.bottleneck, recommendations: fallback };
  }
  return null;
}

// ── Prompt construction ──────────────────────────────────

function buildGoalAwarePrompt(snapshot: GoalSnapshot, focus?: DailyFocusResult): string {
  const { definition, progress } = snapshot;
  const isSkill = definition.category === 'skill';

  const yesterdayStr = getYesterdayString();
  const yesterdayContent = progress.dailyContent?.[yesterdayStr];
  const yesterdayBlock = yesterdayContent && !yesterdayContent.isFallback && !yesterdayContent.isAIGenerated
    ? ''
    : yesterdayContent
      ? `\nYesterday they saw: "${yesterdayContent.learn.title}" / "${yesterdayContent.doNow.title}"${yesterdayContent.completedAt ? ' (completed)' : ' (not completed)'}. Build on that — do not repeat the same concept.`
      : '';

  const tile = snapshot.progress.planOfAttack
    ? deriveDailyTile(
        snapshot.progress.planOfAttack,
        snapshot.definition,
        snapshot.progress.currentValue,
        snapshot.daysRemaining
      )
    : undefined;

  const planBlock = tile && tile.step
    ? `\nThis goal has a Plan-of-Attack: ${snapshot.progress.planOfAttack?.summary}\nToday is step ${tile.index + 1} of ${tile.total}: "${tile.step.label}" — ${tile.step.detail}\nYour job is to teach ONE concept that makes this step land, plus suggest ONE concrete action that fits cleanly into this tile's ${tile.step.estimatedMinutes} min budget.`
    : `\nNo Plan-of-Attack yet for this goal — generate fresh advice that advances "step ${(snapshot.progress.dailyActions || 0) + 1}".`;

  const commitmentBlock = progress.commitment
    ? `\nToday the user committed to: "${progress.commitment.action}". Acknowledge that commitment and design today's "do" so it can fulfill it.`
    : '';

  const followUpBlock = progress.yesterdayCommitment
    ? `\nYesterday they committed to: "${progress.yesterdayCommitment.action}" — they ${progress.yesterdayCommitmentHonored ? 'honored it' : 'have NOT yet logged follow-through'}. ${progress.yesterdayCommitmentHonored ? 'Reinforce the win.' : 'Gently nudge follow-through now.'}`
    : '';

  const contextByMode: Record<HelpMode, string> = {
    milestone: `The user is still planning their goal "${definition.description}" and hasn't started executing yet.
Give them ONE concrete concept worth understanding before they start, and ONE small first action they can do today.`,
    tactical: `The user is in daily-execution on goal "${definition.description}" (target: ${definition.target} ${definition.unitLabel || 'units'}; ${snapshot.unitsRemaining} ${definition.unitLabel || 'units'} remain; pace needed is ~${snapshot.dailyRateNeeded}/day, currently ${snapshot.projectedCompletion}).${isSkill ? ' Their skill rating needs to climb to ' + (definition.targetDifficulty ?? definition.target) + ' pts.' : ''}`,
    tools: `User is behind pace on "${definition.description}".${progress.lastBottleneck ? ` Bottleneck: "${progress.lastBottleneck.bottleneck}" (severity: ${progress.lastBottleneck.severity}).` : ''} Recommend a specific approach and frame today's action around applying it.`,
    troubleshoot: `User is blocked on "${definition.description}": "${progress.lastBottleneck?.bottleneck ?? 'unspecified'}". Address that directly with a reframe, plus a tiny unblocking action.`,
  };

  return `You are a coach helping someone reach a personal goal.
${contextByMode[progress.currentMode]}
${planBlock}${commitmentBlock}${followUpBlock}${yesterdayBlock}

${focus && focus.focus !== 'steady'
  ? `\nToday's focus: "${focus.reason}". Shape the learn/do pair around this purpose — do NOT ignore it in favour of generic advice.`
  : ''}

Respond ONLY with JSON (no markdown, no preamble):
{"learnTitle": "...", "learnBody": "... (2-4 sentences)", "doTitle": "...", "doInstructions": "... (1-3 sentences, concrete and specific)", "estimatedMinutes": <number>}`;
}

function parseResponse(raw: string): { learnTitle: string; learnBody: string; doTitle: string; doInstructions: string; estimatedMinutes: number } | null {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.learnTitle || !parsed.doTitle) return null;
    return {
      learnTitle: String(parsed.learnTitle).slice(0, 120),
      learnBody: String(parsed.learnBody ?? '').slice(0, 480),
      doTitle: String(parsed.doTitle).slice(0, 120),
      doInstructions: String(parsed.doInstructions ?? '').slice(0, 280),
      estimatedMinutes: Number(parsed.estimatedMinutes) || 15,
    };
  } catch {
    return null;
  }
}

/**
 * Generates today's learn + do-now pair from the user's *specific* goal.
 * The Plan-of-Attack is preferred when present; otherwise uses legacy
 * mode-aware prompt. Never throws — returns null on AI failure so the
 * caller keeps its fallback.
 */
export async function generateDailyContent(snapshot: GoalSnapshot, focus?: DailyFocusResult): Promise<DailyGoalContent | null> {
  try {
    const prompt = buildGoalAwarePrompt(snapshot, focus);
    const raw = await (aiService as any).generateDailyCoaching(prompt);
    const parsed = parseResponse(raw);
    if (!parsed) return null;

    const mode = snapshot.progress.currentMode;
    return {
      goalId: snapshot.definition.id,
      date: getTodayString(),
      mode,
      learn: { title: parsed.learnTitle, body: parsed.learnBody },
      doNow: {
        title: parsed.doTitle,
        instructions: parsed.doInstructions,
        estimatedMinutes: parsed.estimatedMinutes,
        toolRecommendation: mode === 'tools' ? snapshot.progress.lastBottleneck?.recommendations?.[0] : undefined,
      },
      isFallback: false,
      isAIGenerated: true,
      focusReason: focus?.reason,
    };
  } catch {
    return null;
  }
}

// ── Helpful exports for components ───────────────────────

export { parseCommitment };
