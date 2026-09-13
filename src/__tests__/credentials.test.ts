/**
 * Zenyth Verified Credentials — chain tests.
 * Credentials mirror the REAL hobby curriculum (28-day bank weeks), and
 * every link reads the systems the app already has: daily tasks (with
 * curriculum days), session artifacts (AI verdicts), units/days.
 * Key product rule: 100% learning completion can still mean "not certified".
 */
import { CREDENTIAL_PROGRAMS, getProgram, getProgramForHobby, programShortTitle } from '../domain/credentials/catalog';
import { computeSkillGraph, curriculumDayForDate } from '../domain/credentials/skillGraph';
import {
    buildCredentialId,
    buildRecoveryPlan,
    computeFinalScore,
    computeReadiness,
    getRetakeDecision,
    gradeForScore,
    linkedInSharePayload,
    parseCredentialId,
    verificationUrlFor,
} from '../domain/credentials/scoring';
import { buildAttemptQuestions, questionsForProgram, scoreAnswer } from '../data/assessmentBank';
import { computeSkillXp, levelForXp } from '../domain/credentials/xp';
import {
    artifactToAnswer,
    buildEvidence,
    buildProgress,
    deterministicProjectScore,
    gradeAttempt,
    lessonDayToSkillKey,
    toTaskItems,
} from '../services/credentialService';

const pyf = getProgram('python-foundations')!;
const rdg = getProgram('reading-mastery')!;

/** Completed tasks spread across all 4 bank weeks for a hobby. */
const weekTasks = (hobby: string) =>
    [2, 9, 16, 23].flatMap(day => ([
        { type: 'theory' as const, status: 'completed', hobby_id: hobby, scheduled_date: `2026-08-${String(day).padStart(2, '0')}` },
        { type: 'practice' as const, status: 'completed', hobby_id: hobby, scheduled_date: `2026-08-${String(day).padStart(2, '0')}` },
    ]));

const allCorrect = (programSlug: string) =>
    getProgram(programSlug)!.skills.flatMap(s =>
        Array.from({ length: 4 }, () => ({ skillKey: s.key, correct: true, kind: 'applied' as const })),
    );

describe('credential catalog', () => {
    it('has one program per real hobby', () => {
        expect(CREDENTIAL_PROGRAMS.map(p => p.slug).sort()).toEqual(
            ['chess-foundations', 'chinese-hsk1-start', 'english-foundations', 'python-foundations', 'reading-mastery'].sort(),
        );
    });

    it('resolves the program for each task-bank hobby', () => {
        expect(getProgramForHobby('python')?.slug).toBe('python-foundations');
        expect(getProgramForHobby('chess')?.slug).toBe('chess-foundations');
        expect(getProgramForHobby('reading')?.slug).toBe('reading-mastery');
        expect(getProgramForHobby('english')?.slug).toBe('english-foundations');
        expect(getProgramForHobby('chinese')?.slug).toBe('chinese-hsk1-start');
        expect(getProgramForHobby('unknown-hobby')).toBeUndefined();
    });

    it('shortens titles for cards', () => {
        expect(programShortTitle('Zenyth Verified Skill — Python Foundations')).toBe('Python Foundations');
    });

    it('has skill weights summing to 1 and weeks covering days 1..28', () => {
        for (const program of CREDENTIAL_PROGRAMS) {
            const sum = program.skills.reduce((s, k) => s + k.weight, 0);
            expect(sum).toBeCloseTo(1, 5);
            const days = new Set<number>();
            for (const skill of program.skills) {
                for (let d = skill.dayRange[0]; d <= skill.dayRange[1]; d++) days.add(d);
            }
            expect(days.size).toBe(28);
        }
    });
});

describe('curriculum rotation', () => {
    it('matches the task engine 28-day rotation anchored at journey start', () => {
        expect(curriculumDayForDate('2026-09-01', '2026-09-01')).toBe(1);
        expect(curriculumDayForDate('2026-09-07', '2026-09-01')).toBe(7);
        expect(curriculumDayForDate('2026-09-08', '2026-09-01')).toBe(8);
        expect(curriculumDayForDate('2026-09-29', '2026-09-01')).toBe(1);
        // history before enrollment stays in-cycle
        expect(curriculumDayForDate('2026-08-30', '2026-09-01')).toBe(27);
    });

    it('stamps real task items with curriculum days', () => {
        const items = toTaskItems(pyf, weekTasks('python'), '2026-08-01');
        expect(items).toHaveLength(8);
        expect(items.every(i => i.dayNumber !== undefined)).toBe(true);
        // 2026-08-02 anchored 2026-08-01 → day 2 (week 1: syntax)
        expect(items[0].dayNumber).toBe(2);
    });
});

describe('session artifacts as evidence', () => {
    it('maps lesson days onto bank-week skills', () => {
        expect(lessonDayToSkillKey(pyf, 'python_d3')).toBe('syntax');
        expect(lessonDayToSkillKey(pyf, 'python_d10')).toBe('logic');
        expect(lessonDayToSkillKey(pyf, 'python_d17')).toBe('functions');
        expect(lessonDayToSkillKey(pyf, 'python_d25')).toBe('basic_programming');
        expect(lessonDayToSkillKey(pyf, 'garbage')).toBeNull();
    });

    it('counts rewarded session verdicts (pass/partial) as correct', () => {
        expect(artifactToAnswer(pyf, { hobbyId: 'python', lessonId: 'python_d3', taskType: 'do', verdict: 'pass' }))
            .toEqual({ skillKey: 'syntax', correct: true, kind: 'applied' });
        expect(artifactToAnswer(pyf, { hobbyId: 'python', lessonId: 'python_d3', taskType: 'do', verdict: 'partial' })?.correct).toBe(true);
        expect(artifactToAnswer(pyf, { hobbyId: 'python', lessonId: 'python_d3', taskType: 'do', verdict: 'fail' })?.correct).toBe(false);
        // foreign hobby artifacts never leak into the program
        expect(artifactToAnswer(pyf, { hobbyId: 'chess', lessonId: 'chess_d3', taskType: 'do', verdict: 'pass' })).toBeNull();
    });
});

describe('skill graph', () => {
    it('passes when weekly tasks, artifacts and project all clear thresholds', () => {
        const tasks = weekTasks('python');
        const evidence = buildEvidence(pyf, tasks, [], allCorrect('python-foundations'), null, null, 88, {
            anchorDate: '2026-08-01',
            artifacts: [
                { hobbyId: 'python', lessonId: 'python_d2', taskType: 'do', verdict: 'pass' },
                { hobbyId: 'python', lessonId: 'python_d16', taskType: 'do', verdict: 'pass' },
            ],
        });
        const projectScores: Record<string, number> = Object.fromEntries(pyf.skills.map(s => [s.key, 88]));
        const progress = buildProgress(pyf, evidence, projectScores, toTaskItems(pyf, tasks, '2026-08-01'));
        expect(progress.skillGraph.overall).toBeGreaterThanOrEqual(80);
        expect(progress.skillGraph.passed).toBe(true);
    });

    it('fails when a bank-week competency is below minimum despite high overall', () => {
        const tasks = weekTasks('python');
        const answers = pyf.skills.flatMap(s =>
            Array.from({ length: 4 }, () => ({
                skillKey: s.key,
                correct: s.key !== 'functions',
                kind: 'applied' as const,
            })),
        );
        const evidence = buildEvidence(pyf, tasks, [], answers, null, null, null, { anchorDate: '2026-08-01' });
        const project: Record<string, number> = Object.fromEntries(
            pyf.skills.map(s => [s.key, s.key === 'functions' ? 20 : 95]),
        );
        const progress = buildProgress(pyf, evidence, project, toTaskItems(pyf, tasks, '2026-08-01'));
        expect(progress.skillGraph.competenciesPassed).toBe(false);
        expect(progress.skillGraph.passed).toBe(false);
    });

    it('separates learning completion from certification: 100% tasks, failed checks → not certified', () => {
        const tasks = weekTasks('reading');
        const answers = rdg.skills.flatMap(s =>
            Array.from({ length: 4 }, () => ({ skillKey: s.key, correct: false, kind: 'knowledge' as const })),
        );
        const evidence = buildEvidence(rdg, tasks, [], answers, null, null, null, { anchorDate: '2026-08-01' });
        expect(evidence.completedTasks).toBe(8);
        const progress = buildProgress(rdg, evidence, null, toTaskItems(rdg, tasks, '2026-08-01'));
        expect(progress.learningCompletion).toBe(100);
        expect(progress.skillGraph.passed).toBe(false);
    });
});

describe('final score and grades', () => {
    it('composes knowledge 25 / practical 30 / final 25 / project 20', () => {
        const breakdown = computeFinalScore(pyf, { knowledge: 80, practical: 90, finalAssessment: 80, project: 100 });
        // 80*.25 + 90*.3 + 80*.25 + 100*.2 = 20+27+20+20 = 87
        expect(breakdown.total).toBe(87);
        expect(breakdown.grade).toBe('merit');
        expect(breakdown.passed).toBe(true);
    });

    it('requires all components before passing', () => {
        const breakdown = computeFinalScore(pyf, { knowledge: 100, practical: 100, finalAssessment: 100, project: null });
        expect(breakdown.passed).toBe(false);
    });

    it('grades distinctions correctly', () => {
        expect(gradeForScore(79, 80)).toBe('fail');
        expect(gradeForScore(82, 80)).toBe('pass');
        expect(gradeForScore(87, 80)).toBe('merit');
        expect(gradeForScore(92, 80)).toBe('excellence');
        expect(gradeForScore(97, 80)).toBe('distinction');
    });
});

describe('readiness', () => {
    it('predicts pass likelihood from real bank evidence', () => {
        const tasks = weekTasks('reading');
        const evidence = buildEvidence(
            rdg,
            tasks,
            [{ hobby_id: 'reading', duration_seconds: 1800, focus_score: 85 }],
            allCorrect('reading-mastery'),
            null,
            85,
            88,
            { anchorDate: '2026-08-01' },
        );
        const readiness = computeReadiness(rdg, evidence, 10, 0.9);
        expect(readiness.readiness).toBeGreaterThan(rdg.readinessThreshold);
        expect(readiness.likelyToPass).toBe(true);
    });

    it('flags the weakest area and recommends sessions when not ready', () => {
        const evidence = buildEvidence(rdg, [], [], []);
        const readiness = computeReadiness(rdg, evidence, 0, 0);
        expect(readiness.likelyToPass).toBe(false);
        expect(readiness.weakestArea).not.toBeNull();
        expect(readiness.recommendedSessions).toBeGreaterThan(0);
    });
});

describe('retake policy', () => {
    const progress = buildProgress(rdg, buildEvidence(rdg, [], [], []));

    it('allows the first attempt immediately', () => {
        const decision = getRetakeDecision([], progress, {});
        expect(decision.allowed).toBe(true);
    });

    it('enforces a 24h cooldown before the second attempt', () => {
        const now = Date.now();
        const attempts = [
            { attemptNumber: 1, startedAt: new Date(now - 3600_000).toISOString(), completedAt: new Date(now - 1800_000).toISOString(), score: 60, passed: false },
        ];
        const decision = getRetakeDecision(attempts, progress, {}, now);
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toBe('cooldown');
        expect(decision.availableAfter).not.toBeNull();
    });

    it('requires remediation before the third attempt', () => {
        const now = Date.now();
        const old = new Date(now - 3 * 24 * 3600_000).toISOString();
        const attempts = [1, 2].map(n => ({
            attemptNumber: n,
            startedAt: old,
            completedAt: old,
            score: 60,
            passed: false,
        }));
        const decision = getRetakeDecision(attempts, progress, {}, now);
        expect(decision.allowed).toBe(false);
        expect(decision.reason).toBe('remediation_required');
        expect(decision.requiredRemediation.length).toBeGreaterThan(0);
    });

    it('builds a recovery plan pointing at weak bank-week skills', () => {
        const plan = buildRecoveryPlan(rdg, progress);
        expect(plan.totalSessions).toBeGreaterThan(0);
        expect(plan.suggestedTaskTypes.length).toBeGreaterThan(0);
    });
});

describe('verification', () => {
    it('builds parseable ZNY credential IDs', () => {
        const id = buildCredentialId('RDG', 'user-123', '2026-09-09T00:00:00.000Z');
        expect(id).toMatch(/^ZNY-RDG-26-[A-F0-9]{6}$/);
        expect(parseCredentialId(id)).toEqual({ code: 'RDG', year: '26', hash: id.slice(-6) });
        expect(parseCredentialId('forged-pdf-id')).toBeNull();
        expect(verificationUrlFor(id)).toBe(`https://zenyth.ai/verify/${id}`);
    });

    it('builds a LinkedIn share payload', () => {
        const payload = linkedInSharePayload({
            programTitle: rdg.title,
            credentialId: 'ZNY-RDG-26-A81F42',
            issuedAt: '2026-09-09T00:00:00.000Z',
            verificationUrl: 'https://zenyth.ai/verify/ZNY-RDG-26-A81F42',
        });
        expect(payload.organization).toBe('Zenyth AI');
        expect(payload.credentialUrl).toContain('ZNY-RDG-26-A81F42');
    });
});

describe('assessment bank', () => {
    it('covers every bank-week skill of each program with bank topics', () => {
        for (const program of CREDENTIAL_PROGRAMS) {
            const covered = new Set(questionsForProgram(program.slug).map(question => question.skillKey));
            for (const skill of program.skills) {
                expect(covered.has(skill.key)).toBe(true);
            }
        }
    });

    it('builds randomized attempts with remapped correct answers', () => {
        const rng = (() => {
            let s = 42;
            return () => {
                s = (s * 1103515245 + 12345) % 2147483648;
                return s / 2147483648;
            };
        })();
        const attempt = buildAttemptQuestions('reading-mastery', 6, rng);
        expect(attempt).toHaveLength(6);
        const single = attempt.find(question => question.questionKind === 'single_choice')!;
        expect(single.displayOptions).toHaveLength(single.options!.length);
        // Answering with the remapped correct indices must score true.
        expect(scoreAnswer(single, single.displayCorrectIndices ?? [])).toBe(true);
    });

    it('grades mixed attempts per skill', () => {
        const attempt = buildAttemptQuestions('python-foundations', 4);
        const answers = attempt.map((question, i) => ({
            questionId: question.id,
            selectedIndices: i === 0 ? (question.displayCorrectIndices ?? []) : [999],
            booleanAnswer: question.questionKind === 'true_false' ? question.correctBoolean : null,
        }));
        const graded = gradeAttempt(attempt, answers);
        expect(graded.correctCount).toBeGreaterThanOrEqual(1);
        expect(graded.perSkill).toHaveLength(4);
    });
});

describe('issuance gate math (display only — authority is server-side)', () => {
    it('passes local gate math only when bank-week graph and final score both pass', () => {
        const tasks = weekTasks('reading');
        const evidence = buildEvidence(rdg, tasks, [], allCorrect('reading-mastery'), 88, 91, 86, {
            anchorDate: '2026-08-01',
        });
        const projectScores: Record<string, number> = Object.fromEntries(rdg.skills.map(s => [s.key, 86]));
        const progress = buildProgress(rdg, evidence, projectScores, toTaskItems(rdg, tasks, '2026-08-01'));
        // Local math is DISPLAY ONLY: authoritative issuance is the server
        // RPC `issue_credential` (trustApi). These assertions pin the local
        // gate inputs, not an issued credential.
        const breakdown = computeFinalScore(rdg, { knowledge: 90, practical: 91, finalAssessment: 88, project: 86 });
        expect(breakdown.passed).toBe(true);
        expect(progress.skillGraph.passed).toBe(true);
    });

    it('fails local gate math when checks fail', () => {
        const evidence = buildEvidence(rdg, [], [], []);
        const progress = buildProgress(rdg, evidence);
        const breakdown = computeFinalScore(rdg, { knowledge: 40, practical: 40, finalAssessment: 40, project: 40 });
        expect(breakdown.passed).toBe(false);
        expect(progress.skillGraph.passed).toBe(false);
    });

    it('scores projects deterministically offline', () => {
        const rubric = deterministicProjectScore({ wordCount: 500, chartCount: 3, calculationCount: 5, hasRecommendations: true });
        expect(rubric.dataAccuracy).toBe(25);
        expect(rubric.recommendations).toBe(14);
    });
});

describe('skill XP and levels', () => {
    it('derives XP from chain actions only', () => {
        expect(computeSkillXp({ enrolled: false, correctAnswers: 0, finalPassed: false, projectSubmitted: false, issued: false })).toBe(0);
        // enroll +20, 5 correct ×10, final +150, project +100, issued +300
        expect(computeSkillXp({ enrolled: true, correctAnswers: 5, finalPassed: true, projectSubmitted: true, issued: true })).toBe(620);
    });

    it('levels up through thresholds with progress to next', () => {
        expect(levelForXp(0).level).toBe(1);
        expect(levelForXp(0).title).toBe('Novice');
        expect(levelForXp(99).level).toBe(1);
        expect(levelForXp(100).level).toBe(2);
        expect(levelForXp(620).level).toBe(4);
        const mid = levelForXp(175);
        expect(mid.progressToNext).toBeCloseTo(0.5, 2);
        expect(mid.xpToNext).toBe(75);
    });

    it('caps at max level', () => {
        const max = levelForXp(99999);
        expect(max.nextLevelMin).toBeNull();
        expect(max.progressToNext).toBe(1);
        expect(max.xpToNext).toBe(0);
    });
});
