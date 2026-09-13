/**
 * Credential enrollment truth unification — regression contracts.
 *
 * Canonical rule (see domain/credentials/enrollmentTruth.ts):
 *   PROGRAM IDENTITY: programSlug
 *   PROGRAM VERSION: server-pinned current credential_programs.version
 *   ENROLLMENT AUTHORITY: server (user_credential_progress row)
 *   LOCAL credentialStore.programs[slug]: historical/local cache ONLY
 *
 * Covers scenarios A–G: stale flags cannot override server truth, the CTA
 * uses the existing server ensureEnrollment path with no optimistic fake
 * enrollment, per-program buckets survive hobby changes untouched, issued
 * credentials stay independent, and Hub + Detail agree per program.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
    fetchServerEnrollment,
    resolveAuthoritativeEnrolled,
} from '../domain/credentials/enrollmentTruth';
import { useCredentialStore } from '../store/credentialStore';

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const HUB = 'src/screens/CredentialsScreen.tsx';
const DETAIL = 'src/screens/CredentialDetailScreen.tsx';

const stubDeps = (opts: {
    availability?: Array<{ slug: string; issuable: boolean; programVersion: string | null }>;
    availabilityThrows?: boolean;
    progress?: Record<string, unknown | null>;
    progressThrowsFor?: string[];
    calls?: { progressArgs: Array<[string, string]> };
}) => ({
    getProgramAvailability: async () => {
        if (opts.availabilityThrows) throw new Error('offline');
        return (
            opts.availability ?? [
                { slug: 'chess-foundations', issuable: true, programVersion: 'v3' },
                { slug: 'reading-mastery', issuable: true, programVersion: 'v1' },
            ]
        );
    },
    getCredentialProgress: async (slug: string, version: string) => {
        opts.calls?.progressArgs.push([slug, version]);
        if (opts.progressThrowsFor?.includes(slug)) throw new Error('offline');
        return opts.progress?.[slug] ?? null;
    },
});

describe('canonical enrollment rule (scenarios A, B)', () => {
    it('A: server enrolled + stale local/false → enrolled', () => {
        expect(resolveAuthoritativeEnrolled('enrolled')).toBe(true);
    });

    it('B: local true but server unenrolled → NOT enrolled', () => {
        // The local flag is not even an input: it cannot override the server.
        expect(resolveAuthoritativeEnrolled('unenrolled')).toBe(false);
    });

    it('unknown server state claims nothing in either direction', () => {
        expect(resolveAuthoritativeEnrolled('unknown')).toBeNull();
        expect(resolveAuthoritativeEnrolled(undefined)).toBeNull();
    });
});

describe('server enrollment read (version-pinned, fail-soft)', () => {
    it('enrolled iff a current-version progress row exists; version is pinned per slug', async () => {
        const calls: { progressArgs: Array<[string, string]> } = { progressArgs: [] };
        const out = await fetchServerEnrollment(
            ['chess-foundations', 'reading-mastery'],
            stubDeps({
                calls,
                progress: { 'chess-foundations': { status: 'active' }, 'reading-mastery': null },
            }),
        );
        expect(out).toEqual({ 'chess-foundations': 'enrolled', 'reading-mastery': 'unenrolled' });
        // Version pin: each slug read with ITS current server version.
        expect(calls.progressArgs).toContainEqual(['chess-foundations', 'v3']);
        expect(calls.progressArgs).toContainEqual(['reading-mastery', 'v1']);
    });

    it('transport failures resolve to unknown, never to a guess', async () => {
        expect(
            await fetchServerEnrollment(['chess-foundations'], stubDeps({ availabilityThrows: true })),
        ).toEqual({});
        expect(
            await fetchServerEnrollment(
                ['chess-foundations', 'reading-mastery'],
                stubDeps({ progressThrowsFor: ['reading-mastery'] }),
            ),
        ).toEqual({ 'chess-foundations': 'unenrolled', 'reading-mastery': 'unknown' });
    });

    it('non-issuable or version-less programs resolve to unknown', async () => {
        const out = await fetchServerEnrollment(
            ['chess-foundations', 'ghost-program'],
            stubDeps({
                availability: [
                    { slug: 'chess-foundations', issuable: false, programVersion: 'v3' },
                    { slug: 'other', issuable: true, programVersion: null },
                ],
                progress: { 'chess-foundations': { status: 'active' } },
            }),
        );
        expect(out).toEqual({ 'chess-foundations': 'unknown', 'ghost-program': 'unknown' });
    });
});

describe('per-program bucket isolation (scenario D)', () => {
    const before = useCredentialStore.getState().programs;

    afterEach(() => {
        useCredentialStore.setState({ programs: before });
    });

    it('Chess → Reading → Chess: buckets survive separately, nothing crosses', () => {
        const store = () => useCredentialStore.getState();
        // Chess leg: enroll + record answers + remediation in the chess bucket.
        store().enroll('chess-foundations');
        store().recordAssessmentAnswers('chess-foundations', [{} as any]);
        store().recordRemediation('chess-foundations', 'tactics', 2);
        // Reading leg: its own bucket starts pristine.
        expect(store().programs['reading-mastery']).toBeUndefined();
        store().enroll('reading-mastery');
        // Return to Chess: chess state intact, reading untouched by chess writes.
        expect(store().programs['chess-foundations']?.enrolled).toBe(true);
        expect(store().programs['chess-foundations']?.storedAnswers).toHaveLength(1);
        expect(store().programs['chess-foundations']?.remediationDone).toEqual({ tactics: 2 });
        expect(store().programs['reading-mastery']?.enrolled).toBe(true);
        expect(store().programs['reading-mastery']?.storedAnswers).toHaveLength(0);
        expect(store().programs['reading-mastery']?.remediationDone).toEqual({});
    });
});

describe('no local-only enrollment authority (scenarios C, G)', () => {
    it.each([HUB, DETAIL])('%s gates on server truth and enrolls via server', (rel: string) => {
        const src = readSrc(rel);
        // Both screens share the one server-backed read-model…
        expect(src).toMatch(/useServerEnrollment/);
        expect(src).toMatch(/resolveAuthoritativeEnrolled/);
        // …and the CTA uses the existing server path, awaited…
        expect(src).toMatch(/await ensureEnrollment\(/);
        // …with the local mirror written only AFTER server confirmation…
        expect(src).toMatch(/getState\(\)\.enroll\(/);
        expect(src.indexOf('await ensureEnrollment(')).toBeLessThan(src.indexOf('getState().enroll('));
        // …and the local flag is never subscribed as authority.
        expect(src).not.toMatch(/s\s*=>\s*s\.enroll/);
    });

    it('local learning projection stays server-free (never authority by construction)', () => {
        const src = readSrc('src/hooks/useCertificateProgress.ts');
        // No server import or server call (doc comments may name the
        // authoritative modules; code must never touch them).
        expect(src).not.toMatch(
            /from '.*trustApi'|require\(.*trustApi|useCredentialJourney\(|ensureEnrollment\(|useServerEnrollment\(/,
        );
    });
});

describe('hobby change stays non-destructive (scenario E)', () => {
    it('HobbySelectionScreen.handleContinue touches no credential state', () => {
        const src = readSrc('src/screens/HobbySelectionScreen.tsx');
        expect(src).not.toMatch(/credentialStore|resetProgram|resetForUserChange|unenroll|ensureEnrollment/);
        expect(src).not.toMatch(/programs\[/);
    });
});

describe('issued credential independence (scenario F)', () => {
    it('public verification never reads the local store', () => {
        const src = readSrc('src/services/credentialVerification.ts');
        expect(src).not.toMatch(/from '.*credentialStore'|require\(.*credentialStore/);
        expect(src).toMatch(/verify_credential/);
    });

    it('Detail renders issued state from server status, never local math', () => {
        const src = readSrc(DETAIL);
        expect(src).toMatch(/getCredentialStatus\(slug\)/);
        expect(src).toMatch(/status\.state === 'issued'/);
    });
});
