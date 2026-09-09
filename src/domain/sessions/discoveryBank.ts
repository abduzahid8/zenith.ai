import { HobbyId, LessonContent } from '../../data/lessonContent';

/**
 * Discovery micro-topics for Quick Session "Discover" mode.
 * Lightweight and exploratory: each topic carries its own 2–3 sentence
 * explainer plus one generic application prompt, so a discovery session
 * needs no AI, no bank content, and no new learning path.
 * Discovery sessions are always review-only (never advance the day,
 * never credit daily tasks, never weigh on certification).
 */

export interface DiscoveryTopic {
    id: string;
    title: string;
    titleRu: string;
    explainer: string;
    explainerRu: string;
    applyPrompt: string;
    applyPromptRu: string;
}

export const DISCOVERY_TOPICS: readonly DiscoveryTopic[] = [
    {
        id: 'plane-trails',
        title: 'Why do airplanes leave white trails?',
        titleRu: 'Почему самолёты оставляют белый след?',
        explainer: 'Those white trails are mostly condensed water vapor. Hot, humid exhaust mixes with very cold air high up, and the moisture freezes into tiny ice crystals — a human-made cloud.',
        explainerRu: 'Белый след — это в основном сконденсированный водяной пар. Горячий влажный выхлоп смешивается с очень холодным воздухом на высоте, и влага замерзает в крошечные кристаллы льда — рукотворное облако.',
        applyPrompt: 'Explain in your own words why the trail disappears on some days but lingers on others.',
        applyPromptRu: 'Объясни своими словами, почему в одни дни след исчезает сразу, а в другие висит долго.',
    },
    {
        id: 'compound-interest',
        title: 'How does compound interest actually work?',
        titleRu: 'Как на самом деле работают сложные проценты?',
        explainer: 'Compound interest pays interest on both your original money and the interest already earned. That snowball effect is why starting early beats contributing more later.',
        explainerRu: 'Сложные проценты начисляются и на вложенные деньги, и на уже заработанные проценты. Этот эффект снежного кома — причина, почему начать рано важнее, чем вкладывать больше позже.',
        applyPrompt: 'If you save $100 monthly at 8% yearly, roughly how much is it in 10 years? Show your estimate.',
        applyPromptRu: 'Если откладывать $100 в месяц под 8% годовых, сколько примерно будет через 10 лет? Покажи расчёт.',
    },
    {
        id: 'brain-forgets',
        title: 'Why does the brain forget information?',
        titleRu: 'Почему мозг забывает информацию?',
        explainer: 'Forgetting is a feature, not a bug: the brain prunes unused connections to keep important ones fast. Spaced repetition tells your brain a memory is worth keeping.',
        explainerRu: 'Забывание — это функция, а не баг: мозг обрезает неиспользуемые связи, чтобы важные работали быстрее. Интервальные повторения сообщают мозгу, что воспоминание стоит сохранить.',
        applyPrompt: 'Name one thing you learned this week and schedule three moments to recall it.',
        applyPromptRu: 'Назови одну вещь, которую узнал на этой неделе, и запланируй три момента, чтобы её вспомнить.',
    },
    {
        id: 'honey-spoil',
        title: 'Why does honey almost never spoil?',
        titleRu: 'Почему мёд почти не портится?',
        explainer: 'Honey is too sugary and too dry for microbes: sugar binds almost all water, and bees add an enzyme that produces tiny amounts of hydrogen peroxide. Archaeologists found edible honey in ancient Egyptian tombs.',
        explainerRu: 'Мёд слишком сладкий и сухой для микробов: сахар связывает почти всю воду, а пчёлы добавляют фермент, выделяющий перекись водорода. Археологи находили съедобный мёд в древнеегипетских гробницах.',
        applyPrompt: 'Why would adding water to honey make it spoil? Answer in one or two sentences.',
        applyPromptRu: 'Почему добавление воды заставит мёд испортиться? Ответь в одном-двух предложениях.',
    },
    {
        id: 'dreams-why',
        title: 'Why do we dream?',
        titleRu: 'Почему мы видим сны?',
        explainer: 'The leading theory: dreaming is overnight therapy and filing. The brain replays the day, processes emotions with stress chemistry dialed down, and moves important memories to long-term storage.',
        explainerRu: 'Ведущая теория: сны — это ночная терапия и архивация. Мозг проигрывает день, обрабатывает эмоции при сниженном стрессе и переносит важное в долговременную память.',
        applyPrompt: 'Recall your last dream and guess which daytime event it might be processing.',
        applyPromptRu: 'Вспомни последний сон и предположи, какое дневное событие он мог обрабатывать.',
    },
    {
        id: 'music-memory',
        title: 'Why does music trigger memories?',
        titleRu: 'Почему музыка вызывает воспоминания?',
        explainer: 'Music activates the hippocampus and the emotional brain together, so songs get stored with feelings attached. Hearing the song later replays the whole bundle — the memory and the emotion.',
        explainerRu: 'Музыка одновременно активирует гиппокамп и эмоциональный мозг, поэтому песни сохраняются вместе с чувствами. Услышав песню позже, ты проигрываешь весь пакет — и воспоминание, и эмоцию.',
        applyPrompt: 'Pick one song tied to a memory and describe what exactly it brings back.',
        applyPromptRu: 'Выбери одну песню, связанную с воспоминанием, и опиши, что именно она возвращает.',
    },
    {
        id: 'procrastination',
        title: 'Why do we procrastinate?',
        titleRu: 'Почему мы прокрастинируем?',
        explainer: 'Procrastination is mood repair, not laziness: the brain avoids the bad feeling attached to a task. Shrinking the first step to two minutes removes the threat and gets you started.',
        explainerRu: 'Прокрастинация — это починка настроения, а не лень: мозг избегает неприятного чувства, связанного с задачей. Уменьшение первого шага до двух минут снимает угрозу и запускает работу.',
        applyPrompt: 'Name one task you avoid and define its smallest possible two-minute first step.',
        applyPromptRu: 'Назови одну задачу, которую избегаешь, и определи её мельчайший первый шаг на две минуты.',
    },
    {
        id: 'deja-vu',
        title: 'What is déjà vu?',
        titleRu: 'Что такое дежавю?',
        explainer: 'Déjà vu is likely a timing glitch in memory: a scene gets briefly tagged as "already seen" while you perceive it. The feeling of familiarity is real, but the memory is brand new.',
        explainerRu: 'Дежавю — вероятно, сбой тайминга в памяти: сцена на мгновение помечается как «уже виденная», пока ты её воспринимаешь. Чувство знакомости реально, а воспоминание — совершенно новое.',
        applyPrompt: 'Describe your most vivid déjà vu moment and when it happened.',
        applyPromptRu: 'Опиши своё самое яркое дежавю и когда оно случилось.',
    },
];

export function getDiscoveryTopic(id: string): DiscoveryTopic | undefined {
    return DISCOVERY_TOPICS.find((t) => t.id === id);
}

/** Discovery sessions run on the user's current hobby for time attribution. */
export function buildDiscoveryLesson(
    topicId: string,
    hobby: HobbyId,
    language: 'ru' | 'en',
): LessonContent | null {
    const topic = getDiscoveryTopic(topicId);
    if (!topic) return null;
    const ru = language === 'ru';
    return {
        id: `discovery-${topic.id}`,
        hobby,
        day: 1,
        learn: {
            title: ru ? topic.titleRu : topic.title,
            body: ru ? topic.explainerRu : topic.explainer,
            keywords: [],
        },
        do: {
            type: 'free_text',
            prompt: ru ? topic.applyPromptRu : topic.applyPrompt,
        },
    };
}
