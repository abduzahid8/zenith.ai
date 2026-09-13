/**
 * Gamification debug route hardening — regression contract.
 *
 * The debug route/screen that could arbitrarily mint gamification /
 * credential-input state (streak, days, badges, sessions, chess credit)
 * must stay out of the production bundle: no route file, no screen
 * component, no navigation reference. Expo Router registers file-based
 * routes automatically, so absence of the file IS absence of the route.
 *
 * Legitimate gamification wiring (store + session step effects) must
 * remain intact — this test guards both sides.
 */
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const SELF = path.join(__dirname, 'gamificationDebugRoute.test.ts');

const exists = (rel: string): boolean => fs.existsSync(path.join(ROOT, rel));

const TEXT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

function collectTextFiles(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.expo') continue;
            collectTextFiles(full, out);
        } else if (TEXT_EXT.has(path.extname(entry.name))) {
            out.push(full);
        }
    }
    return out;
}

function filesMatching(pattern: RegExp, dirs: string[]): string[] {
    const hits: string[] = [];
    for (const dir of dirs) {
        const abs = path.join(ROOT, dir);
        if (!fs.existsSync(abs)) continue;
        for (const file of collectTextFiles(abs)) {
            if (file === SELF) continue;
            const content = fs.readFileSync(file, 'utf8');
            if (pattern.test(content)) hits.push(path.relative(ROOT, file));
        }
    }
    return hits;
}

describe('gamification debug route is not production reachable', () => {
    it('route file is gone (Expo Router auto-registers app/ files, so absence = unreachable)', () => {
        expect(exists('app/gamification-debug.tsx')).toBe(false);
    });

    it('debug screen component is gone', () => {
        expect(exists('src/screens/GamificationDebugScreen.tsx')).toBe(false);
    });

    it('no source file references the debug route or screen', () => {
        const hits = filesMatching(/gamification-debug|GamificationDebugScreen/, ['app', 'src']);
        expect(hits).toEqual([]);
    });
});

describe('legitimate gamification wiring still works', () => {
    it('gamification store keeps its real API', () => {
        const store = fs.readFileSync(path.join(ROOT, 'src/store/gamificationStore.ts'), 'utf8');
        for (const api of [
            'markStepComplete',
            'advanceDay',
            'incrementSessionsCompleted',
            'recordChessSolve',
            'resetGamification',
        ]) {
            expect(store).toMatch(new RegExp(api));
        }
    });

    it('the guarded session completion path still mints progress (not the debug UI)', () => {
        const effects = fs.readFileSync(
            path.join(ROOT, 'src/services/sessionStepEffects.ts'),
            'utf8',
        );
        expect(effects).toMatch(/markStepComplete/);
        expect(effects).toMatch(/advanceDay/);
        expect(effects).toMatch(/incrementSessionsCompleted/);
    });

    it('legitimate learning routes still exist', () => {
        for (const route of ['app/session-timer.tsx', 'app/goal-detail.tsx', 'app/quick-session.tsx']) {
            expect(exists(route)).toBe(true);
        }
    });
});
