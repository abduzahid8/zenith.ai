/**
 * Server credential policy — derived from the FROZEN catalog, never a
 * second definition. The single source of record for program shape
 * (slug/code/title/skills/requirements) is
 * src/domain/credentials/catalog.ts; this module adds ONLY the server
 * authority posture on top: which components are required, their frozen
 * weights, and whether issuance is currently enabled.
 *
 * Honest end-state: issuance_enabled is FALSE for every program until
 * server-authoritative trusted content AND component sources exist for
 * it. "Not yet issuable" (false negative) is acceptable; issuing an
 * unproven credential (false positive) is not.
 */

import { CREDENTIAL_PROGRAMS } from '../domain/credentials/catalog';
import type { CredentialProgram } from '../domain/credentials/types';

/** Frozen final-score weights (src/domain/credentials/scoring.ts). */
export const COMPONENT_WEIGHTS = {
    knowledge: 0.25,
    practical: 0.3,
    final_assessment: 0.25,
    project: 0.2,
} as const;

export type CredentialComponent = keyof typeof COMPONENT_WEIGHTS;

export const REQUIRED_COMPONENTS: CredentialComponent[] = [
    'knowledge',
    'practical',
    'final_assessment',
    'project',
];

export interface ServerIssuancePolicy {
    programSlug: string;
    programVersion: string;
    requiresProject: boolean;
    requiredComponents: CredentialComponent[];
    /** Explicit kill-switch. FALSE until trusted content+components exist. */
    issuanceEnabled: boolean;
    issuanceBlockedReason: string | null;
}

const NOT_READY_REASON =
    'no server-authoritative trusted content/components yet: knowledge and practical have no defensible server source, no trusted validation items are seeded, and no authoritative project pipeline exists. Issuance stays blocked rather than issue unproven credentials.';

/**
 * Programs whose server-authoritative content AND component pipelines are
 * complete and verified end-to-end (real DB e2e). Mirrors the
 * issuance_enabled flag in credential_programs (027 enables chess on the
 * rotated replacement bank only; the compromised leaked bank stays dead).
 */
const ISSUANCE_READY: Record<string, true> = {
    'chess-foundations': true,
};

/**
 * Policy for one program, derived from the frozen catalog row.
 * Throws for unknown slugs (never invent programs server-side).
 */
export function serverIssuancePolicy(programSlug: string): ServerIssuancePolicy {
    const program: CredentialProgram | undefined = CREDENTIAL_PROGRAMS.find(
        p => p.slug === programSlug,
    );
    if (!program) throw new Error(`serverIssuancePolicy: unknown program ${programSlug}`);
    const ready = ISSUANCE_READY[program.slug] === true;
    return {
        programSlug: program.slug,
        programVersion: program.version,
        requiresProject: program.requiresProject,
        requiredComponents: [...REQUIRED_COMPONENTS],
        issuanceEnabled: ready,
        issuanceBlockedReason: ready ? null : NOT_READY_REASON,
    };
}

export function allServerIssuancePolicies(): ServerIssuancePolicy[] {
    return CREDENTIAL_PROGRAMS.map(p => serverIssuancePolicy(p.slug));
}
