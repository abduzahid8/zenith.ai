/**
 * A+B regression: one canonical certificate progress + one canonical anchor.
 *
 * Invariant: exactly one canonical answer to
 * "What is this user's certification progress for credential X right now?"
 * Displayed % MUST be certificationProgress (skillGraph.overall), never
 * learningCompletion. Gates stay untouched:
 * 100% tasks + failed checks != certified.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getProgram } from '../domain/credentials/catalog';
import { curriculumDayForDate } from '../domain/credentials/skillGraph';
import { canonicalAnchorForEnrollment } from '../domain/credentials/anchor';
import {
    buildEvidence,
    buildProgress,
    issueCredential,
    taskSkillKey,
    toTaskItems,
} from '../services/credentialService';

jest.mock('../services/ai', () => ({
    aiService: { sendMessage: jest.fn(), gradeAnswer: jest.fn() },
}));

const pyf = getProgram('python-foundations')!;
const rdg = getProgram('reading-mastery')!;

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** Completed tasks spread across all 4 bank weeks (task channel only). */
const historyAcrossSkills = (hobby: string) =>
    [2, 9, 16, 23].flatMap(day => ([
        { type: 'theory' as const, status: 'completed', hobby_id: hobby, scheduled_date: `2026-08-${String(day).padStart(2, '0')}` },
        { type: 'practice' as const, status: 'completed', hobby_id: hobby, scheduled_date: `2026-08-${String(day).padStart(2, '0')}` },
    ]));

describe('B — single enrollment anchor', () => {
    it('returns normalized YYYY-MM-DD when enrolled with an ISO datetime', () => {
        expect(canonicalAnchorForEnrollment(true, '2026-08-01T10:00:00.000Z')).toBe('2026-08-01');
    });

    it('returns null when not enrolled, even if a date is present', () => {
        expect(canonicalAnchorForEnrollment(false, '2026-08-01T10:00:00.000Z')).toBeNull();
        expect(canonicalAnchorForEnrollment(false, null)).toBeNull();
    });

    it('returns null when enrolled but no date is stored', () => {
        expect(canonicalAnchorForEnrollment(true, null)).toBeNull();
        expect(canonicalAnchorForEnrollment(true, undefined)).toBeNull();
    });

    it('rejects malformed dates instead of fabricating an anchor', () => {
        expect(canonicalAnchorForEnrollment(true, 'not-a-date')).toBeNull();
        expect(canonicalAnchorForEnrollment(true, '')).toBeNull();
    });
});

describe('B — missing anchor attribution', () => {
    it('taskSkillKey with null anchor returns null (never day 1)', () => {
        expect(
            taskSkillKey({ hobby_id: 'python', scheduled_date: '2026-08-10' }, null),
        ).toBeNull();
    });

    it('toTaskItems with null anchor leaves dayNumber undefined (no skill pool)', () => {
        const items = toTaskItems(pyf, historyAcrossSkills('python'), null);
        expect(items.length).toBeGreaterThan(0);
        expect(items.every(i => i.dayNumber === undefined)).toBe(true);
    });
});

describe('B — single day/skill across attribution paths', () => {
    it('taskSkillKey, toTaskItems and manual curriculumDay agree on one skill', () => {
        const anchor = canonicalAnchorForEnrollment(true, '2026-08-01T00:00:00.000Z');
        expect(anchor).toBe('2026-08-01');
        const taskDate = '2026-08-10'; // day 10 -> week 2 -> logic
        const day = curriculumDayForDate(taskDate, anchor!);
        expect(day).toBe(10);

        const tagged = taskSkillKey({ hobby_id: 'python', scheduled_date: taskDate }, anchor);
        expect(tagged).not.toBeNull();
        expect(tagged!.programSlug).toBe('python-foundations');
        expect(tagged!.skillKey).toBe('logic');

        const items = toTaskItems(
            pyf,
            [{ type: 'practice', status: 'completed', hobby_id: 'python', scheduled_date: taskDate }],
            anchor,
        );
        expect(items[0].dayNumber).toBe(10);
        const skill = pyf.skills.find(s => items[0].dayNumber! >= s.dayRange[0] && items[0].dayNumber! <= s.dayRange[1]);
        expect(skill?.key).toBe(tagged!.skillKey);
    });
});

describe('A — today-only data cannot redefine the certificate', () => {
    it('history across skills vs today-only single skill give different overall', () => {
        const history = historyAcrossSkills('python');
        const todayOnly = [
            { type: 'theory' as const, status: 'completed', hobby_id: 'python', scheduled_date: '2026-08-02' },
            { type: 'practice' as const, status: 'completed', hobby_id: 'python', scheduled_date: '2026-08-02' },
        ];
        const anchor = '2026-08-01';
        const canonical = buildProgress(
            pyf, buildEvidence(pyf, history, [], [], null, null, null, { anchorDate: anchor }),
            null, toTaskItems(pyf, history, anchor),
        );
        const truncated = buildProgress(
            pyf, buildEvidence(pyf, todayOnly, [], [], null, null, null, { anchorDate: anchor }),
            null, toTaskItems(pyf, todayOnly, anchor),
        );
        // Same formula, different dataset -> different %. Today-only must not be used.
        expect(canonical.certificationProgress).not.toBe(truncated.certificationProgress);
        expect(canonical.certificationProgress).toBeGreaterThan(truncated.certificationProgress);
    });

    it('canonical history is stable when today duplicates an existing slot', () => {
        const history = historyAcrossSkills('python');
        const anchor = '2026-08-01';
        const base = buildProgress(
            pyf, buildEvidence(pyf, history, [], [], null, null, null, { anchorDate: anchor }),
            null, toTaskItems(pyf, history, anchor),
        );
        // useCredentialEngine merges today by scheduled_date|type; duplicates add nothing.
        const merged = [...history];
        const keys = new Set(history.map(t => `${t.scheduled_date}|${t.type}`));
        const todayDup = { type: 'theory' as const, status: 'completed', hobby_id: 'python', scheduled_date: '2026-08-02' };
        if (!keys.has(`${todayDup.scheduled_date}|${todayDup.type}`)) merged.push(todayDup);
        const again = buildProgress(
            pyf, buildEvidence(pyf, merged, [], [], null, null, null, { anchorDate: anchor }),
            null, toTaskItems(pyf, merged, anchor),
        );
        expect(again.certificationProgress).toBe(base.certificationProgress);
    });
});

describe('gates unchanged', () => {
    it('100% tasks + failed checks => not certified, no issuance', () => {
        const tasks = historyAcrossSkills('reading');
        const wrong = rdg.skills.flatMap(s =>
            Array.from({ length: 4 }, () => ({ skillKey: s.key, correct: false, kind: 'knowledge' as const })),
        );
        const evidence = buildEvidence(rdg, tasks, [], wrong, 60, null, null, { anchorDate: '2026-08-01' });
        const progress = buildProgress(rdg, evidence, null, toTaskItems(rdg, tasks, '2026-08-01'));
        expect(progress.learningCompletion).toBe(100);
        expect(progress.skillGraph.passed).toBe(false);
        const issued = issueCredential(
            'reading-mastery', 'user-123', 'Learner',
            { knowledge: 20, practical: 90, finalAssessment: 60, project: null },
            progress, evidence,
        );
        expect(issued).toBeNull();
    });
});

describe('A — architecture: one canonical selector', () => {
    const consumers = [
        'src/screens/tabs/WeeklyPlanTab.tsx',
        'src/screens/QuickSessionScreen.tsx',
        'src/components/credentials/QuestStrip.tsx',
        'src/screens/CredentialsScreen.tsx',
        'src/screens/CredentialDetailScreen.tsx',
    ];

    it.each(consumers)('%s consumes the canonical progress hook', (rel: string) => {
        const src = readSrc(rel);
        expect(src).toMatch(/useCertificateProgress|useAllCertificateProgress/);
    });

    it('no consumer scores certificates from today-only dailyTasks', () => {
        for (const rel of consumers) {
            expect(`${rel}: ${readSrc(rel)}`).not.toMatch(/toEngineTaskInputs\(dailyTasks\)/);
        }
    });

    it('no consumer calls store getProgress directly (must go via hook)', () => {
        for (const rel of consumers) {
            expect(`${rel}: ${readSrc(rel)}`).not.toMatch(/\.getProgress\(/);
        }
    });

    it('no divergent anchor fallbacks outside the canonical anchor', () => {
        expect(readSrc('src/services/credentialService.ts')).not.toMatch(/\?\?\s*task\.scheduled_date/);
        for (const rel of consumers) {
            expect(`${rel}: ${readSrc(rel)}`).not.toMatch(/enrolledAt\?\.slice/);
        }
    });
});
