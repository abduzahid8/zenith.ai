import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Quiz questions data
export const QUIZ_QUESTIONS = [
    {
        id: 1,
        question: 'Как ты обычно решаешь сложные задачи?',
        options: [
            'Думаю логически, строю план',
            'Читаю и разбираюсь в теме',
            'Просто пробую и смотрю что выйдет',
        ],
    },
    {
        id: 2,
        question: 'Что тебе легче запомнить?',
        options: [
            'Правило или алгоритм',
            'Слово, фразу или историю',
            'Действие которое сам повторил',
        ],
    },
    {
        id: 3,
        question: 'Видишь незнакомую тему — первая реакция?',
        options: [
            'Хочу понять как это устроено',
            'Хочу понять зачем это нужно',
            'Хочу сразу попробовать',
        ],
    },
    {
        id: 4,
        question: 'Есть свободный час — что выберешь?',
        options: [
            'Что-то стратегическое или логическое',
            'Почитать или выучить что-то новое',
            'Сделать что-то руками',
        ],
    },
    {
        id: 5,
        question: 'Как ты учишь новое?',
        options: [
            'Строю схему — логика и структура',
            'Запоминаю через смысл',
            'Пробую и смотрю что получится',
        ],
    },
    {
        id: 6,
        question: 'Что тебе интереснее?',
        options: [
            'Найти правильный ответ',
            'Понять почему именно так',
            'Сделать что-то рабочее',
        ],
    },
    {
        id: 7,
        question: 'Зачем тебе хобби?',
        options: [
            'Хочу навык для карьеры',
            'Хочу лучше концентрироваться',
            'Хочу заменить соцсети чем-то полезным',
        ],
    },
    {
        id: 8,
        question: 'Что хочешь прокачать прямо сейчас?',
        options: [
            'Программирование или логику',
            'Язык',
            'Концентрацию и мышление',
        ],
    },
    {
        id: 9,
        question: 'Сложная задача — что делаешь?',
        options: [
            'Разбиваю на шаги',
            'Ищу объяснение',
            'Пробую разные варианты',
        ],
    },
    {
        id: 10,
        question: 'Что тебе проще запомнить?',
        options: [
            'Алгоритм или правило',
            'Слово или историю',
            'То что сам сделал руками',
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
