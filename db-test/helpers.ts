/** Shared helpers for real-DB integration tests (local throwaway Postgres). */
import { Client } from 'pg';
import { randomUUID } from 'crypto';

export type DbRole = 'anon' | 'authenticated' | 'service_role';

export function adminClient(): Client {
    const port = Number(process.env.ZENYTH_E2E_PGPORT ?? 55433);
    return new Client({
        host: '127.0.0.1',
        port,
        user: 'postgres',
        password: 'postgres',
        database: 'postgres',
    });
}

export const newUid = (): string => randomUUID();

/** Register a test user in the auth shim. */
export async function createUser(db: Client, uid: string, email?: string): Promise<void> {
    await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
        uid,
        email ?? `${uid}@test.local`,
    ]);
}

/**
 * Run fn with ROLE + request.jwt.claim.sub set (mirrors PostgREST behavior:
 * role from JWT, auth.uid() from sub claim). No transaction wrapper — tests
 * manage their own ids and commit, so multi-step flows persist.
 */
export async function asRole<T>(
    db: Client,
    role: DbRole,
    uid: string | null,
    fn: () => Promise<T>,
): Promise<T> {
    await db.query(`SET ROLE ${role}`);
    if (uid) {
        await db.query(`SET "request.jwt.claim.sub" TO '${uid}'`);
    } else {
        await db.query(`RESET "request.jwt.claim.sub"`);
    }
    try {
        return await fn();
    } finally {
        await db.query('RESET ROLE');
        await db.query(`RESET "request.jwt.claim.sub"`);
    }
}

/** Expect a Postgres RLS / permission error (42501) or a guard RAISE (P0001). */
export async function expectDbDenied(p: Promise<unknown>, match?: RegExp): Promise<string> {
    try {
        await p;
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (match) expect(message).toMatch(match);
        return message;
    }
    throw new Error('expected database to deny the operation, but it succeeded');
}
