import { DISCOVERY_TOPICS, getDiscoveryTopic, buildDiscoveryLesson } from '../domain/sessions/discoveryBank';

describe('discoveryBank', () => {
    it('ships a stable set of micro-topics with ids', () => {
        expect(DISCOVERY_TOPICS.length).toBeGreaterThanOrEqual(5);
        const ids = DISCOVERY_TOPICS.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const t of DISCOVERY_TOPICS) {
            expect(t.title.length).toBeGreaterThan(0);
            expect(t.titleRu.length).toBeGreaterThan(0);
            expect(t.explainer.length).toBeGreaterThan(20);
            expect(t.explainerRu.length).toBeGreaterThan(20);
            expect(t.applyPrompt.length).toBeGreaterThan(0);
        }
    });

    it('builds a valid standalone lesson without AI or bank content', () => {
        const lesson = buildDiscoveryLesson('plane-trails', 'python', 'ru');
        expect(lesson).not.toBeNull();
        expect(lesson!.id).toBe('discovery-plane-trails');
        expect(lesson!.hobby).toBe('python');
        expect(lesson!.learn.title).toContain('самолёт');
        expect(lesson!.do.type).toBe('free_text');
        const en = buildDiscoveryLesson('plane-trails', 'chess', 'en');
        expect(en!.learn.title).toContain('airplanes');
        expect(buildDiscoveryLesson('nope', 'python', 'ru')).toBeNull();
        expect(getDiscoveryTopic('deja-vu')?.id).toBe('deja-vu');
    });
});
