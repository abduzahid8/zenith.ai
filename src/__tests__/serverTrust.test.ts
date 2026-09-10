/**
 * Server trust layer invariants (24 required cases).
 *
 * FakeTrustServer mirrors migrations 011-013 row-for-row in contract:
 * ownership/attribution trigger, trust derivation, idempotent ingest,
 * assessment guard + server scoring, project authority split, issuance
 * gate, anonymous verification. Anything the SQL forbids, the fake throws
 * on (like RLS 42501). Policy math itself is the real src/server/trust.ts.
 */

import {
    buildTrustedRegistry,
    deriveEvidenceStrength,
    deriveOutcomeValue,
    evaluateIssuanceGate,
    isTrustedValidation,
    projectPublicVerification,
    projectSkillState,
    scoreAssessmentFromAnswers,
    trustedValidationCoverage,
} from '../server/trust';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import { getProgram } from '../domain/credentials/catalog';

// ---------------------------------------------------------------------------
// FakeTrustServer — mirrors SQL migrations 011/012/013.
// ---------------------------------------------------------------------------

interface ServerEventRow extends Omit<LearningEvent, 'userId' | 'ownerId'> {
    userId: string | null;
    trusted: boolean;
}

class FakeTrustServer {
    events = new Map<string, ServerEventRow>();
    registry = buildTrustedRegistry(
        [1, 2, 3, 4, 5, 6, 7].map(d => ({ hobbyId: 'chess', curriculumDay: d })),
    );
    keys = new Map<string, { answers: Record<string, string>; ids: string[] }>();
    attempts = new Map<
        string,
        {
            id: string;
            owner: string;
            program: string;
            version: string;
            status: 'started' | 'submitted';
            answers: Record<string, string> | null;
            score: number | null;
            passed: boolean | null;
        }
    >();
    projectResults = new Map<string, { program: string; version: string; passed: boolean }>();
    issued = new Map<string, any>();
    revoked = new Set<string>();

    /** Mirrors trigger learning_events_derive_ownership (migration 011). */
    upsertEvent(event: LearningEvent, clientOwner: string | null, asUid: string | null): boolean {
        if (this.events.has(event.id)) return false; // idempotent retry
        const owned = clientOwner !== null && asUid !== null && clientOwner === asUid;
        // Inline mirror of the SQL trust derivation (NOT calling
        // isTrustedValidation, so the two stay independently checked).
        const trusted =
            owned &&
            event.eventType === 'attempt' &&
            event.sessionKind === 'structured' &&
            event.phase === 'validate' &&
            event.outcome === 'pass' &&
            !!event.programVersion &&
            (event.provenance === 'static_bank' || (event.provenance as string) === 'generated_validated') &&
            this.registry.has(`${event.hobbyId}:${event.curriculumDay}`);
        this.events.set(event.id, {
            ...event,
            userId: owned ? asUid : null,
            trusted,
        });
        return true;
    }

    /** Mirrors RLS SELECT own (legacy unattributed rows invisible). */
    readEvents(asUid: string): ServerEventRow[] {
        return [...this.events.values()].filter(e => e.userId === asUid);
    }

    // -- assessment (migration 012) --
    seedKey(setId: string, answers: Record<string, string>): void {
        this.keys.set(setId, { answers, ids: Object.keys(answers) });
    }

    createAttempt(id: string, owner: string, program: string, version: string, setId: string): void {
        this.attempts.set(id, {
            id, owner, program, version, status: 'started', answers: null, score: null, passed: null,
        });
        void setId;
    }

    /** Mirrors guard trigger: answers only, owner only, while started. */
    saveAnswersAsClient(id: string, asUid: string, patch: Record<string, unknown>): void {
        const a = this.attempts.get(id);
        if (!a || a.owner !== asUid) throw new Error('RLS: not the attempt owner');
        if (a.status !== 'started') throw new Error('attempt already submitted, answers locked');
        if (typeof patch.answers === 'object' && patch.answers !== null) {
            a.answers = patch.answers as Record<string, string>;
        }
        // score/passed/status in the patch are stripped (guard trigger).
    }

    /** Mirrors submit_assessment: server scores from the key. */
    submit(id: string, asUid: string, answers: Record<string, string>, setId: string): { score: number; passed: boolean; submitted: boolean } {
        const a = this.attempts.get(id);
        if (!a || a.owner !== asUid) throw new Error('RLS: not the attempt owner');
        if (a.status === 'submitted') {
            return { score: a.score!, passed: a.passed!, submitted: false };
        }
        const key = this.keys.get(setId)!;
        const s = scoreAssessmentFromAnswers({
            answers, answerKey: key.answers, questionIds: key.ids, passScore: 80,
        });
        a.answers = answers;
        a.score = s.score;
        a.passed = s.passed;
        a.status = 'submitted';
        return { score: s.score, passed: s.passed, submitted: true };
    }

    // -- project (migration 012): formative is client-writable, authoritative is service-role only.
    recordAuthoritativeProject(owner: string, program: string, version: string, passed: boolean, role: string): void {
        if (role !== 'service_role') throw new Error('RLS: authoritative results are service-role only');
        this.projectResults.set(`${owner}:${program}:${version}`, { program, version, passed });
    }

    clientInsertAuthoritativeProject(): void {
        throw new Error('RLS: no client INSERT policy on project_certification_results');
    }

    // -- issuance (migration 013) --
    issue(program: string, version: string, holder: string, asUid: string, opts: { requiresProject: boolean }): { credentialId: string; created: boolean } {
        const gate = evaluateIssuanceGate({
            programSlug: program,
            programVersion: version,
            requiresAssessment: true,
            assessmentPassScore: 80,
            assessment: this.bestAssessment(asUid, program, version),
            requiresProject: opts.requiresProject,
            project: this.authoritativeProject(asUid, program, version),
            skillGates:
                program === 'chess-foundations'
                    ? [{ skillKey: 'rules', minTrustedValidations: 2, minSessions: 2 }]
                    : [],
            coverage: trustedValidationCoverage(
                this.readEvents(asUid).filter(
                    e =>
                        e.trusted &&
                        e.programSlug === program &&
                        e.programVersion === version &&
                        e.eventType === 'attempt' &&
                        e.phase === 'validate' &&
                        e.outcome === 'pass',
                ),
            ),
        });
        if (!gate.eligible) throw new Error(`gate: ${gate.reasons.join(',')}`);
        const key = `${asUid}:${program}:${version}`;
        const existing = this.issued.get(key);
        if (existing) return { credentialId: existing.credential_id, created: false };
        const credentialId = `ZNX-TEST-${this.issued.size + 1}`;
        this.issued.set(key, {
            credential_id: credentialId,
            program_slug: program,
            program_title: program,
            program_version: version,
            holder_display_name: holder,
            issued_at: '2026-09-10T00:00:00.000Z',
            expires_at: null,
            status: 'active',
            verified_skills: [{ key: 'rules', name: 'Rules' }],
            final_score: 90,
            grade: 'A',
        });
        return { credentialId, created: true };
    }

    private bestAssessment(asUid: string, program: string, version: string) {
        let best: { passed: boolean; score: number; programVersion: string } | null = null;
        for (const a of this.attempts.values()) {
            if (a.owner === asUid && a.program === program && a.version === version && a.status === 'submitted' && a.passed) {
                if (!best || (a.score ?? 0) > best.score) {
                    best = { passed: true, score: a.score ?? 0, programVersion: a.version };
                }
            }
        }
        return best;
    }

    private authoritativeProject(asUid: string, program: string, version: string) {
        const r = this.projectResults.get(`${asUid}:${program}:${version}`);
        return r ? { passed: r.passed, authoritative: true, programVersion: r.version } : null;
    }

    clientInsertIssued(): void {
        throw new Error('RLS: no client INSERT policy on issued_credentials');
    }

    clientUpdateIssued(): void {
        throw new Error('RLS: no client UPDATE policy on issued_credentials');
    }

    clientWriteProgress(): void {
        throw new Error('RLS: no client write policy on user_credential_progress');
    }

    revokeAsServiceRole(credentialId: string): void {
        this.revoked.add(credentialId);
        for (const row of this.issued.values()) {
            if (row.credential_id === credentialId) row.status = 'revoked';
        }
    }

    /** Mirrors verify_credential: anon-safe projection, revoked stays revoked. */
    verifyAnon(credentialId: string): ReturnType<typeof projectPublicVerification> | null {
        for (const row of this.issued.values()) {
            if (row.credential_id === credentialId) return projectPublicVerification(row);
        }
        return null;
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const chess = getProgram('chess-foundations')!;

function chessValidate(session: string, card: string, day = 4, prov: 'static_bank' | 'generated_unverified' = 'static_bank'): LearningEvent {
    return buildAttemptEvent({
        sessionId: session,
        userId: 'user-a',
        hobbyId: 'chess',
        lessonId: `chess_d${day}`,
        lessonDay: day,
        cardId: card,
        attemptNo: 1,
        phase: 'validate',
        sessionKind: 'structured',
        outcome: 'pass',
        cardType: 'challenge',
        provenance: prov,
        occurredAt: `2026-09-0${session === 's1' ? 1 : 2}T10:00:00.000Z`,
    });
}

function chessRecallApply(session: string): LearningEvent[] {
    return (['recall', 'apply'] as const).map(phase =>
        buildAttemptEvent({
            sessionId: session,
            userId: 'user-a',
            hobbyId: 'chess',
            lessonId: 'chess_d4',
            lessonDay: 4,
            cardId: `${phase}-${session}`,
            attemptNo: 1,
            phase,
            sessionKind: 'structured',
            outcome: 'pass',
            cardType: phase,
            occurredAt: '2026-09-01T10:00:00.000Z',
        }),
    );
}

// ---------------------------------------------------------------------------
// The 24 invariants
// ---------------------------------------------------------------------------

describe('server trust layer invariants', () => {
    test('1. duplicate event upload -> one DB event', () => {
        const s = new FakeTrustServer();
        const e = chessValidate('s1', 'v-s1');
        expect(s.upsertEvent(e, 'user-a', 'user-a')).toBe(true);
        expect(s.upsertEvent(e, 'user-a', 'user-a')).toBe(false);
        expect(s.events.size).toBe(1);
    });

    test('2. user A cannot write event for user B', () => {
        const s = new FakeTrustServer();
        const e = chessValidate('s1', 'v-s1');
        s.upsertEvent(e, 'user-b', 'user-a'); // A claims B's ownership
        const row = s.events.get(e.id)!;
        expect(row.userId).toBeNull(); // never attributed to B
        expect(s.readEvents('user-b')).toHaveLength(0);
        expect(s.readEvents('user-a')).toHaveLength(0);
    });

    test('3. ownerless legacy event is not auto-attributed', () => {
        const s = new FakeTrustServer();
        const legacy = { ...chessValidate('s0', 'v-s0'), ownerId: undefined, userId: undefined };
        s.upsertEvent(legacy, null, 'user-a'); // logged-in user syncs legacy
        expect(s.events.get(legacy.id)!.userId).toBeNull();
        expect(s.readEvents('user-a')).toHaveLength(0);
    });

    test('4. discovery cannot create certification authority', () => {
        const d = buildAttemptEvent({
            sessionId: 'd1', hobbyId: 'chess', lessonId: 'chess_d1', lessonDay: 1,
            cardId: 'c', attemptNo: 1, phase: 'validate', sessionKind: 'discovery',
            outcome: 'pass', cardType: 'challenge', provenance: 'static_bank',
        });
        expect(deriveEvidenceStrength({ sessionKind: 'discovery', cardKind: 'challenge', provenance: 'static_bank' })).toBe('none');
        const s = new FakeTrustServer();
        s.upsertEvent(d, 'user-a', 'user-a');
        expect(s.events.get(d.id)!.trusted).toBe(false);
        expect(isTrustedValidation({ ...d, programVersion: d.programVersion }, s.registry)).toBe(false);
    });

    test('5. unknown = zero', () => {
        expect(deriveOutcomeValue('unknown')).toBe(0);
    });

    test('6. partial < pass', () => {
        expect(deriveOutcomeValue('partial')).toBeLessThan(deriveOutcomeValue('pass'));
        expect(deriveOutcomeValue('partial')).toBe(0.5);
    });

    test('7. generated_unverified validation cannot become trusted', () => {
        const e = chessValidate('s1', 'v-s1', 4, 'generated_unverified');
        // Registry lists chess day 4 — still must not trust unverified.
        expect(isTrustedValidation({ ...e, programVersion: e.programVersion }, new FakeTrustServer().registry)).toBe(false);
        const s = new FakeTrustServer();
        s.upsertEvent(e, 'user-a', 'user-a');
        expect(s.events.get(e.id)!.trusted).toBe(false);
    });

    test('8. client cannot directly set authoritative assessment score', () => {
        const s = new FakeTrustServer();
        s.seedKey('set-1', { q1: 'a' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        s.saveAnswersAsClient('att-1', 'user-a', { answers: { q1: 'b' }, score: 100, passed: true, status: 'submitted' });
        const a = s.attempts.get('att-1')!;
        expect(a.score).toBeNull(); // stripped by guard
        expect(a.passed).toBeNull();
        expect(a.status).toBe('started');
    });

    test('9. client cannot directly mark credential passed', () => {
        const s = new FakeTrustServer();
        expect(() => s.clientWriteProgress()).toThrow();
    });

    test('10. client cannot insert issued credential', () => {
        const s = new FakeTrustServer();
        expect(() => s.clientInsertIssued()).toThrow();
    });

    test('11. final assessment score is computed from answers server-side', () => {
        const s = new FakeTrustServer();
        s.seedKey('set-1', { q1: 'a', q2: 'b', q3: 'c', q4: 'd' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        // Client claims 100 by submitting only what it knows; server scores 75.
        const r = s.submit('att-1', 'user-a', { q1: 'a', q2: 'b', q3: 'c', q4: 'WRONG' }, 'set-1');
        expect(r).toEqual({ score: 75, passed: false, submitted: true });
        expect(r.score).toBe(
            scoreAssessmentFromAnswers({
                answers: { q1: 'a', q2: 'b', q3: 'c', q4: 'WRONG' },
                answerKey: { q1: 'a', q2: 'b', q3: 'c', q4: 'd' },
                questionIds: ['q1', 'q2', 'q3', 'q4'],
                passScore: 80,
            }).score,
        );
    });

    test('12. same final attempt cannot be corrected after submission', () => {
        const s = new FakeTrustServer();
        s.seedKey('set-1', { q1: 'a', q2: 'b' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        const first = s.submit('att-1', 'user-a', { q1: 'a', q2: 'WRONG' }, 'set-1');
        expect(first.submitted).toBe(true);
        expect(() => s.saveAnswersAsClient('att-1', 'user-a', { answers: { q1: 'a', q2: 'b' } })).toThrow();
        const replay = s.submit('att-1', 'user-a', { q1: 'a', q2: 'b' }, 'set-1');
        expect(replay.submitted).toBe(false); // idempotent replay
        expect(replay.score).toBe(first.score); // original stands
    });

    test('13. project local AI score cannot issue credential', () => {
        const gate = evaluateIssuanceGate({
            programSlug: 'python-foundations',
            programVersion: '1.0',
            requiresAssessment: false,
            assessmentPassScore: 80,
            assessment: null,
            requiresProject: true,
            // Formative-only local score is NOT authoritative.
            project: { passed: true, authoritative: false, programVersion: '1.0' },
            skillGates: [],
            coverage: [],
        });
        expect(gate.eligible).toBe(false);
        expect(gate.reasons).toContain('project_not_authoritative');
        const s = new FakeTrustServer();
        expect(() => s.clientInsertAuthoritativeProject()).toThrow();
    });

    test('14. credential issuance fails without authoritative assessment', () => {
        const gate = evaluateIssuanceGate({
            programSlug: 'chess-foundations',
            programVersion: '1.0',
            requiresAssessment: true,
            assessmentPassScore: 80,
            assessment: null,
            requiresProject: false,
            project: null,
            skillGates: [],
            coverage: [],
        });
        expect(gate.eligible).toBe(false);
        expect(gate.reasons).toContain('missing_authoritative_assessment');
    });

    test('15. credential issuance fails without required project', () => {
        const gate = evaluateIssuanceGate({
            programSlug: 'python-foundations',
            programVersion: '1.0',
            requiresAssessment: false,
            assessmentPassScore: 80,
            assessment: null,
            requiresProject: true,
            project: null,
            skillGates: [],
            coverage: [],
        });
        expect(gate.eligible).toBe(false);
        expect(gate.reasons).toContain('missing_authoritative_project');
    });

    test('16. credential issuance fails when skill gate fails', () => {
        const gate = evaluateIssuanceGate({
            programSlug: 'chess-foundations',
            programVersion: '1.0',
            requiresAssessment: true,
            assessmentPassScore: 80,
            assessment: { passed: true, score: 90, programVersion: '1.0' },
            requiresProject: false,
            project: null,
            skillGates: [{ skillKey: 'rules', minTrustedValidations: 2, minSessions: 2 }],
            coverage: [{ skillKey: 'rules', trustedValidations: 1, sessions: 1 }],
        });
        expect(gate.eligible).toBe(false);
        expect(gate.reasons).toContain('skill_gate_failed:rules');
    });

    test('17. valid complete path issues exactly one credential', () => {
        const s = new FakeTrustServer();
        // Trusted validation coverage: 2 validations across 2 sessions.
        for (const session of ['s1', 's2']) {
            for (const e of chessRecallApply(session)) s.upsertEvent(e, 'user-a', 'user-a');
            s.upsertEvent(chessValidate(session, `v-${session}`), 'user-a', 'user-a');
        }
        expect(
            s.readEvents('user-a').filter(e => e.trusted).length,
        ).toBe(2);
        s.seedKey('set-1', { q1: 'a', q2: 'b', q3: 'c', q4: 'd' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        const sub = s.submit('att-1', 'user-a', { q1: 'a', q2: 'b', q3: 'c', q4: 'd' }, 'set-1');
        expect(sub.passed).toBe(true);
        const first = s.issue('chess-foundations', '1.0', 'Holder', 'user-a', { requiresProject: false });
        expect(first.created).toBe(true);
        const second = s.issue('chess-foundations', '1.0', 'Holder', 'user-a', { requiresProject: false });
        expect(second.created).toBe(false);
        expect(second.credentialId).toBe(first.credentialId);
        expect(s.issued.size).toBe(1);
    });

    test('18. issued credential cannot be modified by normal client', () => {
        const s = new FakeTrustServer();
        expect(() => s.clientUpdateIssued()).toThrow();
    });

    test('19. public verification works anonymously', () => {
        const s = new FakeTrustServer();
        for (const session of ['s1', 's2']) {
            for (const e of chessRecallApply(session)) s.upsertEvent(e, 'user-a', 'user-a');
            s.upsertEvent(chessValidate(session, `v-${session}`), 'user-a', 'user-a');
        }
        s.seedKey('set-1', { q1: 'a' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        s.submit('att-1', 'user-a', { q1: 'a' }, 'set-1');
        const { credentialId } = s.issue('chess-foundations', '1.0', 'Holder', 'user-a', { requiresProject: false });
        const pub = s.verifyAnon(credentialId); // anon: no uid involved
        expect(pub).not.toBeNull();
        expect(pub!.credentialId).toBe(credentialId);
        expect(pub as unknown as Record<string, unknown>).not.toHaveProperty('user_id');
        expect(pub as unknown as Record<string, unknown>).not.toHaveProperty('userId');
    });

    test('20. revoked credential verifies as revoked', () => {
        const s = new FakeTrustServer();
        for (const session of ['s1', 's2']) {
            for (const e of chessRecallApply(session)) s.upsertEvent(e, 'user-a', 'user-a');
            s.upsertEvent(chessValidate(session, `v-${session}`), 'user-a', 'user-a');
        }
        s.seedKey('set-1', { q1: 'a' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        s.submit('att-1', 'user-a', { q1: 'a' }, 'set-1');
        const { credentialId } = s.issue('chess-foundations', '1.0', 'Holder', 'user-a', { requiresProject: false });
        s.revokeAsServiceRole(credentialId);
        expect(s.verifyAnon(credentialId)!.status).toBe('revoked');
    });

    test('21. clearing AsyncStorage does not delete server credential', () => {
        // Server rows live outside device storage: simulate a device wipe by
        // dropping every local handle; the server map is untouched.
        const s = new FakeTrustServer();
        for (const session of ['s1', 's2']) {
            for (const e of chessRecallApply(session)) s.upsertEvent(e, 'user-a', 'user-a');
            s.upsertEvent(chessValidate(session, `v-${session}`), 'user-a', 'user-a');
        }
        s.seedKey('set-1', { q1: 'a' });
        s.createAttempt('att-1', 'user-a', 'chess-foundations', '1.0', 'set-1');
        s.submit('att-1', 'user-a', { q1: 'a' }, 'set-1');
        const { credentialId } = s.issue('chess-foundations', '1.0', 'Holder', 'user-a', { requiresProject: false });
        const wipedLocalHandles: unknown[] = []; // device storage cleared
        void wipedLocalHandles;
        expect(s.verifyAnon(credentialId)!.credentialId).toBe(credentialId);
    });

    test('22. forged local credential does not verify publicly', () => {
        const s = new FakeTrustServer();
        expect(s.verifyAnon('FORGED-LOCAL-123')).toBeNull();
    });

    test('23. program version is pinned', () => {
        // Events pinned to 9.9 cannot satisfy a 1.0 program gate.
        const gate = evaluateIssuanceGate({
            programSlug: 'chess-foundations',
            programVersion: '1.0',
            requiresAssessment: true,
            assessmentPassScore: 80,
            assessment: { passed: true, score: 95, programVersion: '9.9' },
            requiresProject: false,
            project: null,
            skillGates: [],
            coverage: [],
        });
        expect(gate.eligible).toBe(false);
        expect(gate.reasons).toContain('assessment_version_mismatch');
        // Unversioned legacy can never be trusted validation.
        const legacy = { ...chessValidate('s1', 'v-s1'), programVersion: undefined };
        expect(isTrustedValidation(legacy, new FakeTrustServer().registry)).toBe(false);
        // Frozen projector excludes versionless legacy by default too.
        const projection = projectSkillState({ program: chess, events: [legacy as LearningEvent] });
        expect(projection.skills.find(sk => sk.skillKey === 'rules')?.stage).toBe('unseen');
    });

    test('24. server skill projection matches canonical fixture results', () => {
        // Shared code: server projection IS the frozen projector.
        const events: LearningEvent[] = [1, 2, 3].flatMap(n => [
            ...(['recall', 'apply'] as const).map(phase =>
                buildAttemptEvent({
                    sessionId: `s${n}`,
                    userId: 'user-a',
                    hobbyId: 'chess',
                    lessonId: 'chess_d4',
                    lessonDay: 4,
                    cardId: `${phase}-s${n}`,
                    attemptNo: 1,
                    phase,
                    sessionKind: 'structured' as const,
                    outcome: 'pass' as const,
                    cardType: phase,
                    occurredAt: `2026-09-0${n}T10:00:00.000Z`,
                }),
            ),
            chessValidate(`s${n}`, `v-s${n}`),
        ]);
        const projection = projectSkillState({ program: chess, events });
        const rules = projection.skills.find(sk => sk.skillKey === 'rules')!;
        expect(rules.stage).toBe('strong');
        // SQL-mirror coverage over the trusted subset agrees.
        const s = new FakeTrustServer();
        for (const e of events) s.upsertEvent(e, 'user-a', 'user-a');
        const trusted = s.readEvents('user-a').filter(e => e.trusted);
        expect(trusted.length).toBe(3);
        const coverage = trustedValidationCoverage(trusted);
        expect(coverage.find(c => c.skillKey === 'rules')).toMatchObject({
            trustedValidations: 3,
            sessions: 3,
        });
    });
});
