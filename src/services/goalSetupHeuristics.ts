import { GoalCategory } from '../types/goals';

// ── Keyword lists ──────────────────────────────────────────

const SKILL_KEYWORDS = [
  'reach', 'improve', 'get better', 'learn', 'master',
  'rating', 'rank', 'level', 'score', 'speed', 'accuracy',
  'be able to', 'complete course', 'finish course', 'certification',
  'run.*km', '5k', '10k', 'marathon',
];

const EXECUTION_KEYWORDS = [
  'find', 'get.*leads', 'get.*clients', 'launch', 'build',
  'create', 'write.*posts', 'collect', 'landing page',
  'influencers', 'outreach', 'signups', 'sales',
];

const SKILL_HOBBIES = ['chess', 'python', 'coding', 'reading'];

// ── Patterns ────────────────────────────────────────────────

export const COUNT_PATTERN = /(\d+)\s*(influencers|leads|clients|posts|pages|sales|calls|emails|deals|signups|accounts|dms|messages|projects|articles|videos|episodes|guests|reviews|downloads|users|customers|members|subscribers|followers|views|hours|meetings|apps|features|commits|prs|issues)/i;

export const COUNT_ACTION_PATTERN = /(find|get|invite|collect|reach|earn|write|create|build|launch|make|sell|close|send|publish|record|hire|interview|review|test|ship|deploy)\s+(\d+)/i;

// ── Pure functions ──────────────────────────────────────────

export function guessCategory(description: string, hobbyId: string | null): GoalCategory {
  const lower = description.toLowerCase();
  if (SKILL_HOBBIES.includes(hobbyId ?? '')) return 'skill';
  for (const kw of SKILL_KEYWORDS) {
    if (new RegExp(kw, 'i').test(lower)) return 'skill';
  }
  for (const kw of EXECUTION_KEYWORDS) {
    if (new RegExp(kw, 'i').test(lower)) return 'execution';
  }

  // Broader heuristic: if description has a number + concrete noun via
  // extractCount, default to execution instead of skill, since a concrete
  // count is a stronger signal than either keyword list.
  const extracted = extractCount(description);
  if (extracted) return 'execution';

  return 'skill';
}

export function extractCount(description: string): { count: number; unit: string } | null {
  const actionMatch = description.match(COUNT_ACTION_PATTERN);
  if (actionMatch) {
    // After an action-pattern match, also run COUNT_PATTERN to find the
    // real unit if present (e.g. "find 200 influencers" -> unit: "influencers"
    // instead of hardcoded "units").
    const countMatch = description.match(COUNT_PATTERN);
    const unit = countMatch ? countMatch[2].toLowerCase() : 'units';
    return { count: parseInt(actionMatch[2], 10), unit };
  }
  const countMatch = description.match(COUNT_PATTERN);
  if (countMatch) {
    return { count: parseInt(countMatch[1], 10), unit: countMatch[2].toLowerCase() };
  }
  return null;
}
