/**
 * Slice 6 — claim adapter + authority quarantine (pure unit tests).
 *
 * - parseClaimError maps raw server errors to safe UX categories.
 * - getCredentialStatus / issueCredential adapters transport the
 *   server RPC shape without invention.
 * - No client module can manufacture an issued credential: the legacy
 *   local issuance exports are gone and ZNY local ids are structurally
 *   distinct from server ZNX ids (never accepted by verification).
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildCredentialId } from '../domain/credentials/scoring';
import { parseClaimError } from '../services/trustApi';

const ROOT = path.join(__dirname, '..', '..');
const readSrc = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const rpcImpls: Record<string, (args: Record<string, unknown>) => unknown> = {};
jest.mock('../services/supabase/client', () => ({
    getSupabase: () => ({
        rpc: jest.fn(async (fn: string, args: Record<string, unknown>) => rpcImpls[fn](args)),
        from: jest.fn(() => {
            throw new Error('no table reads in adapter tests');
        }),
    }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getCredentialStatus, issueCredential } = require('../services/trustApi') as typeof import('../services/trustApi');

describe('parseClaimError', () => {
    test.each([
        'issue_credential: component_missing_or_failed:final_assessment',
        'issue_credential: skill_gate_failed:rules',
        'issue_credential: overall requirement not met',
        'issue_credential: enrollment required',
        'issue_credential: program not issuance-ready',
        'issue_credential: unknown or inactive program',
        'issue_credential: no evidence policy for skill:rules',
    ])('not_ready: %s', message => {
        expect(parseClaimError(message)).toEqual({ kind: 'not_ready' });
    });

    test('unavailable: bank/content failures', () => {
        expect(parseClaimError('issue_credential: final_assessment bank not active')).toEqual({
            kind: 'unavailable',
        });
        expect(parseClaimError('start_knowledge_attempt: credential_content_unavailable')).toEqual({
            kind: 'unavailable',
        });
    });

    test('network: everything else, never raw passthrough', () => {
        expect(parseClaimError('Network request failed')).toEqual({ kind: 'network' });
        expect(parseClaimError('')).toEqual({ kind: 'network' });
        const mapped = parseClaimError('issue_credential: component_missing_or_failed:knowledge');
        expect(JSON.stringify(mapped)).not.toContain('issue_credential');
    });
});

describe('claim adapters transport server truth', () => {
    test('getCredentialStatus maps the RPC row 1:1', async () => {
        const seen: Record<string, unknown>[] = [];
        rpcImpls.get_credential_status = args => {
            seen.push(args);
            return {
                data: [
                    {
                        state: 'ready_to_issue', credential_id: null, score: 98, grade: 'distinction',
                        issued_at: null, expires_at: null,
                    },
                ],
                error: null,
            };
        };
        const status = await getCredentialStatus('chess-foundations');
        expect(seen).toEqual([{ p_program_slug: 'chess-foundations' }]);
        expect(status).toEqual({
            state: 'ready_to_issue', credentialId: null, score: 98, grade: 'distinction',
            issuedAt: null, expiresAt: null,
        });
    });

    test('issueCredential maps credential_id/created without invention', async () => {
        rpcImpls.issue_credential = args => {
            expect(args).toEqual({ p_program_slug: 'chess-foundations', p_holder_name: 'Ada' });
            return { data: [{ credential_id: 'ZNX-abc', created: true }], error: null };
        };
        await expect(issueCredential('chess-foundations', 'Ada')).resolves.toEqual({
            credentialId: 'ZNX-abc',
            created: true,
        });
    });

    test('adapter surfaces RPC errors as thrown messages (parsed upstream)', async () => {
        rpcImpls.issue_credential = () => {
            throw new Error('from mock');
        };
        await expect(issueCredential('chess-foundations', 'Ada')).rejects.toThrow();
    });
});

describe('no local issuance authority remains', () => {
    test('credentialService has no issuance export', () => {
        const src = readSrc('src/services/credentialService.ts');
        expect(src).not.toMatch(/export function issueCredential/);
        expect(src).not.toMatch(/export const issueCredential/);
    });

    test('credentialStore has no issuance/verification authority', () => {
        const src = readSrc('src/store/credentialStore.ts');
        expect(src).not.toMatch(/tryIssue/);
        expect(src).not.toMatch(/verifyLocal/);
        expect(src).not.toMatch(/getPassport/);
        expect(src).not.toMatch(/setIdentityVerified/);
        expect(src).not.toMatch(/holderName/);
    });

    test('legacy ZNY ids are structurally distinct from server ZNX ids', () => {
        const local = buildCredentialId('CHF', 'user-a', '2026-09-10T00:00:00.000Z');
        expect(local).toMatch(/^ZNY-/);
        // Server ids are ZNX- + 128-bit hex; a local id can never collide
        // with (or verify as) a server credential.
        expect(local).not.toMatch(/^ZNX-[0-9a-f]{32}$/i);
    });

    test('claim UI calls only the server RPC (source guard)', () => {
        const section = readSrc('src/components/credentials/CredentialJourneySection.tsx');
        expect(section).toMatch(/issueCredential\(programSlug/);
        expect(section).not.toMatch(/from '..\/..\/services\/credentialService'/);
        expect(section).not.toMatch(/tryIssue/);
        expect(section).not.toMatch(/verifyLocal/);
    });
});
