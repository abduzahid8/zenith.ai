/**
 * trustApi error classifiers — pure unit tests (no DB, no network).
 * The fail-closed content gate (migration 034) raises
 * `credential_content_unavailable`; the UI must classify it as a valid
 * server response (temporarily unavailable), never as offline.
 */
import { isContentUnavailable, parseRetakeBlock } from '../services/trustApi';

jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({})),
}));

describe('isContentUnavailable', () => {
    test('matches the exact server gate error', () => {
        expect(isContentUnavailable('credential_content_unavailable')).toBe(true);
    });

    test('matches wrapped Postgres errors carrying the gate code', () => {
        expect(isContentUnavailable('start_trusted_validation: credential_content_unavailable')).toBe(true);
    });

    test('rejects offline, auth, and content-missing errors', () => {
        expect(isContentUnavailable('offline')).toBe(false);
        expect(isContentUnavailable('Network request failed')).toBe(false);
        expect(isContentUnavailable('start_trusted_validation: no trusted content')).toBe(false);
        expect(isContentUnavailable('')).toBe(false);
    });

    test('never matches retake-block codes (different UX path)', () => {
        expect(isContentUnavailable('retake_blocked:cooldown:2026-01-01')).toBe(false);
        expect(parseRetakeBlock('retake_blocked:cooldown:2026-01-01')).not.toBeNull();
    });
});
