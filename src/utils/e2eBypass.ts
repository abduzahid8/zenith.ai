/**
 * Dev-only E2E bypass ("skip login").
 *
 * When `EXPO_PUBLIC_E2E_BYPASS_AUTH=1` AND the bundle is a dev bundle
 * (`__DEV__ === true`), the app signs in a local mock user instead of
 * hitting Supabase Auth. This lets E2E/manual QA drive the full product
 * flow — onboarding → hobby → subscription → home → quick session —
 * without credentials or network.
 *
 * PRODUCTION SAFETY: `__DEV__` is `false` in every release build
 * (EAS production/preview, TestFlight, Play, web export), so the bypass
 * is unreachable in production even if the env var leaks into the bundle.
 * In Jest (node) `__DEV__` is undefined → always disabled.
 */

export const E2E_MOCK_USER_ID = 'e2e-bypass-user';
export const E2E_MOCK_USER_EMAIL = 'e2e@zenyth.local';

export function isE2EBypassEnabled(): boolean {
    try {
        const g = globalThis as Record<string, unknown>;
        if (g.__DEV__ !== true) return false;
        return (process.env.EXPO_PUBLIC_E2E_BYPASS_AUTH ?? '') === '1';
    } catch {
        return false;
    }
}

/** Local-only task ids used for offline demo plans. Never clash with server uuids. */
export function isLocalOnlyTaskId(id: string | undefined): boolean {
    if (!id) return false;
    return id.startsWith('temp-') || id.startsWith('demo-');
}
