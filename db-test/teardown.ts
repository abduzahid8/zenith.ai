/** E2E global teardown: removes the throwaway Postgres (container or local). */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PG_BIN = '/opt/homebrew/opt/postgresql@16/bin';

export default async function globalTeardown(): Promise<void> {
    try {
        execSync('docker rm -f zenyth-trust-e2e-pg', { stdio: 'ignore' });
    } catch {
        /* no container */
    }
    try {
        const marker = path.join(__dirname, '.local-pgdir');
        if (fs.existsSync(marker)) {
            const dir = fs.readFileSync(marker, 'utf8').trim();
            execSync(`"${PG_BIN}/pg_ctl" -D "${dir}" stop -m fast`, { stdio: 'ignore' });
            fs.rmSync(dir, { recursive: true, force: true });
            fs.rmSync(marker, { force: true });
        }
    } catch {
        /* already gone */
    }
}
