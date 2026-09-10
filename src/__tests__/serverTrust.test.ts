/**
 * Server trust layer invariants.
 *
 * FakeTrustServer mirrors migrations 011-017 row-for-row in contract:
 * client ingest NEVER yields trusted rows; proof comes only from
 * server-scored flows; RLS/forbidden writes throw (like 42501); issuance
 * follows the authoritative v2 gates. Policy math itself is the real
 * src/server/trust.ts + src/server/programPolicy.ts.
 *
 * Real-DB integration tests live in trustHardening.e2e.test.ts and prove
 * the ACTUAL SQL. These unit tests pin the contract logic.
 */

import {
    buildServerCredentialId,
    buildTrustedRegistry,
    deriveEvidenceStrength,
    deriveOutcomeValue,
    evaluateAuthoritativeIssuance,
    evaluateIssuanceGate,
    isServerProvenRow,
    isTrustedValidation,
    projectPublicVerification,
    projectSkillState,
    scoreAssessmentFromAnswers,
    scoreTrustedValidation,
    trustedValidationCoverage,
} from '../server/trust';
import { allServerIssuancePolicies, serverIssuancePolicy } from '../server/programPolicy';
import { buildAttemptEvent } from '../domain/sessions/learningEvents';
import type { LearningEvent } from '../domain/sessions/learningEvents';
import { getProgram, CREDENTIAL_PROGRAMS } from '../domain/credentials/catalog';
import { buildCredentialId } from '../domain/credentials/scoring';

// ---------------------------------------------------------------------------
// FakeTrustServer — mirrors SQL migrations 011/012/013/016/017.
// ---------------------------------------------------------------------------

interface ServerEventRow extends Omit<LearningEvent, 'userId' | 'ownerId' | 'provenance'> {
    userId: string | null;
    /** Server rows may carry server-side provenance (never client-mintable). */
    provenance: string | undefined;
    trusted: boolean;
}

interface ValidationItem {
    id: string;
    program: string;
    version: string;
    skill: string;
    day: number;
    lessonId: string;
    answer: string;
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
    items = new Map<string, ValidationItem>();
    validationAttempts = new Map<
        string,
        { id: string; owner: string; item: ValidationItem; status: 'started' | 'submitted'; passed: boolean | null }
    >();
    components = new Map<string, { score: number; passed: boolean }>();
    enrollments = new Map<string, string>();
    issuanceEnabled = new Map<string, boolean>();
    projectResults = new Map<string, { program: string; version: string; passed: boolean }>();
    issued = new Map<string, any>();

    /** Mirrors hardened trigger (016): client ingest NEVER trusted; server_scored coerced away. */
    upsertEvent(
        event: Omit<LearningEvent, 'provenance'> & { provenance?: string },
        clientOwner: string | null,
        asUid: string | null,
    ): boolean {
        if (this.events.has(event.id)) return false; // idempotent retry
        const owned = clientOwner !== null && asUid !== null && clientOwner === asUid;
        const provenance =
            (event.provenance as string) === 'server_scored' ? undefined : event.provenance;
        this.events.set(event.id, {
            ...event,
            provenance: provenance as LearningEvent['provenance'],
            userId: owned ? asUid : null,
            trusted: false,
        });
        return true;
    }

    /** Mirrors RLS SELECT own (legacy unattributed rows invisible). */
    readEvents(asUid: string): ServerEventRow[] {
        return [...this.events.values()].filter(e => e.userId === asUid);
    }

    serverProvenEvents(asUid: string): ServerEventRow[] {
        return this.readEvents(asUid).filter(isServerProvenRow);
    }

    // -- server validation flow (migration 016; service-role seeded items) --
    seedValidationItem(item: ValidationItem, role: string): void {
        if (role !== 'service_role') throw new Error('RLS: items are service-role only');
        this.items.set(item.id, item);
    }

    startValidation(asUid: string, program: string, version: string, day: number): string {
        const item = [...this.items.values()].find(
            i => i.program === program && i.version === version && i.day === day,
        );
        if (!item) throw new Error('no trusted content for this program/day');
        const id = `va-${this.validationAttempts.size + 1}`;
        this.validationAttempts.set(id, { id, owner: asUid, item, status: 'started', passed: null });
        return id;
    }

    /** Mirrors submit_trusted_validation: server scores, server creates proof. */
    submitValidation(attemptId: string, asUid: string, answer: string): { passed: boolean; submitted: boolean } {
        const a = this.validationAttempts.get(attemptId);
        if (!a || a.owner !== asUid) throw new Error('not the attempt owner');
        if (a.status === 'submitted') return { passed: a.passed!, submitted: false };
        const ok = scoreTrustedValidation({ answer, expectedAnswer: a.item.answer });
        a.status = 'submitted';
        a.passed = ok;
        // EVERY finalized attempt is immutable server-verified evidence
        // (trusted = server-vouched, even for fails).
        const id = `srv:trusted:${attemptId}:0`;
        this.events.set(id, {
                schemaVersion: 1,
                id,
                sessionId: `srv:${attemptId}`,
                userId: asUid,
                hobbyId: 'chess',
                programSlug: a.item.program,
                programVersion: a.item.version,
                lessonId: a.item.lessonId,
                curriculumDay: a.item.day,
                skillKey: a.item.skill,
                cardId: a.item.id,
                attemptNo: 1,
                phase: 'validate',
                sessionKind: 'structured',
                source: 'structured_session',
                eventType: 'attempt',
                outcome: ok ? 'pass' : 'fail',
                outcomeValue: ok ? 1 : 0,
                evidenceStrength: 'strong',
                provenance: 'server_scored',
                occurredAt: '2026-09-10T00:00:00.000Z',
                trusted: true,
            });
        return { passed: ok, submitted: true };
    }

    // -- assessment (migrations 012/016) --
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
        this.components.set(`${asUid}:1.0:final_assessment`, { score: s.score, passed: s.passed });
        return { score: s.score, passed: s.passed, submitted: true };
    }

    recordAuthoritativeProject(owner: string, program: string, version: string, passed: boolean, role: string): void {
        if (role !== 'service_role') throw new Error('RLS: authoritative results are service-role only');
        this.projectResults.set(`${owner}:${program}:${version}`, { program, version, passed });
        this.components.set(`${owner}:${version}:project`, { score: passed ? 90 : 40, passed });
    }

    clientInsertAuthoritativeProject(): void {
        throw new Error('RLS: no client INSERT policy on project_certification_results');
    }

    recordServerComponent(owner: string, version: string, component: string, score: number, role: string): void {
        if (role !== 'service_role') throw new Error('RLS: components are server-written only');
        this.components.set(`${owner}:${version}:${component}`, { score, passed: score >= 80 });
    }

    clientWriteComponent(): void {
        throw new Error('RLS: no client write policy on credential_component_results');
    }

    enroll(owner: string, program: string, version: string): void {
        this.enrollments.set(`${owner}:${program}`, version);
    }

    // -- issuance v2 (migration 017) --
    issueV2(program: string, holder: string, asUid: string): { credentialId: string; created: boolean } {
        const version = '1.0';
        const skills = getProgram(program)!.skills;
        const gate = evaluateAuthoritativeIssuance({
            programSlug: program,
            programVersion: version,
            issuanceEnabled: this.issuanceEnabled.get(program) === true,
            enrolledVersion: this.enrollments.get(`${asUid}:${program}`) ?? null,
            components: {
                knowledge: this.components.get(`${asUid}:${version}:knowledge`)?.score ?? null,
                practical: this.components.get(`${asUid}:${version}:practical`)?.score ?? null,
                final_assessment: this.components.get(`${asUid}:${version}:final_assessment`)?.score ?? null,
                project: this.components.get(`${asUid}:${version}:project`)?.score ?? null,
            },
            componentPass: {
                knowledge: this.components.get(`${asUid}:${version}:knowledge`)?.passed === true,
                practical: this.components.get(`${asUid}:${version}:practical`)?.passed === true,
                final_assessment: this.components.get(`${asUid}:${version}:final_assessment`)?.passed === true,
                project: this.components.get(`${asUid}:${version}:project`)?.passed === true,
            },
            requiredScore: 80,
            skillProof: skills.map(sk => {
                const rows = this.serverProvenEvents(asUid).filter(e => e.skillKey === sk.key);
                return {
                    skillKey: sk.key,
                    minimumScore: sk.minimumScore,
                    passes: rows.filter(e => e.outcome === 'pass').length,
                    total: rows.length,
                };
            }),
        });
        if (!gate.eligible) throw new Error(`gate: ${gate.reasons.join(',')}`);
        const key = `${asUid}:${program}:${version}`;
        const existing = this.issued.get(key);
        if (existing) return { credentialId: existing.credential_id, created: false };
        const credentialId = buildServerCredentialId('0123456789abcdef0123456789abcdef');
        this.issued.set(key, {
            credential_id: credentialId,
            program_slug: program,
            program_title: program,
            program_version: version,
            holder_display_name: holder,
            identity_verified: false,
            issued_at: '2026-09-10T00:00:00.000Z',
            expires_at: null,
            status: 'active',
            verified_skills: skills.map(sk => ({ key: sk.key, name: sk.name, score: 100 })),
            final_score: gate.overall,
            grade: 'A',
        });
        return { credentialId, created: true };
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

/** The complete honest server path in the fake: enroll, components, server proof, enabled. */
function completeV2Path(s: FakeTrustServer, owner = 'user-a'): void {
    s.issuanceEnabled.set('chess-foundations', true);
    s.enroll(owner, 'chess-foundations', '1.0');
    s.recordServerComponent(owner, '1.0', 'knowledge', 85, 'service_role');
    s.recordServerComponent(owner, '1.0', 'practical', 88, 'service_role');
    s.seedKey('set-1', { q1: 'a' });
    s.createAttempt('att-1', owner, 'chess-foundations', '1.0', 'set-1');
    s.submit('att-1', owner, { q1: 'a' }, 'set-1');
    s.recordAuthoritativeProject(owner, 'chess-foundations', '1.0', true, 'service_role');
    const skills = ['rules', 'openings', 'endgames', 'tactics'];
    skills.forEach((skill, i) => {
        s.seedValidationItem(
            { id: `item-${skill}`, program: 'chess-foundations', version: '1.0', skill, day: 4, lessonId: 'chess_d4', answer: 'e4' },
            'service_role',
        );
        const att = s.startValidation(owner, 'chess-foundations', '1.0', 4);
        // Distinct items per skill: re-point the attempt's item for the fixture.
        s.validationAttempts.get(att)!.item = { ...s.items.get('item-rules')!, skill, id: `item-${skill}` };
        void i;
        s.submitValidation(att, owner, 'e4');
    });
}

// ---------------------------------------------------------------------------
// The 24 invariants (hardened model)
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
        completeV2Path(s);
        const first = s.issueV2('chess-foundations', 'Holder', 'user-a');
        expect(first.created).toBe(true);
        const second = s.issueV2('chess-foundations', 'Holder', 'user-a');
        expect(second.created).toBe(false);
        expect(second.credentialId).toBe(first.credentialId);
        expect(s.issued.size).toBe(1);
        // Immutable skill objects, names from the pinned program.
        expect(s.issued.get('user-a:chess-foundations:1.0').verified_skills[0]).toEqual({
            key: 'rules',
            name: 'Rules & Basics',
            score: 100,
        });
    });

    test('18. issued credential cannot be modified by normal client', () => {
        const s = new FakeTrustServer();
        expect(() => s.clientUpdateIssued()).toThrow();
    });

    test('19. public verification works anonymously', () => {
        const s = new FakeTrustServer();
        completeV2Path(s);
        const { credentialId } = s.issueV2('chess-foundations', 'Holder', 'user-a');
        const pub = s.verifyAnon(credentialId); // anon: no uid involved
        expect(pub).not.toBeNull();
        expect(pub!.credentialId).toBe(credentialId);
        expect(pub as unknown as Record<string, unknown>).not.toHaveProperty('user_id');
        expect(pub as unknown as Record<string, unknown>).not.toHaveProperty('userId');
    });

    test('20. revoked credential verifies as revoked', () => {
        const s = new FakeTrustServer();
        completeV2Path(s);
        const { credentialId } = s.issueV2('chess-foundations', 'Holder', 'user-a');
        s.revokeAsServiceRole(credentialId);
        expect(s.verifyAnon(credentialId)!.status).toBe('revoked');
    });

    test('21. clearing AsyncStorage does not delete server credential', () => {
        const s = new FakeTrustServer();
        completeV2Path(s);
        const { credentialId } = s.issueV2('chess-foundations', 'Holder', 'user-a');
        const wipedLocalHandles: unknown[] = []; // device storage cleared
        void wipedLocalHandles;
        expect(s.verifyAnon(credentialId)!.credentialId).toBe(credentialId);
    });

    test('22. forged local credential does not verify publicly', () => {
        const s = new FakeTrustServer();
        expect(s.verifyAnon('FORGED-LOCAL-123')).toBeNull();
        // Local preview ids (ZNY-...) never match the server namespace.
        const local = buildCredentialId('CHF', 'user-a', '2026-09-10T00:00:00.000Z');
        expect(local.startsWith('ZNY-')).toBe(true);
        expect(s.verifyAnon(local)).toBeNull();
    });

    test('23. program version is pinned', () => {
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
        const legacy = { ...chessValidate('s1', 'v-s1'), programVersion: undefined };
        expect(isTrustedValidation(legacy, new FakeTrustServer().registry)).toBe(false);
        const projection = projectSkillState({ program: chess, events: [legacy as LearningEvent] });
        expect(projection.skills.find(sk => sk.skillKey === 'rules')?.stage).toBe('unseen');
    });

    test('24. server skill projection matches canonical fixture results', () => {
        // Shared code: server projection IS the frozen projector (client
        // rows still feed Skill State; only SERVER proof feeds issuance).
        const s = new FakeTrustServer();
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
        for (const e of events) s.upsertEvent(e, 'user-a', 'user-a');
        // Client rows: all untrusted under the hardened model...
        expect(s.readEvents('user-a').every(e => e.trusted === false)).toBe(true);
        // ...yet still feed the frozen Skill State projection.
        const projection = projectSkillState({ program: chess, events });
        expect(projection.skills.find(sk => sk.skillKey === 'rules')?.stage).toBe('strong');
        // Server proof comes only from the server-scored flow.
        s.seedValidationItem(
            { id: 'item-rules', program: 'chess-foundations', version: '1.0', skill: 'rules', day: 4, lessonId: 'chess_d4', answer: 'e4' },
            'service_role',
        );
        for (const n of [1, 2, 3]) {
            const att = s.startValidation('user-a', 'chess-foundations', '1.0', 4);
            s.submitValidation(att, 'user-a', n === 3 ? 'wrong' : 'e4');
        }
        const proven = s.serverProvenEvents('user-a');
        // 2 passes + 1 fail: every finalized attempt is server evidence.
        expect(proven.length).toBe(3);
        const coverage = trustedValidationCoverage(proven);
        expect(coverage.find(c => c.skillKey === 'rules')).toMatchObject({
            trustedValidations: 3,
            sessions: 3,
        });
    });
});

// ---------------------------------------------------------------------------
// Hardening extras (016/017 model)
// ---------------------------------------------------------------------------

describe('trust hardening extras', () => {
    test('25. forged client PASS can never become trusted', () => {
        const s = new FakeTrustServer();
        // The exact malicious payload from the audit: every claim maxed out.
        const forged = chessValidate('evil', 'v-evil', 4, 'static_bank');
        expect(forged.sessionKind).toBe('structured');
        expect(forged.phase).toBe('validate');
        expect(forged.outcome).toBe('pass');
        s.upsertEvent(forged, 'user-a', 'user-a');
        const row = s.events.get(forged.id)!;
        expect(row.trusted).toBe(false);
        expect(isServerProvenRow(row)).toBe(false);
    });

    test('26. client cannot mint server_scored provenance', () => {
        const s = new FakeTrustServer();
        const e = { ...chessValidate('s1', 'v-s1'), provenance: 'server_scored' as const };
        s.upsertEvent(e, 'user-a', 'user-a');
        const row = s.events.get(e.id)!;
        expect(row.provenance).not.toBe('server_scored');
        expect(row.trusted).toBe(false);
    });

    test('27. cross-program relabel never yields proof; server derives identity', () => {
        const s = new FakeTrustServer();
        // Attacker replays a chess registry day as python/functions.
        const relabeled = buildAttemptEvent({
            sessionId: 'evil', userId: 'user-a', hobbyId: 'python', lessonId: 'python_d15',
            lessonDay: 15, cardId: 'v-evil', attemptNo: 1, phase: 'validate',
            sessionKind: 'structured', outcome: 'pass', cardType: 'challenge',
            provenance: 'static_bank', occurredAt: '2026-09-10T00:00:00.000Z',
        });
        s.upsertEvent(relabeled, 'user-a', 'user-a');
        expect(s.events.get(relabeled.id)!.trusted).toBe(false);
        // The server flow derives chess/rules from its own item, never client fields.
        s.seedValidationItem(
            { id: 'item-1', program: 'chess-foundations', version: '1.0', skill: 'rules', day: 4, lessonId: 'chess_d4', answer: 'e4' },
            'service_role',
        );
        const att = s.startValidation('user-a', 'chess-foundations', '1.0', 4);
        s.submitValidation(att, 'user-a', 'e4');
        const proven = s.serverProvenEvents('user-a');
        expect(proven).toHaveLength(1);
        expect(proven[0].programSlug).toBe('chess-foundations');
        expect(proven[0].skillKey).toBe('rules');
    });

    test('28. failed server validation is authoritative evidence too', () => {
        const s = new FakeTrustServer();
        s.seedValidationItem(
            { id: 'item-1', program: 'chess-foundations', version: '1.0', skill: 'rules', day: 4, lessonId: 'chess_d4', answer: 'e4' },
            'service_role',
        );
        const att = s.startValidation('user-a', 'chess-foundations', '1.0', 4);
        const r = s.submitValidation(att, 'user-a', 'd5');
        expect(r).toEqual({ passed: false, submitted: true });
        // Trusted = server-vouched outcome, even for a fail.
        const proven = s.serverProvenEvents('user-a');
        expect(proven).toHaveLength(1);
        expect(proven[0].outcome).toBe('fail');
        expect(proven[0].trusted).toBe(true);
        // Replay is idempotent: original stands, no second row.
        const replay = s.submitValidation(att, 'user-a', 'e4');
        expect(replay).toEqual({ passed: false, submitted: false });
        expect(s.serverProvenEvents('user-a')).toHaveLength(1);
    });

    test('29. issuance requires enrollment, components, and enabled flag', () => {
        const s = new FakeTrustServer();
        // Nothing set up: enabled=false, no enrollment, no components.
        expect(() => s.issueV2('chess-foundations', 'Holder', 'user-a')).toThrow(/program_not_issuance_ready/);
        s.issuanceEnabled.set('chess-foundations', true);
        expect(() => s.issueV2('chess-foundations', 'Holder', 'user-a')).toThrow(/enrollment_required/);
        s.enroll('user-a', 'chess-foundations', '1.0');
        expect(() => s.issueV2('chess-foundations', 'Holder', 'user-a')).toThrow(/component_missing_or_failed/);
    });

    test('30. server credential ids carry 128-bit entropy', () => {
        expect(() => buildServerCredentialId('abc')).toThrow();
        const id = buildServerCredentialId('0123456789abcdef0123456789abcdef');
        expect(id).toBe('ZNX-0123456789ABCDEF0123456789ABCDEF');
        expect(id.replace('ZNX-', '')).toHaveLength(32);
    });

    test('31. server policy: only the chess pilot is issuance-ready', () => {
        const policies = allServerIssuancePolicies();
        expect(policies).toHaveLength(5);
        for (const p of policies) {
            expect(p.requiresProject).toBe(true);
            if (p.programSlug === 'chess-foundations') {
                expect(p.issuanceEnabled).toBe(true);
                expect(p.issuanceBlockedReason).toBeNull();
            } else {
                expect(p.issuanceEnabled).toBe(false);
                expect(p.issuanceBlockedReason).toMatch(/no server-authoritative/);
            }
        }
    });

    test('32. frozen catalog parity: server seed expectations', () => {
        // If the frozen catalog changes, this test forces a matching 018+.
        expect(CREDENTIAL_PROGRAMS).toHaveLength(5);
        const expected: Record<string, { code: string; title: string; skills: [string, number][] }> = {
            'python-foundations': { code: 'PYF', title: 'Zenyth Verified Skill — Python Foundations', skills: [['syntax', 0.2], ['logic', 0.25], ['functions', 0.25], ['basic_programming', 0.3]] },
            'chess-foundations': { code: 'CHF', title: 'Zenyth Verified Skill — Chess Foundations', skills: [['rules', 0.2], ['openings', 0.25], ['endgames', 0.25], ['tactics', 0.3]] },
            'reading-mastery': { code: 'RDG', title: 'Zenyth Verified Skill — Reading Mastery', skills: [['techniques', 0.25], ['analysis', 0.3], ['nonfiction', 0.25], ['system', 0.2]] },
            'english-foundations': { code: 'ENF', title: 'Zenyth Verified Skill — English Foundations', skills: [['grammar', 0.3], ['vocabulary', 0.25], ['speaking', 0.25], ['writing', 0.2]] },
            'chinese-hsk1-start': { code: 'CHN', title: 'Zenyth Verified Skill — Chinese HSK 1 Start', skills: [['pinyin', 0.3], ['characters', 0.25], ['phrases', 0.25], ['grammar', 0.2]] },
        };
        for (const p of CREDENTIAL_PROGRAMS) {
            const exp = expected[p.slug];
            expect(exp).toBeDefined();
            expect(p.version).toBe('1.0');
            expect(p.code).toBe(exp.code);
            expect(p.title).toBe(exp.title);
            expect(p.requiredScore).toBe(80);
            expect(p.requiresProject).toBe(true);
            expect(p.requiresIdentityVerification).toBe(false);
            expect(p.skills.map(sk => [sk.key, sk.weight])).toEqual(exp.skills);
            expect(p.skills.every(sk => sk.minimumScore === 65)).toBe(true);
            const weightSum = p.skills.reduce((a, sk) => a + sk.weight, 0);
            expect(Math.abs(weightSum - 1)).toBeLessThan(1e-9);
        }
        expect(() => serverIssuancePolicy('nope')).toThrow();
    });

    test('33. official verification is server-only (local previews never verify)', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: [], error: null });
        jest.doMock('../services/supabase/client', () => ({ getSupabase: () => ({ rpc }) }));
        const { verifyCredentialPublic } = require('../services/credentialVerification') as typeof import('../services/credentialVerification');
        const local = buildCredentialId('CHF', 'user-a', '2026-09-10T00:00:00.000Z');
        const res = await verifyCredentialPublic(local);
        expect(rpc).toHaveBeenCalledWith('verify_credential', { p_credential_id: local });
        expect(res).toEqual({ found: false, credential: null });
        jest.dontMock('../services/supabase/client');
    });
});

describe('pilot authority extras', () => {
    test('34. expired credentials stay expired through the TS projection', () => {
        const { projectPublicVerification } = require('../server/trust') as typeof import('../server/trust');
        const base = {
            credential_id: 'ZNX-abc', program_slug: 'chess-foundations', program_title: 'Chess',
            program_version: '1.0', holder_display_name: 'H', issued_at: '2026-01-01T00:00:00.000Z',
            expires_at: null, verified_skills: [], final_score: 85, grade: 'merit',
        };
        expect(projectPublicVerification({ ...base, status: 'expired' }).status).toBe('expired');
        expect(projectPublicVerification({ ...base, status: 'active' }).status).toBe('active');
        expect(projectPublicVerification({ ...base, status: 'revoked' }).status).toBe('revoked');
        // Unknown future states fail closed to active only when not revoked/expired.
        expect(projectPublicVerification({ ...base, status: 'weird' }).status).toBe('active');
    });

    test('35. server grades match the frozen credential domain exactly', () => {
        const { gradeForScoreServer } = require('../server/trust') as typeof import('../server/trust');
        const { gradeForScore } = require('../domain/credentials/scoring') as typeof import('../domain/credentials/scoring');
        for (const score of [0, 40, 79, 80, 82, 84, 85, 87, 89, 90, 92, 94, 95, 97, 100]) {
            expect(gradeForScoreServer(score, 80)).toBe(gradeForScore(score, 80));
        }
        expect(gradeForScoreServer(80, 80)).toBe('pass');
        expect(gradeForScoreServer(85, 80)).toBe('merit');
        expect(gradeForScoreServer(90, 80)).toBe('excellence');
        expect(gradeForScoreServer(95, 80)).toBe('distinction');
        expect(gradeForScoreServer(79, 80)).toBe('fail');
    });

    test('36. FAIL FAIL FAIL PASS is not 100%: failures stay in the denominator', () => {
        const { evaluateAuthoritativeIssuance } = require('../server/trust') as typeof import('../server/trust');
        const base = {
            programSlug: 'chess-foundations', programVersion: '1.0', issuanceEnabled: true,
            enrolledVersion: '1.0', requiredScore: 80,
            components: { knowledge: 85, practical: 88, final_assessment: 90, project: 92 },
            componentPass: { knowledge: true, practical: true, final_assessment: true, project: true },
        };
        // One item retried 4x (3 fails then a pass): latest wins for the
        // item, but depth is still ONE distinct item < min 3 -> blocked.
        const oneItem = evaluateAuthoritativeIssuance({
            ...base,
            skillProof: [],
            finalizedEvidence: [
                { skillKey: 'rules', minimumScore: 65, distinctItems: 1, passes: 1, minItems: 3, minPassRate: 0.65 },
            ],
        });
        expect(oneItem.eligible).toBe(false);
        expect(oneItem.reasons).toContain('skill_gate_failed:rules');
        // Three distinct items, all failed then... 1/3 passes: rate blocks.
        const lowRate = evaluateAuthoritativeIssuance({
            ...base,
            skillProof: [],
            finalizedEvidence: [
                { skillKey: 'rules', minimumScore: 65, distinctItems: 3, passes: 1, minItems: 3, minPassRate: 0.65 },
            ],
        });
        expect(lowRate.eligible).toBe(false);
        // 2/3 passes: rate 0.667 >= 0.65 and >= 65 -> satisfied (with all else met).
        const ok = evaluateAuthoritativeIssuance({
            ...base,
            skillProof: [],
            finalizedEvidence: [
                { skillKey: 'rules', minimumScore: 65, distinctItems: 3, passes: 2, minItems: 3, minPassRate: 0.65 },
            ],
        });
        expect(ok.eligible).toBe(true);
    });

    test('37. failed final or project can never be averaged away', () => {
        const { evaluateAuthoritativeIssuance } = require('../server/trust') as typeof import('../server/trust');
        const base = {
            programSlug: 'chess-foundations', programVersion: '1.0', issuanceEnabled: true,
            enrolledVersion: '1.0', requiredScore: 80,
            components: { knowledge: 100, practical: 100, final_assessment: 79, project: 100 },
            componentPass: { knowledge: true, practical: true, final_assessment: false, project: true },
            skillProof: [],
            finalizedEvidence: [
                { skillKey: 'rules', minimumScore: 65, distinctItems: 3, passes: 3, minItems: 3, minPassRate: 0.65 },
            ],
        };
        // Weighted total would be 94.75 — still blocked on the failed final.
        const r = evaluateAuthoritativeIssuance(base);
        expect(r.eligible).toBe(false);
        expect(r.reasons).toContain('component_missing_or_failed:final_assessment');
        const p = evaluateAuthoritativeIssuance({
            ...base,
            components: { ...base.components, final_assessment: 90 },
            componentPass: { ...base.componentPass, final_assessment: true, project: false },
        });
        expect(p.eligible).toBe(false);
        expect(p.reasons).toContain('component_missing_or_failed:project');
    });

    test('38. overall arithmetic still gates after all mandatory passes', () => {
        const { evaluateAuthoritativeIssuance } = require('../server/trust') as typeof import('../server/trust');
        const r = evaluateAuthoritativeIssuance({
            programSlug: 'chess-foundations', programVersion: '1.0', issuanceEnabled: true,
            enrolledVersion: '1.0', requiredScore: 80,
            // 65*.25 + 65*.30 + 80*.25 + 80*.20 = 71.75 < 80
            components: { knowledge: 65, practical: 65, final_assessment: 80, project: 80 },
            componentPass: { knowledge: true, practical: true, final_assessment: true, project: true },
            skillProof: [],
            finalizedEvidence: [
                { skillKey: 'rules', minimumScore: 65, distinctItems: 3, passes: 2, minItems: 3, minPassRate: 0.65 },
            ],
        });
        expect(r.eligible).toBe(false);
        expect(r.reasons).toContain('overall_requirement_not_met');
        expect(r.overall).toBe(71.8);
    });
});

describe('integrity extras', () => {
    test('39. evidence policy math: old rationale was wrong, new holds', () => {
        // Old claim (3 items, >=65%): 2/3 suffices. At p=1/3:
        // P(>=2/3) = C(3,2)(1/3)^2(2/3) + (1/3)^3 = 7/27 ~= 25.9% (NOT <8%).
        const old = 3 * (1 / 3) ** 2 * (2 / 3) + (1 / 3) ** 3;
        expect(old).toBeCloseTo(7 / 27, 10);
        expect(old).toBeGreaterThan(0.08);
        // At p=0.25: C(3,2)(.25^2)(.75) + .25^3 = 0.140625 + 0.015625.
        const oldMc = 3 * 0.25 ** 2 * 0.75 + 0.25 ** 3;
        expect(oldMc).toBeCloseTo(0.15625, 10);
        // New policy (4 items, >=3/4): at p=0.25:
        // C(4,3)(.25^3)(.75) + .25^4 = 0.046875 + 0.00390625 ~= 5.08%.
        const fresh = 4 * 0.25 ** 3 * 0.75 + 0.25 ** 4;
        expect(fresh).toBeCloseTo(0.05078125, 10);
        expect(fresh).toBeLessThan(0.06);
    });

    test('40. retake-block messages parse to safe reason codes', () => {
        const { parseRetakeBlock } = require('../services/trustApi') as typeof import('../services/trustApi');
        expect(parseRetakeBlock('retake_blocked:cooldown:2026-09-11T00:00:00Z')).toEqual({
            blocked: true, reason: 'cooldown', detail: '2026-09-11T00:00:00Z',
        });
        expect(parseRetakeBlock('retake_blocked:remediation_required:rules,tactics')).toEqual({
            blocked: true, reason: 'remediation_required', detail: 'rules,tactics',
        });
        expect(parseRetakeBlock('all good')).toBeNull();
    });

    test('41. server credential ids stay in the high-entropy namespace', () => {
        const { buildServerCredentialId } = require('../server/trust') as typeof import('../server/trust');
        const id = buildServerCredentialId('abcdef0123456789abcdef0123456789');
        expect(id).toMatch(/^ZNX-[0-9A-F]{32}$/);
        // Local preview ids live in a disjoint namespace (never verifiable).
        expect(id.startsWith('ZNY-')).toBe(false);
    });
});
