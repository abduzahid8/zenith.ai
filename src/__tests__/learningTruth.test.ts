/**
 * Phase 3A learning truth — domain invariants (§29).
 * Central policy, required-card evaluation, once-only progression,
 * append-only events. Goal/certificate systems stay separate.
 */
import { buildSessionBlueprint } from '../domain/sessions/sessionBlueprint';
import {
    canCompleteStructuredTask,
    evaluateSession,
    evidenceValueOf,
    isRewardingEvaluation,
    isVerifiedOutcome,
} from '../domain/sessions/outcomePolicy';
import {
    buildAttemptEvent,
    buildEventId,
    mapLearningTarget,
    sourceFor,
    strengthFor,
} from '../domain/sessions/learningEvents';
import { buildResultData } from '../domain/sessions/learningCards';
import { applySessionProgression, recordAttemptArtifact } from '../services/sessionStepEffects';
import {
    __resetLearningEventsForTests,
    appendLearningEvent,
    appendLearningEvents,
    eventsByProgram,
    eventsBySession,
    learningEventCount,
} from '../services/learningEventRepository';
import type { LearningCard } from '../domain/sessions/learningCards';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

const goalCalls = { recordDailyAction: 0, adjustDifficulty: 0 };
const gameCalls = { advanceDay: 0, incrementSessionsCompleted: 0, saveArtifact: 0, markStepComplete: 0, recordChessSolve: 0 };

jest.mock('../store/goalStore', () => ({
    useGoalStore: {
        getState: () => ({
            recordDailyAction: () => { goalCalls.recordDailyAction++; },
            adjustDifficulty: () => { goalCalls.adjustDifficulty++; },
        }),
    },
}));

jest.mock('../store/gamificationStore', () => ({
    useGamificationStore: {
        getState: () => ({
            markStepComplete: () => { gameCalls.markStepComplete++; },
            saveArtifact: () => { gameCalls.saveArtifact++; return 'artifact_1'; },
            advanceDay: () => { gameCalls.advanceDay++; },
            incrementSessionsCompleted: () => { gameCalls.incrementSessionsCompleted++; },
            recordChessSolve: () => { gameCalls.recordChessSolve++; },
        }),
    },
}));

const resetCalls = () => {
    goalCalls.recordDailyAction = 0;
    goalCalls.adjustDifficulty = 0;
    gameCalls.advanceDay = 0;
    gameCalls.incrementSessionsCompleted = 0;
    gameCalls.saveArtifact = 0;
    gameCalls.markStepComplete = 0;
    gameCalls.recordChessSolve = 0;
};

const reqCard = (id: string, type: 'recall' | 'apply' | 'challenge' = 'recall'): LearningCard => ({
    id,
    type,
    phase: type === 'recall' ? 'recall' : type === 'apply' ? 'apply' : 'validate',
    order: 0,
    required: true,
});

const testLesson: any = { id: 'python_d15', hobby: 'python', learn: { title: 'Functions' } };

describe('1-5 — central outcome values', () => {
    it('pass > partial > fail/unknown/skipped, failures are zero', () => {
        expect(evidenceValueOf('pass')).toBe(1.0);
        expect(evidenceValueOf('partial')).toBe(0.5);
        expect(evidenceValueOf('fail')).toBe(0);
        expect(evidenceValueOf('unknown')).toBe(0);
        expect(evidenceValueOf('skipped')).toBe(0);
        expect(evidenceValueOf(undefined)).toBe(0);
    });

    it('verified means PASS only', () => {
        expect(isVerifiedOutcome('pass')).toBe(true);
        expect(isVerifiedOutcome('partial')).toBe(false);
        expect(isVerifiedOutcome('fail')).toBe(false);
        expect(isVerifiedOutcome('unknown')).toBe(false);
    });
});

describe('6-9 — task completion policy', () => {
    const strict = buildSessionBlueprint({ minutes: 30, lessonTitle: 'L', hasTests: true });
    const loose = buildSessionBlueprint({ minutes: 15, lessonTitle: 'L' });

    it('unknown/skipped/fail can never complete', () => {
        for (const o of ['unknown', 'skipped', 'fail'] as const) {
            expect(canCompleteStructuredTask(o, loose)).toBe(false);
            expect(canCompleteStructuredTask(o, strict)).toBe(false);
        }
    });

    it('partial completes only non-strict sessions, never as mastery', () => {
        expect(strict.requiresValidation).toBe(true);
        expect(canCompleteStructuredTask('partial', strict)).toBe(false);
        expect(canCompleteStructuredTask('partial', loose)).toBe(true);
        expect(canCompleteStructuredTask('pass', strict)).toBe(true);
        expect(evidenceValueOf('partial')).toBeLessThan(evidenceValueOf('pass'));
    });
});

describe('10-12 — required-card-aware evaluation', () => {
    const cards = [reqCard('r', 'recall'), reqCard('a', 'apply'), reqCard('c', 'challenge')];
    const st = (o: any) => ({ completed: true, attempts: 1, outcome: o });

    it('one PASS cannot mask a required Challenge FAIL', () => {
        expect(evaluateSession(cards, { r: st('pass'), a: st('pass'), c: st('fail') })).toBe('fail');
    });

    it('final required FAIL is non-rewarding', () => {
        expect(evaluateSession(cards, { r: st('pass'), a: st('pass'), c: st('fail') })).toBe('fail');
        expect(isRewardingEvaluation('fail')).toBe(false);
    });

    it('unanswered required proof is non-rewarding', () => {
        expect(evaluateSession(cards, { r: st('pass') })).toBe('non_rewarding');
        expect(isRewardingEvaluation('non_rewarding')).toBe(false);
        expect(isRewardingEvaluation('pass')).toBe(true);
        expect(isRewardingEvaluation('partial')).toBe(true);
    });

    it('all pass/partial with one partial evaluates partial', () => {
        expect(evaluateSession(cards, { r: st('pass'), a: st('partial'), c: st('pass') })).toBe('partial');
        expect(evaluateSession(cards, { r: st('pass'), a: st('pass'), c: st('pass') })).toBe('pass');
    });
});

describe('13 — verified counts PASS only', () => {
    it('partial answers are not reported as verified', () => {
        const cards = [reqCard('r', 'recall'), reqCard('a', 'apply')];
        const data = buildResultData({
            kind: 'structured',
            objectiveTitle: 'T',
            hobbyLabel: 'H',
            minutesFocused: 10,
            status: { r: { completed: true, attempts: 1, outcome: 'pass' }, a: { completed: true, attempts: 1, outcome: 'partial' } },
            cards,
            taskCompleted: false,
        });
        expect(data.answersVerified).toBe(1);
    });
});

describe('14-15 — strength mapping', () => {
    it('discovery is always weightless', () => {
        expect(strengthFor('discovery', 'recall')).toBe('none');
        expect(strengthFor('discovery', 'apply')).toBe('none');
        expect(strengthFor('discovery', 'challenge')).toBe('none');
        expect(sourceFor('discovery')).toBe('discovery');
    });

    it('bite < apply < challenge', () => {
        expect(strengthFor('certificate_review', 'apply')).toBe('weak');
        expect(strengthFor('structured', 'recall')).toBe('weak');
        expect(strengthFor('structured', 'apply')).toBe('medium');
        expect(strengthFor('structured', 'challenge')).toBe('strong');
    });
});

describe('16-20 — progression runs once, only when eligible', () => {
    beforeEach(resetCalls);

    it('failed session advances zero days, zero session counts', () => {
        const res = applySessionProgression({ lesson: testLesson, evaluation: 'fail', chessSolved: false });
        expect(res.advancedDay).toBe(false);
        expect(gameCalls.advanceDay).toBe(0);
        expect(gameCalls.incrementSessionsCompleted).toBe(0);
    });

    it('eligible session advances at most once and counts one session', () => {
        const res = applySessionProgression({ lesson: testLesson, evaluation: 'pass', chessSolved: false });
        expect(res.advancedDay).toBe(true);
        expect(gameCalls.advanceDay).toBe(1);
        expect(gameCalls.incrementSessionsCompleted).toBe(1);
    });

    it('attempt persistence alone runs zero progression', () => {
        recordAttemptArtifact(testLesson, 'do', 'some answer', '👍 good');
        expect(gameCalls.saveArtifact).toBe(1);
        expect(gameCalls.advanceDay).toBe(0);
        expect(gameCalls.incrementSessionsCompleted).toBe(0);
        expect(goalCalls.recordDailyAction).toBe(0);
        expect(goalCalls.adjustDifficulty).toBe(0);
    });

    it('goal signals are truth-aware (pass easy / partial struggled / fail no progress)', () => {
        applySessionProgression({ lesson: testLesson, evaluation: 'pass', chessSolved: false });
        expect(goalCalls.recordDailyAction).toBe(1);
        resetCalls();
        applySessionProgression({ lesson: testLesson, evaluation: 'partial', chessSolved: false });
        expect(goalCalls.recordDailyAction).toBe(1);
        resetCalls();
        applySessionProgression({ lesson: testLesson, evaluation: 'fail', chessSolved: false });
        expect(goalCalls.recordDailyAction).toBe(0);
        expect(goalCalls.adjustDifficulty).toBe(1);
    });
});

describe('21-24 — stable ids, idempotency, append-only', () => {
    beforeEach(__resetLearningEventsForTests);

    it('same attempt has one deterministic id; retries are new entries', () => {
        expect(buildEventId('s1', 'attempt', 'c1', 1)).toBe(buildEventId('s1', 'attempt', 'c1', 1));
        expect(buildEventId('s1', 'attempt', 'c1', 1)).not.toBe(buildEventId('s1', 'attempt', 'c1', 2));
    });

    it('same attempt cannot be appended twice; session event is idempotent', () => {
        const attempt = buildAttemptEvent({
            sessionId: 's1', hobbyId: 'python', cardId: 'r0', attemptNo: 1,
            sessionKind: 'structured', outcome: 'fail', cardType: 'recall',
        });
        expect(appendLearningEvent(attempt)).toBe(true);
        expect(appendLearningEvent(attempt)).toBe(false);
        expect(learningEventCount()).toBe(1);
        const retry = buildAttemptEvent({
            sessionId: 's1', hobbyId: 'python', cardId: 'r0', attemptNo: 2,
            sessionKind: 'structured', outcome: 'pass', cardType: 'recall',
        });
        expect(appendLearningEvent(retry)).toBe(true);
        expect(eventsBySession('s1')).toHaveLength(2);
        expect(eventsBySession('s1').map(e => e.outcome)).toEqual(['fail', 'pass']);
    });

    it('appendMany deduplicates within and across batches', () => {
        const a = buildAttemptEvent({
            sessionId: 's', hobbyId: 'python', cardId: 'c', attemptNo: 1,
            sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
        });
        expect(appendLearningEvents([a, a])).toBe(1);
        expect(appendLearningEvents([a])).toBe(0);
    });
});

describe('25-26 — event hygiene and stable targets', () => {
    it('events carry artifact refs, never raw answers', () => {
        const e = buildAttemptEvent({
            sessionId: 's1', hobbyId: 'python', cardId: 'r0', attemptNo: 1,
            sessionKind: 'structured', outcome: 'pass', cardType: 'recall', artifactRef: 'artifact_9',
        });
        expect('userInput' in e).toBe(false);
        expect('answer' in (e as any)).toBe(false);
        expect(e.artifactRef).toBe('artifact_9');
        expect(e.outcomeValue).toBe(1);
    });

    it('targets resolve from bank mapping, never display text', () => {
        expect(mapLearningTarget('python', 10)).toEqual({
            programSlug: 'python-foundations',
            curriculumDay: 10,
            skillKey: 'logic',
        });
        expect(mapLearningTarget('klingon', 10)).toEqual({});
        const e = buildAttemptEvent({
            sessionId: 's', hobbyId: 'python', lessonId: 'python_d15', lessonDay: 15,
            cardId: 'a', attemptNo: 1, sessionKind: 'structured', outcome: 'partial', cardType: 'apply',
        });
        expect(e.programSlug).toBe('python-foundations');
        expect(e.curriculumDay).toBe(15);
        expect(e.skillKey).toBe('functions');
        expect(e.outcomeValue).toBe(0.5);
        expect(e.evidenceStrength).toBe('medium');
    });

    it('program queries stay scoped', () => {
        appendLearningEvent(
            buildAttemptEvent({
                sessionId: 's', hobbyId: 'python', cardId: 'c', attemptNo: 1,
                sessionKind: 'structured', outcome: 'pass', cardType: 'apply',
            }),
        );
        expect(eventsByProgram('python-foundations')).toHaveLength(1);
        expect(eventsByProgram('reading-mastery')).toHaveLength(0);
    });
});

describe('27-28 — systems stay separate', () => {
    it('goal store and policy know nothing of each other', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const root = path.join(__dirname, '..', '..');
        const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
        expect(read('src/store/goalStore.ts')).not.toMatch(/learningEvents|outcomePolicy/);
        expect(read('src/domain/sessions/outcomePolicy.ts')).not.toMatch(/goalStore|gamificationStore/);
    });

    it('swipe truth path computes no certificate percentages', () => {
        const fs = require('fs') as typeof import('fs');
        const path = require('path') as typeof import('path');
        const root = path.join(__dirname, '..', '..');
        const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
        for (const rel of ['src/hooks/useSwipeSession.ts', 'src/services/learningEventRepository.ts']) {
            expect(`${rel}: ${read(rel)}`).not.toMatch(/certificationProgress|skillGraph/);
        }
    });
});
