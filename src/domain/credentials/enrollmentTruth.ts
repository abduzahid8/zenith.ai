/**
 * Canonical enrollment truth (credential enrollment unification).
 *
 * PROGRAM IDENTITY: programSlug.
 * PROGRAM VERSION: server-pinned current credential_programs.version.
 * ENROLLMENT AUTHORITY: server (user_credential_progress row for slug+version).
 * LOCAL credentialStore.programs[slug]: historical/local cache ONLY — never authority.
 *
 * UI must NOT use local programs[slug].enrolled to decide whether the
 * current program is enrolled/locked/ready. Authoritative UI state comes
 * from the server-backed read below (same version-pinned source the
 * credential journey uses).
 *
 * This module is intentionally dependency-free so the rule is unit-testable
 * without Supabase. useServerEnrollment injects the real server readers;
 * screens consume the hook, never trustApi enrollment reads directly.
 */

/** Server enrollment for one program/version. 'unknown' = claim nothing. */
export type ServerEnrollmentStatus = 'enrolled' | 'unenrolled' | 'unknown';

/**
 * Canonical enrollment rule. The server decides; the local flag is a
 * cache-only mirror and must never override the server answer for the same
 * program. Returns null when the server state is unknown: the UI must show
 * a neutral loading state, never an enrollment claim in either direction.
 */
export function resolveAuthoritativeEnrolled(
    server: ServerEnrollmentStatus | undefined,
): boolean | null {
    if (server === 'enrolled') return true;
    if (server === 'unenrolled') return false;
    return null;
}

export interface EnrollmentServerDeps {
    getProgramAvailability: () => Promise<
        Array<{ slug: string; issuable: boolean; programVersion: string | null }>
    >;
    getCredentialProgress: (
        programSlug: string,
        programVersion: string,
    ) => Promise<unknown>;
}

/**
 * Server enrollment read for a set of program slugs, each pinned to its
 * current server version (same pinning the credential journey uses: an
 * old-version progress row is NOT enrollment in the current journey).
 * Fail-soft per program: any transport or data failure resolves to
 * 'unknown' (claim nothing), never to a guess. Never touches local stores.
 */
export async function fetchServerEnrollment(
    slugs: string[],
    deps: EnrollmentServerDeps,
): Promise<Record<string, ServerEnrollmentStatus>> {
    const out: Record<string, ServerEnrollmentStatus> = {};
    let programs: Array<{ slug: string; issuable: boolean; programVersion: string | null }>;
    try {
        programs = await deps.getProgramAvailability();
    } catch {
        // Entirely unknown: caller renders neutral loading, never authority.
        return out;
    }
    await Promise.all(
        slugs.map(async slug => {
            try {
                const entry = programs.find(p => p.slug === slug);
                if (!entry || entry.issuable !== true || entry.programVersion == null) {
                    out[slug] = 'unknown';
                    return;
                }
                const progress = await deps.getCredentialProgress(slug, entry.programVersion);
                out[slug] = progress !== null ? 'enrolled' : 'unenrolled';
            } catch {
                out[slug] = 'unknown';
            }
        }),
    );
    return out;
}
