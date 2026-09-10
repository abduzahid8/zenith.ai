/** E2E global setup: boots a throwaway Postgres, applies shim + migrations 011+. */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import net from 'net';

const CONTAINER = 'zenyth-trust-e2e-pg';
const PORT = 55433;

type Backend = 'docker' | 'local';
let backend: Backend = 'docker';
let localDir = '';
const PG_BIN = '/opt/homebrew/opt/postgresql@16/bin';

function sh(cmd: string): string {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function dockerAlive(): boolean {
    try {
        sh('docker info');
        return true;
    } catch {
        return false;
    }
}

async function waitForPort(): Promise<void> {
    const deadline = Date.now() + 90000;
    for (;;) {
        try {
            await new Promise<void>((resolve, reject) => {
                const s = net.connect(PORT, '127.0.0.1', () => {
                    s.end();
                    resolve();
                });
                s.on('error', reject);
            });
            await new Promise(r => setTimeout(r, 1500));
            return;
        } catch {
            if (Date.now() > deadline) throw new Error('postgres never became ready');
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

function startLocal(): void {
    localDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenyth-e2e-pg-'));
    sh(`${PG_BIN}/initdb -U postgres --auth=trust -D "${localDir}"`);
    sh(
        `${PG_BIN}/pg_ctl -D "${localDir}" -l "${localDir}/log" ` +
            `-o "-p ${PORT} -k ${localDir} -c listen_addresses=127.0.0.1" start`,
    );
    fs.writeFileSync(path.join(__dirname, '.local-pgdir'), localDir);
}

function psql(file: string): void {
    if (backend === 'docker') {
        sh(`docker exec -i ${CONTAINER} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f - < "${file}"`);
    } else {
        sh(`"${PG_BIN}/psql" -h 127.0.0.1 -p ${PORT} -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f "${file}"`);
    }
}

export default async function globalSetup(): Promise<void> {
    backend = dockerAlive() ? 'docker' : 'local';
    if (backend === 'docker') {
        try {
            sh(`docker rm -f ${CONTAINER}`);
        } catch {
            /* absent */
        }
        sh(
            `docker run --rm -d --name ${CONTAINER} -e POSTGRES_PASSWORD=postgres ` +
                `-p ${PORT}:5432 postgres:16-alpine`,
        );
    } else {
        startLocal();
    }
    await waitForPort();

    const root = path.resolve(__dirname, '..');
    psql(path.join(root, 'db-test', 'auth-shim.sql'));

    const migDir = path.join(root, 'supabase', 'migrations');
    const files = fs
        .readdirSync(migDir)
        .filter(f => /^01[1-9]\d*_.+\.sql$/.test(f))
        .sort();
    if (files.length === 0) throw new Error('no 011+ migrations found');
    // eslint-disable-next-line no-console
    console.log(`[e2e] backend=${backend} migrations: ${files.join(', ')}`);
    for (const f of files) {
        psql(path.join(migDir, f));
    }
    process.env.ZENYTH_E2E_PGPORT = String(PORT);
}
