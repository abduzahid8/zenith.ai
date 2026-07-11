import { GoalSnapshot, DailyGoalContent } from '../types/goals';

export interface CoachTool {
  id: string;
  label: string;
  emoji: string;
  description: string;
  intent: 'open_in_app' | 'open_external' | 'log_action' | 'plan_change' | 'deep_research';
  /**
   * Resolve to a target route/URL given the user's goal + today's content.
   * Returning null means "no relevant tool for this context".
   * The goal-aware filter keeps the chip list short — never floods the user
   * with options that don't apply to their hobby.
   */
  resolve: (ctx: CoachToolContext) => CoachToolAction | null;
}

export interface CoachToolAction {
  label: string;
  emoji: string;
  intent: CoachTool['intent'];
  /** App internal route — used for router.push */
  route?: string;
  /** External URL — opened via Linking.openURL */
  url?: string;
  /** Side-effect payload description, e.g. for log_action */
  payload?: Record<string, any>;
  reason: string;
}

export interface CoachToolContext {
  snapshot: GoalSnapshot;
  content: DailyGoalContent | null;
  /** Free-form user intent (e.g. "help me", "swap task") */
  userIntent?: 'stuck' | 'easier' | 'puzzle' | 'research' | 'log' | null;
}

/**
 * Registry of "things the coach can do" — Folk-style agent capabilities.
 * Each tool is a tuple of static affordance + dynamic resolution so the
 * coach bubble can offer chips that actually open / act on something.
 */
export const COACH_TOOLS: CoachTool[] = [
  {
    id: 'launch_timer',
    label: 'Open 15-min timer',
    emoji: '⏱',
    description: 'Drop into a focused session using today\'s tile.',
    intent: 'open_in_app',
    resolve: ({ snapshot }) => ({
      label: 'Start 15-min timer',
      emoji: '⏱',
      intent: 'open_in_app',
      route: `/session-timer?goalId=${snapshot.definition.id}`,
      reason: 'Lock in a focused block for today\'s task.',
    }),
  },
  {
    id: 'open_puzzle',
    label: 'Today\'s chess puzzle',
    emoji: '♟️',
    description: 'One puzzle tuned to your level.',
    intent: 'open_in_app',
    resolve: ({ snapshot }) => {
      if (snapshot.definition.hobby !== 'chess') return null;
      return {
        label: 'Solve today\'s puzzle',
        emoji: '♟️',
        intent: 'open_in_app',
        route: `/session-timer?goalId=${snapshot.definition.id}&intent=puzzle`,
        reason: '15 min, 1 move, instant feedback.',
      };
    },
  },
  {
    id: 'difficult_puzzle',
    label: 'Hard-mode puzzle',
    emoji: '🔥',
    description: 'Step up to challenge mode if today feels easy.',
    intent: 'open_in_app',
    resolve: ({ snapshot, userIntent }) => {
      if (snapshot.definition.hobby !== 'chess') return null;
      for (const cp of ['chess'] as const) {} // suppress unused
      if (userIntent !== 'easier') return null;
      return {
        label: 'Push for a harder puzzle',
        emoji: '🔥',
        intent: 'open_in_app',
        route: `/session-timer?goalId=${snapshot.definition.id}&intent=puzzle&hard=1`,
        reason: 'Stretch today if today feels light.',
      };
    },
  },
  {
    id: 'reading_drill',
    label: 'Reading drill',
    emoji: '📖',
    description: 'Drop into a guided reading session.',
    intent: 'open_in_app',
    resolve: ({ snapshot }) => {
      if (snapshot.definition.hobby !== 'reading') return null;
      return {
        label: 'Start reading drill',
        emoji: '📖',
        intent: 'open_in_app',
        route: `/session-timer?goalId=${snapshot.definition.id}&intent=reading`,
        reason: 'A guided block over today\'s passage.',
      };
    },
  },
  {
    id: 'code_run',
    label: 'Run today\'s code',
    emoji: '▶',
    description: 'Open the timer + code-runner for coding hobby.',
    intent: 'open_in_app',
    resolve: ({ snapshot }) => {
      const h = snapshot.definition.hobby;
      if (h !== 'coding' && h !== 'python') return null;
      return {
        label: 'Open code-runner',
        emoji: '▶',
        intent: 'open_in_app',
        route: `/session-timer?goalId=${snapshot.definition.id}&intent=code`,
        reason: 'Spin up the editor and timer together.',
      };
    },
  },
  {
    id: 'research',
    label: 'Research for me',
    emoji: '🔍',
    description: 'Have the coach pull in articles/videos on today\'s concept.',
    intent: 'deep_research',
    resolve: ({ snapshot, content, userIntent }) => {
      if (!content?.learn?.title) return null;
      // Only surface when user expresses "stuck" or "research" or when
      // the tile is an unfamiliar concept
      const stuckContext = userIntent === 'stuck' || userIntent === 'research';
      const unfamiliar = (content.learn.body || '').length > 240;
      if (!stuckContext && !unfamiliar) return null;
      const q = encodeURIComponent(`${content.learn.title} ${snapshot.definition.description}`);
      return {
        label: 'Pull 3 quick reads',
        emoji: '🔍',
        intent: 'deep_research',
        url: `https://www.google.com/search?q=${q}&tbm=nws`,
        reason: 'Catch up fast — short reads only.',
      };
    },
  },
  {
    id: 'swap_task',
    label: 'Swap today\'s task',
    emoji: '🔄',
    description: 'Pick a different action for today.',
    intent: 'plan_change',
    resolve: () => ({
      label: 'Swap with an easier task',
      emoji: '🔄',
      intent: 'plan_change',
      route: '/AICoach',
      reason: 'Coach will suggest a smaller version.',
    }),
  },
];

export function getCoachToolsForContext(ctx: CoachToolContext, max = 4): CoachToolAction[] {
  const actions: CoachToolAction[] = [];
  for (const tool of COACH_TOOLS) {
    const resolved = tool.resolve(ctx);
    if (resolved) {
      actions.push(resolved);
      if (actions.length >= max) break;
    }
  }
  return actions;
}

/**
 * Maps quick-reply chip intent to a coach tool action set, when user taps
 * a chip from the chat. This is what the user actually sees Folk doing —
 * type → instant action, no friction.
 */
export function routeQuickReplyToTool(
  replyId: 'did_it' | 'stuck' | 'swap_task' | 'research' | 'puzzle',
  ctx: CoachToolContext,
): CoachToolAction | null {
  switch (replyId) {
    case 'did_it':
      return COACH_TOOLS.find(t => t.id === 'launch_timer')?.resolve(ctx) ?? null;
    case 'stuck':
      return (
        COACH_TOOLS.find(t => t.id === 'research')?.resolve({ ...ctx, userIntent: 'stuck' }) ??
        COACH_TOOLS.find(t => t.id === 'swap_task')?.resolve(ctx) ??
        null
      );
    case 'swap_task':
      return COACH_TOOLS.find(t => t.id === 'swap_task')?.resolve(ctx) ?? null;
    case 'research':
      return COACH_TOOLS.find(t => t.id === 'research')?.resolve({ ...ctx, userIntent: 'research' }) ?? null;
    case 'puzzle': {
      const puzzleTool = COACH_TOOLS.find(t => t.id === 'open_puzzle')?.resolve(ctx);
      if (puzzleTool) return puzzleTool;
      return COACH_TOOLS.find(t => t.id === 'difficult_puzzle')?.resolve({ ...ctx, userIntent: 'easier' }) ?? null;
    }
  }
}
