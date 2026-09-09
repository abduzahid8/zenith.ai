import {
    buildSessionBlueprint,
    parseVerdict,
    isRewardedOutcome,
    buildRecallTask,
    normalizeOrigin,
    resolveExitRoute,
} from '../domain/sessions/sessionBlueprint';

describe('sessionBlueprint', () => {
    it('builds a review-only micro session for 5 minutes', () => {
        const bp = buildSessionBlueprint({ minutes: 5, taskTitle: 'Loops', lessonTitle: 'L1' });
        expect(bp.phases).toEqual(['understand', 'recall', 'complete']);
        expect(bp.countsAsFullCompletion).toBe(false);
        expect(bp.requiresValidation).toBe(false);
        expect(bp.maxRetries).toBe(0);
        expect(bp.learningObjective).toBe('Loops');
    });

    it('builds a standard session for 15 minutes', () => {
        const bp = buildSessionBlueprint({ minutes: 15, lessonTitle: 'L1' });
        expect(bp.phases).toEqual(['understand', 'recall', 'apply', 'complete']);
        expect(bp.countsAsFullCompletion).toBe(true);
        expect(bp.learningObjective).toBe('L1');
    });

    it('adds validation for deep sessions when the lesson has tests', () => {
        const bp = buildSessionBlueprint({ minutes: 30, lessonTitle: 'L1', hasTests: true });
        expect(bp.phases).toEqual(['understand', 'recall', 'apply', 'validate', 'complete']);
        expect(bp.requiresValidation).toBe(true);
        expect(bp.maxRetries).toBe(1);
    });

    it('omits the validate UI when the lesson has no tests', () => {
        const bp = buildSessionBlueprint({ minutes: 30, lessonTitle: 'L1', hasTests: false });
        expect(bp.phases).toEqual(['understand', 'recall', 'apply', 'complete']);
        expect(bp.requiresValidation).toBe(false);
    });

    it('grants a retry budget for mastery sessions (45+)', () => {
        const bp = buildSessionBlueprint({ minutes: 45, lessonTitle: 'L1', hasTests: true });
        expect(bp.maxRetries).toBe(2);
        expect(bp.countsAsFullCompletion).toBe(true);
    });

    it('locks review-only sessions out of progression without changing phases', () => {
        const bp = buildSessionBlueprint({ minutes: 30, lessonTitle: 'L1', hasTests: true, reviewOnly: true });
        expect(bp.phases).toEqual(['understand', 'recall', 'apply', 'validate', 'complete']);
        expect(bp.countsAsFullCompletion).toBe(false);
        expect(bp.requiresValidation).toBe(false);
    });

    it('a 5-minute and a 45-minute session are structurally different', () => {
        const micro = buildSessionBlueprint({ minutes: 5, lessonTitle: 'L1', hasTests: true });
        const mastery = buildSessionBlueprint({ minutes: 45, lessonTitle: 'L1', hasTests: true });
        expect(micro.phases).not.toEqual(mastery.phases);
        expect(micro.countsAsFullCompletion).toBe(false);
        expect(mastery.countsAsFullCompletion).toBe(true);
    });
});

describe('parseVerdict', () => {
    it('reads the grader emoji', () => {
        expect(parseVerdict('👍 Отлично!')).toBe('pass');
        expect(parseVerdict('  🤔 Частично')).toBe('partial');
        expect(parseVerdict('❌ Неверно')).toBe('fail');
    });

    it('falls back to unknown for free-form or missing feedback', () => {
        expect(parseVerdict('Good job, well done')).toBe('unknown');
        expect(parseVerdict('')).toBe('unknown');
        expect(parseVerdict(null)).toBe('unknown');
        expect(parseVerdict(undefined)).toBe('unknown');
    });

    it('reads the explicit [verdict:X] prefix on stored artifacts', () => {
        expect(parseVerdict('[verdict:pass] 👍 Отлично')).toBe('pass');
        expect(parseVerdict('[verdict:fail] whatever')).toBe('fail');
        expect(parseVerdict('[verdict:skipped] ...')).toBe('skipped');
        expect(parseVerdict('  [verdict:partial] 🤔')).toBe('partial');
    });
});

describe('isRewardedOutcome', () => {
    it('rewards evidence, never failure or skips', () => {
        expect(isRewardedOutcome('pass')).toBe(true);
        expect(isRewardedOutcome('partial')).toBe(true);
        expect(isRewardedOutcome('unknown')).toBe(true);
        expect(isRewardedOutcome('fail')).toBe(false);
        expect(isRewardedOutcome('skipped')).toBe(false);
    });
});

describe('buildRecallTask', () => {
    it('builds a localized free-text check without bank content', () => {
        const task = buildRecallTask((key) => `[${key}]`);
        expect(task.type).toBe('free_text');
        expect(task.prompt).toBe('[quick_recall_prompt]');
    });
});

describe('session origin routing', () => {
    it('normalizes known origins, migrates legacy ones, defaults safely', () => {
        expect(normalizeOrigin('your_day')).toBe('your_day');
        expect(normalizeOrigin('quick_session')).toBe('quick_session');
        expect(normalizeOrigin('certification_milestone')).toBe('certification_milestone');
        expect(normalizeOrigin('daily_task')).toBe('your_day');
        expect(normalizeOrigin('quick_discovery')).toBe('quick_session');
        expect(normalizeOrigin('main')).toBe('home_start');
        expect(normalizeOrigin('hacker')).toBe('home_start');
        expect(normalizeOrigin(null)).toBe('home_start');
    });

    it('returns to the entry context, never to certification', () => {
        expect(resolveExitRoute('your_day')).toBe('/(app)/weekly-plan');
        expect(resolveExitRoute('quick_session')).toBe('/(app)/');
        expect(resolveExitRoute('home_start')).toBe('/(app)/');
        expect(resolveExitRoute('certification_milestone')).toBe('/(app)/');
    });
});
