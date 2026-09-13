import { useCallback, useEffect, useState } from 'react';
import { getCredentialProgress, getProgramAvailability } from '../services/trustApi';
import {
    fetchServerEnrollment,
    type ServerEnrollmentStatus,
} from '../domain/credentials/enrollmentTruth';

export type { ServerEnrollmentStatus };

export interface ServerEnrollmentState {
    /**
     * Per-slug server enrollment, each pinned to its current server
     * version. Absent key = unknown: the UI must claim nothing and show a
     * neutral loading state. Local credentialStore flags are never
     * consulted here.
     */
    status: Record<string, ServerEnrollmentStatus>;
    loading: boolean;
    /** Re-read server truth (call after ensureEnrollment succeeds). */
    refresh: () => void;
}

/**
 * Server-backed enrollment read-model for credential UI. Reuses the
 * existing server enrollment path only (program-availability version pin +
 * user_credential_progress row — the same source the credential journey
 * treats as enrollment). No new store, no new journey, no new API.
 */
export function useServerEnrollment(slugs: string[]): ServerEnrollmentState {
    // Serialize for a stable effect identity; slugs never contain commas.
    const key = slugs.slice().sort().join(',');
    const [status, setStatus] = useState<Record<string, ServerEnrollmentStatus>>({});
    const [loading, setLoading] = useState(true);
    const [nonce, setNonce] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setStatus({});
        setLoading(true);
        void fetchServerEnrollment(key ? key.split(',') : [], {
            getProgramAvailability,
            getCredentialProgress,
        }).then(next => {
            if (cancelled) return;
            setStatus(next);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [key, nonce]);

    const refresh = useCallback(() => setNonce(n => n + 1), []);

    return { status, loading, refresh };
}

export default useServerEnrollment;
