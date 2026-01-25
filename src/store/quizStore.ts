import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Quiz questions data
export const QUIZ_QUESTIONS = [
    {
        id: 1,
        question: 'Как ты чаще всего чувствуешь себя в конце дня?',
        options: [
            'Уставшим, будто мозг перегружен',
            'Нормально, но кажется, что день прошёл впустую',
            'Есть энергия, но не понимаю, куда её направить',
        ],
    },
    {
        id: 2,
        question: 'Когда появляется свободное время, ты чаще…',
        options: [
            'Беру телефон автоматически',
            'Хочу заняться чем-то полезным, но откладываю',
            'Уже примерно знаю, чем хочу заняться',
        ],
    },
    {
        id: 3,
        question: 'Что тебе даётся легче?',
        options: [
            '🧠 Думать, анализировать',
            '🎨 Создавать, визуализировать',
            '🏃 Делать физически, через тело',
        ],
    },
    {
        id: 4,
        question: 'Ты больше…',
        options: [
            'Интроверт',
            'Экстраверт',
            'Амбиверт (Баланс)',
        ],
    },
    {
        id: 5,
        question: 'Как ты относишься к сложным задачам?',
        options: [
            'Избегаю, если сразу не получается',
            'Терплю, если вижу смысл',
            'Люблю вызовы',
        ],
    },
    {
        id: 6,
        question: 'Что тебя больше мотивирует?',
        options: [
            'Видимый прогресс',
            'Чувство смысла и развития',
            'Результат, который можно показать',
        ],
    },
    {
        id: 7,
        question: 'Какой формат тебе ближе?',
        options: [
            'Чёткий план',
            'Свобода + рекомендации',
            'Мини-задачи без давления',
        ],
    },
    {
        id: 8,
        question: 'Через сколько времени ты готов увидеть результат?',
        options: [
            'Через неделю',
            'Через месяц',
            'Мне важен сам процесс',
        ],
    },
    {
        id: 9,
        question: 'Что тебе сейчас важнее всего прокачать?',
        options: [
            'Концентрацию',
            'Навык / профессию',
            'Уверенность в себе',
        ],
    },
    {
        id: 10,
        question: 'Сколько времени ты готов уделять хобби в день?',
        options: [
            '30–45 минут',
            '1–2 часа',
            'Когда втянусь — больше',
        ],
    },
];

interface QuizState {
    currentQuestion: number;
    answers: Record<number, number>;
    isCompleted: boolean;

    // Actions
    setAnswer: (questionId: number, optionIndex: number) => void;
    nextQuestion: () => void;
    prevQuestion: () => void;
    goToQuestion: (questionId: number) => void;
    completeQuiz: () => void;
    resetQuiz: () => void;
}

export const useQuizStore = create<QuizState>()(
    persist(
        (set, get) => ({
            currentQuestion: 1,
            answers: {},
            isCompleted: false,

            setAnswer: (questionId, optionIndex) => {
                set((state) => ({
                    answers: { ...state.answers, [questionId]: optionIndex },
                }));
            },

            nextQuestion: () => {
                const { currentQuestion } = get();
                if (currentQuestion < QUIZ_QUESTIONS.length) {
                    set({ currentQuestion: currentQuestion + 1 });
                }
            },

            prevQuestion: () => {
                const { currentQuestion } = get();
                if (currentQuestion > 1) {
                    set({ currentQuestion: currentQuestion - 1 });
                }
            },

            goToQuestion: (questionId) => {
                if (questionId >= 1 && questionId <= QUIZ_QUESTIONS.length) {
                    set({ currentQuestion: questionId });
                }
            },

            completeQuiz: () => {
                set({ isCompleted: true });
            },

            resetQuiz: () => {
                set({
                    currentQuestion: 1,
                    answers: {},
                    isCompleted: false,
                });
            },
        }),
        {
            name: 'quiz-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

export default useQuizStore;
