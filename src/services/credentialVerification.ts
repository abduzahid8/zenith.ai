import { getSupabase } from './supabase/client';
import { projectPublicVerification } from '../server/trust';
import type { PublicCredential } from '../server/trust';

export type { PublicCredential };

/**
 * Anonymous credential verification — server-backed read path.
 *
 * Works logged out, in a clean browser, with no AsyncStorage and no app
 * session: it calls the anon-callable verify_credential RPC and projects
 * ONLY safe public fields. It NEVER reads the local credentialStore, so a
 * forged local credential can never verify publicly and clearing
 * AsyncStorage can never delete a server credential.
 */
export interface VerificationResult {
    found: boolean;
    credential: PublicCredential | null;
}

export async function verifyCredentialPublic(credentialId: string): Promise<VerificationResult> {
    const id = credentialId.trim();
    if (!id) return { found: false, credential: null };
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('verify_credential', { p_credential_id: id });
    if (error) throw new Error(`verification failed: ${error.message}`);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return { found: false, credential: null };
    return { found: true, credential: projectPublicVerification(rows[0]) };
}
