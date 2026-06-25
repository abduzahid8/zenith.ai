/**
 * gamificationStore.test.ts
 * Тесты для логики геймификации: streak, заморозка, бейджи, артефакты, продвижение по дням.
 */

// Мокируем zustand persist чтобы тесты работали без AsyncStorage
jest.mock('zustand/middleware', () => ({
    persist: (fn: any) => fn,
    createJSONStorage: () => ({}),
}));

// Мокируем AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Подключаем реальный стор после моков
import { useGamificationStore, getDailyProgress, getRemainingSteps } from '../store/gamificationStore';

// Вспомогательная функция: получить состояние стора
function getState() {
    return useGamificationStore.getState();
}

// Вспомогательная функция: сбросить стор перед каждым тестом
function resetStore() {
    useGamificationStore.setState({
        dailyChecklist: { learn: false, do: false, deepen1: false, deepen2: false },
        lastChecklistDate: null,
        currentStreak: 0,
        lastActiveDate: null,
        weeklyFreezeUsed: false,
        weeklyFreezeWeekStart: null,
        freezeActivatedToday: false,
        currentDay: { english: 1, chess: 1, chinese: 1, coding: 1, python: 1, reading: 1 },
        unitProgress: {},
        artifacts: [],
        repetitionItems: [],
        unlockedBadges: [],
        pendingBadge: null,
        currentSessionHobby: null,
        codeRunCount: 0,
        chessTaskSolved: false,
    } as any);
}

// ─────────────────────────────────────────────
// Утилиты для работы с датами в тестах
// ─────────────────────────────────────────────

function dateOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

const TODAY = dateOffset(0);
const YESTERDAY = dateOffset(-1);
const TWO_DAYS_AGO = dateOffset(-2);
const THREE_DAYS_AGO = dateOffset(-3);

// ─────────────────────────────────────────────
// ТЕСТЫ: Банк уроков (lessonContent.ts)
// ─────────────────────────────────────────────

describe('lessonContent — банк уроков', () => {
    const { getLessonByDay, LESSON_BANK, HOBBY_META } = require('../data/lessonContent');

    test('все 6 хобби присутствуют', () => {
        expect(Object.keys(LESSON_BANK)).toEqual(['english', 'chinese', 'chess', 'coding', 'python', 'reading']);
    });

    test('каждое хобби имеет ровно 7 уроков', () => {
        for (const hobby of ['english', 'chinese', 'chess', 'coding', 'python', 'reading']) {
            expect(LESSON_BANK[hobby]).toHaveLength(7);
        }
    });

    test('уроки пронумерованы правильно (1-7)', () => {
        for (const hobby of ['english', 'chinese', 'chess', 'coding', 'python', 'reading']) {
            for (let day = 1; day <= 7; day++) {
                const lesson = LESSON_BANK[hobby][day - 1];
                expect(lesson.day).toBe(day);
            }
        }
    });

    test('getLessonByDay возвращает урок по дню', () => {
        const lesson = getLessonByDay('english', 1);
        expect(lesson).toBeDefined();
        expect(lesson?.hobby).toBe('english');
        expect(lesson?.day).toBe(1);
    });

    test('getLessonByDay возвращает undefined для дня > 7', () => {
        const lesson = getLessonByDay('chess', 8);
        expect(lesson).toBeUndefined();
    });

    test('каждый урок содержит обязательные поля', () => {
        for (const hobby of ['english', 'chinese', 'chess', 'coding', 'python', 'reading']) {
            for (const lesson of LESSON_BANK[hobby]) {
                expect(lesson.id).toBeTruthy();
                expect(lesson.learn.title).toBeTruthy();
                expect(lesson.learn.body).toBeTruthy();
                expect(lesson.learn.keywords.length).toBeGreaterThan(0);
                expect(lesson.do.type).toBeTruthy();
                expect(lesson.do.prompt).toBeTruthy();
            }
        }
    });

    test('шахматные уроки содержат puzzleFen и puzzleMoves', () => {
        const chessWithPuzzle = LESSON_BANK['chess'].filter(
            (l: any) => l.do.type === 'chess_puzzle'
        );
        expect(chessWithPuzzle.length).toBeGreaterThan(0);
        for (const lesson of chessWithPuzzle) {
            expect(lesson.do.puzzleFen).toBeTruthy();
            expect(lesson.do.puzzleMoves).toBeDefined();
            expect(lesson.do.puzzleMoves.length).toBeGreaterThan(0);
        }
    });

    test('coding-уроки имеют тип code', () => {
        const codeLesson = LESSON_BANK['coding'].find((l: any) => l.do.type === 'code');
        expect(codeLesson).toBeDefined();
        expect(codeLesson?.do.starterCode).toBeTruthy();
    });

    test('HOBBY_META содержит все хобби', () => {
        expect(HOBBY_META.english).toBeDefined();
        expect(HOBBY_META.chinese).toBeDefined();
        expect(HOBBY_META.chess).toBeDefined();
        expect(HOBBY_META.coding).toBeDefined();
        expect(HOBBY_META.python).toBeDefined();
        expect(HOBBY_META.reading).toBeDefined();
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Streak (серия дней)
// ─────────────────────────────────────────────

describe('gamificationStore — streak логика', () => {
    beforeEach(() => resetStore());

    test('первый вход: streak = 1', () => {
        getState().updateStreak();
        expect(getState().currentStreak).toBe(1);
        expect(getState().lastActiveDate).toBe(TODAY);
    });

    test('занятие вчера: streak увеличивается', () => {
        useGamificationStore.setState({
            lastActiveDate: YESTERDAY,
            currentStreak: 5,
        } as any);
        getState().updateStreak();
        expect(getState().currentStreak).toBe(6);
    });

    test('занятие сегодня второй раз: streak НЕ меняется', () => {
        useGamificationStore.setState({
            lastActiveDate: TODAY,
            currentStreak: 3,
        } as any);
        getState().updateStreak();
        expect(getState().currentStreak).toBe(3); // Без изменений
    });

    test('пропуск 2 дней без заморозки: streak сбрасывается', () => {
        useGamificationStore.setState({
            lastActiveDate: TWO_DAYS_AGO,
            currentStreak: 10,
            weeklyFreezeUsed: true, // Заморозка уже использована
            weeklyFreezeWeekStart: '2026-05-18', // Прошлая неделя
        } as any);

        // Устанавливаем weeklyFreezeWeekStart в ТЕКУЩУЮ неделю чтобы не сбрасывать
        const monday = new Date(TODAY);
        const day = monday.getDay();
        monday.setDate(monday.getDate() - day + (day === 0 ? -6 : 1));
        const currentMonday = monday.toISOString().split('T')[0];

        useGamificationStore.setState({ weeklyFreezeWeekStart: currentMonday } as any);

        getState().updateStreak();
        expect(getState().currentStreak).toBe(1); // Сбросился
    });

    test('пропуск 2 дней с доступной заморозкой: streak сохраняется', () => {
        // Заморозка не использована на этой неделе
        const monday = new Date(TODAY);
        const dayOfWeek = monday.getDay();
        monday.setDate(monday.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
        const currentMonday = monday.toISOString().split('T')[0];

        useGamificationStore.setState({
            lastActiveDate: TWO_DAYS_AGO,
            currentStreak: 7,
            weeklyFreezeUsed: false,
            weeklyFreezeWeekStart: currentMonday,
        } as any);

        getState().updateStreak();
        expect(getState().currentStreak).toBe(7); // Streak сохранён!
        expect(getState().weeklyFreezeUsed).toBe(true);
        expect(getState().freezeActivatedToday).toBe(true);
    });

    test('пропуск 3+ дней: streak всегда сбрасывается', () => {
        useGamificationStore.setState({
            lastActiveDate: THREE_DAYS_AGO,
            currentStreak: 15,
            weeklyFreezeUsed: false,
        } as any);
        getState().updateStreak();
        expect(getState().currentStreak).toBe(1);
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Чеклист дня
// ─────────────────────────────────────────────

describe('gamificationStore — чеклист дня', () => {
    beforeEach(() => resetStore());

    test('markStepComplete помечает шаг выполненным', () => {
        getState().markStepComplete('learn');
        expect(getState().dailyChecklist.learn).toBe(true);
        expect(getState().dailyChecklist.do).toBe(false);
    });

    test('все 4 шага можно отметить независимо', () => {
        getState().markStepComplete('learn');
        getState().markStepComplete('do');
        getState().markStepComplete('deepen1');
        getState().markStepComplete('deepen2');

        const cl = getState().dailyChecklist;
        expect(cl.learn).toBe(true);
        expect(cl.do).toBe(true);
        expect(cl.deepen1).toBe(true);
        expect(cl.deepen2).toBe(true);
    });

    test('resetDailyChecklist сбрасывает все шаги', () => {
        getState().markStepComplete('learn');
        getState().markStepComplete('do');
        getState().resetDailyChecklist();

        const cl = getState().dailyChecklist;
        expect(cl.learn).toBe(false);
        expect(cl.do).toBe(false);
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Бейджи (ачивки)
// ─────────────────────────────────────────────

describe('gamificationStore — бейджи', () => {
    beforeEach(() => resetStore());

    test('first_session разблокируется после первого артефакта', () => {
        getState().saveArtifact({
            hobbyId: 'english',
            lessonId: 'english_d1',
            taskType: 'do',
            userInput: 'goes',
            aiFeedback: 'Правильно!',
        });
        expect(getState().unlockedBadges.map(b => b.id)).toContain('first_session');
    });

    test('streak_3 разблокируется при streak >= 3', () => {
        useGamificationStore.setState({ currentStreak: 3 } as any);
        getState().checkAndUnlockBadges();
        expect(getState().unlockedBadges.map(b => b.id)).toContain('streak_3');
    });

    test('streak_7 разблокируется при streak >= 7', () => {
        useGamificationStore.setState({ currentStreak: 7 } as any);
        getState().checkAndUnlockBadges();
        expect(getState().unlockedBadges.map(b => b.id)).toContain('streak_7');
    });

    test('бейдж не дублируется при повторной проверке', () => {
        useGamificationStore.setState({ currentStreak: 5 } as any);
        getState().checkAndUnlockBadges();
        getState().checkAndUnlockBadges();
        getState().checkAndUnlockBadges();

        const streak3Badges = getState().unlockedBadges.filter(b => b.id === 'streak_3');
        expect(streak3Badges).toHaveLength(1); // Только один!
    });

    test('pendingBadge устанавливается при разблокировке', () => {
        useGamificationStore.setState({ currentStreak: 3 } as any);
        getState().checkAndUnlockBadges();
        expect(getState().pendingBadge).toBe('streak_3');
    });

    test('dismissBadge сбрасывает pendingBadge', () => {
        useGamificationStore.setState({ currentStreak: 3 } as any);
        getState().checkAndUnlockBadges();
        getState().dismissBadge();
        expect(getState().pendingBadge).toBeNull();
    });

    test('first_code_run разблокируется при recordCodeRun', () => {
        getState().recordCodeRun();
        expect(getState().unlockedBadges.map(b => b.id)).toContain('first_code_run');
    });

    test('chess_solver разблокируется при recordChessSolve', () => {
        getState().recordChessSolve();
        expect(getState().unlockedBadges.map(b => b.id)).toContain('chess_solver');
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Артефакты
// ─────────────────────────────────────────────

describe('gamificationStore — артефакты', () => {
    beforeEach(() => resetStore());

    test('saveArtifact добавляет артефакт в список', () => {
        getState().saveArtifact({
            hobbyId: 'chess',
            lessonId: 'chess_d1',
            taskType: 'do',
            userInput: 'h1h7',
            aiFeedback: 'Верно! Отличный ход ферзём!',
        });
        expect(getState().artifacts).toHaveLength(1);
    });

    test('у артефакта есть id и дата', () => {
        getState().saveArtifact({
            hobbyId: 'coding',
            lessonId: 'coding_d1',
            taskType: 'do',
            userInput: 'print("Hello")',
            aiFeedback: 'Всё верно!',
        });
        const artifact = getState().artifacts[0];
        expect(artifact.id).toBeTruthy();
        expect(artifact.date).toBe(TODAY);
    });

    test('несколько артефактов сохраняются в правильном порядке (новые первые)', () => {
        getState().saveArtifact({ hobbyId: 'english', lessonId: 'english_d1', taskType: 'do', userInput: 'goes', aiFeedback: '' });
        getState().saveArtifact({ hobbyId: 'chess', lessonId: 'chess_d1', taskType: 'do', userInput: 'h1h7', aiFeedback: '' });

        expect(getState().artifacts).toHaveLength(2);
        expect(getState().artifacts[0].hobbyId).toBe('chess'); // Последний первый
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Прогресс по дням
// ─────────────────────────────────────────────

describe('gamificationStore — продвижение по дням', () => {
    beforeEach(() => resetStore());

    test('advanceDay увеличивает день для хобби', () => {
        expect(getState().currentDay.english).toBe(1);
        getState().advanceDay('english');
        expect(getState().currentDay.english).toBe(2);
    });

    test('advanceDay не влияет на другие хобби', () => {
        getState().advanceDay('chess');
        expect(getState().currentDay.english).toBe(1);
        expect(getState().currentDay.chinese).toBe(1);
        expect(getState().currentDay.coding).toBe(1);
        expect(getState().currentDay.chess).toBe(2);
    });

    test('переход через 7 дней фиксирует завершение юнита', () => {
        useGamificationStore.setState({ currentDay: { english: 7, chess: 1, chinese: 1, coding: 1, python: 1, reading: 1 } } as any);
        getState().advanceDay('english');
        expect(getState().currentDay.english).toBe(8);
        expect(getState().unitProgress['english_unit1']).toBe(true);
    });
});

// ─────────────────────────────────────────────
// ТЕСТЫ: Вспомогательные функции
// ─────────────────────────────────────────────

describe('вспомогательные функции', () => {
    test('getDailyProgress для бесплатного: учёт 2 шагов', () => {
        const checklist = { learn: true, do: false, deepen1: false, deepen2: false };
        expect(getDailyProgress(checklist, false)).toBe(50); // 1 из 2
    });

    test('getDailyProgress для premium: учёт 4 шагов', () => {
        const checklist = { learn: true, do: true, deepen1: false, deepen2: false };
        expect(getDailyProgress(checklist, true)).toBe(50); // 2 из 4
    });

    test('getDailyProgress = 100 когда все шаги выполнены (free)', () => {
        const checklist = { learn: true, do: true, deepen1: false, deepen2: false };
        expect(getDailyProgress(checklist, false)).toBe(100);
    });

    test('getRemainingSteps возвращает количество оставшихся шагов', () => {
        const checklist = { learn: true, do: false, deepen1: false, deepen2: false };
        expect(getRemainingSteps(checklist, false)).toBe(1); // Для free: осталось 1
        expect(getRemainingSteps(checklist, true)).toBe(3);  // Для premium: осталось 3
    });
});
