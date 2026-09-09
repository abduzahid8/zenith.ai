/**
 * One-lane product simplification — invariants (§27).
 * Simplified UI must reference real tasks/routes/selectors, never duplicate
 * progress math, engines, or taxonomy. Home stays structurally unchanged.
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildSessionBlueprint, normalizeKind } from '../domain/sessions/sessionBlueprint';
import { resolveCompletionPlan } from '../domain/sessions/sessionCompletion';
import { buildTodaySequence } from '../domain/sessions/todaySequence';
import {
    buildSessionRoute,
    discoveryRoute,
    quickPracticeRoute,
    sessionRouteForTask,
} from '../domain/sessions/sessionRouting';

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const task = (overrides: any = {}) => ({
    id: 'task-1',
    user_id: 'u',
    title: 'Loops',
    type: 'practice',
    status: 'pending',
    scheduled_date: '2026-09-09',
    hobby_id: 'python',
    duration_minutes: 12,
    ...overrides,
});

describe('1-2 — Your Day references real tasks, tap enters shared session', () => {
    it('sequence preserves real task IDs in display order', () => {
        const seq = buildTodaySequence([task({ id: 'a', type: 'theory' }), task({ id: 'b', type: 'practice' })]);
        expect(seq.rows.map(r => r.taskId)).toEqual(['a', 'b']);
        expect(seq.next?.taskId).toBe('a');
    });

    it('tap route carries the real task ID into the shared session', () => {
        const route = sessionRouteForTask(task({ id: 'real-uuid', duration_minutes: 20 }), 'your_day');
        expect(route.startsWith('/session-timer?')).toBe(true);
        expect(route).toMatch(/taskId=real-uuid/);
        expect(route).toMatch(/kind=structured/);
        expect(route).toMatch(/minutes=20/);
        expect(route).toMatch(/origin=your_day/);
    });

    it('sequence tracks minutes left and completion honestly', () => {
        const seq = buildTodaySequence([
            task({ id: 'a', status: 'completed' }),
            task({ id: 'b', duration_minutes: 10 }),
        ]);
        expect(seq.doneCount).toBe(1);
        expect(seq.minutesLeft).toBe(10);
        expect(seq.allDone).toBe(false);
        expect(seq.next?.taskId).toBe('b');
    });
});

describe('3-5 — quick practice review-only, discovery weightless, credential routing', () => {
    it('recommended practice route is a review-only bite', () => {
        const route = quickPracticeRoute(5, 8);
        expect(route).toMatch(/kind=certificate_review/);
        expect(route).toMatch(/skillDay=8/);
        expect(normalizeKind('certificate_review')).toBe('certificate_review');
        const blueprint = buildSessionBlueprint({ minutes: 5, lessonTitle: 'Loops', kind: 'certificate_review' });
        expect(blueprint.countsAsFullCompletion).toBe(false);
        const plan = resolveCompletionPlan({
            blueprint,
            outcome: 'pass',
            tasks: [{ id: 't1', type: 'practice', status: 'pending' }],
            targetTaskId: 't1',
        });
        expect(plan.completeTask).toBe(false);
    });

    it('discovery route is weightless micro content', () => {
        const route = discoveryRoute(10, 'plane-trails');
        expect(route).toMatch(/kind=discovery/);
        expect(route).toMatch(/discoveryId=plane-trails/);
    });

    it('shared builder is the only route shape', () => {
        const route = buildSessionRoute({ minutes: 15, kind: 'structured', origin: 'home_start' });
        expect(route).toBe('/session-timer?minutes=15&kind=structured&origin=home_start');
    });
});

describe('6 — no duplicate progress calculation in simplified screens', () => {
    const screens = [
        'src/screens/tabs/WeeklyPlanTab.tsx',
        'src/screens/QuickSessionScreen.tsx',
        'src/screens/CredentialsScreen.tsx',
        'src/screens/CredentialDetailScreen.tsx',
    ];

    it.each(screens)('%s builds no certificate math itself', (rel: string) => {
        const src = readSrc(rel);
        expect(`${rel}: ${src}`).not.toMatch(/toEngineTaskInputs/);
        expect(`${rel}: ${src}`).not.toMatch(/\.getProgress\(/);
        expect(`${rel}: ${src}`).not.toMatch(/computeSkillGraph|buildProgress/);
    });

    it('credential screens consume the canonical selector', () => {
        expect(readSrc('src/screens/QuickSessionScreen.tsx')).toMatch(/useCertificateProgress/);
        expect(readSrc('src/screens/CredentialsScreen.tsx')).toMatch(/useAllCertificateProgress/);
        expect(readSrc('src/screens/CredentialDetailScreen.tsx')).toMatch(/useCertificateProgress/);
    });
});

describe('7 — Home first screen structurally unchanged', () => {
    it('keeps its visual identity markers, gains no swipe internals', () => {
        const src = readSrc('src/screens/tabs/HomeTab.tsx');
        expect(src).toMatch(/Начать занятие/);
        expect(src).toMatch(/#BFD8F9/);
        expect(src).toMatch(/booksImage/);
        expect(src).not.toMatch(/SwipeLearningSession|buildLearningCards|LearningCard/);
    });
});

describe('8 — no second session engine', () => {
    it('completion grants live in exactly one domain module', () => {
        const { execSync } = require('child_process') as typeof import('child_process');
        const out = execSync('git grep -l "countsAsFullCompletion:" -- src | sort', {
            cwd: ROOT,
            encoding: 'utf8',
        }).trim().split('\n').filter(Boolean);
        expect(out).toEqual(['src/domain/sessions/sessionBlueprint.ts']);
    });

    it('swipe controller reuses the shared pipeline (no fork)', () => {
        const hook = readSrc('src/hooks/useSwipeSession.ts');
        expect(hook).toMatch(/resolveCompletionPlan/);
        expect(hook).toMatch(/buildSessionBlueprint/);
        expect(readSrc('src/domain/sessions/learningCards.ts')).not.toMatch(/countsAsFullCompletion/);
    });
});

describe('9 — user language, not engine taxonomy', () => {
    it('simplified surfaces never show theory/practice/analysis/puzzles labels', () => {
        for (const rel of [
            'src/screens/tabs/WeeklyPlanTab.tsx',
            'src/screens/QuickSessionScreen.tsx',
            'src/screens/CredentialsScreen.tsx',
            'src/screens/CredentialDetailScreen.tsx',
            'src/domain/sessions/todaySequence.ts',
        ]) {
            expect(`${rel}: ${readSrc(rel)}`).not.toMatch(/Углуби/);
        }
    });

    it('sequence speaks Learn/Practice/Challenge', () => {
        const seq = buildTodaySequence([
            task({ id: 'a', type: 'theory' }),
            task({ id: 'b', type: 'practice' }),
            task({ id: 'c', type: 'puzzles' }),
        ]);
        expect(seq.rows.map(r => r.actionLabel)).toEqual(['Узнай', 'Сделай', 'Вызов']);
    });
});

describe('10 — session result invents no metrics', () => {
    it('swipe result path references no progress percentages', () => {
        for (const rel of [
            'src/components/session/swipe/FeedbackCard.tsx',
            'src/components/session/swipe/SwipeLearningSession.tsx',
            'src/hooks/useSwipeSession.ts',
        ]) {
            const src = readSrc(rel);
            expect(`${rel}: ${src}`).not.toMatch(/certificationProgress|percentComplete|readiness/);
        }
    });
});
