import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Quiz questions data — 10 questions, 3 options each (A=0, B=1, C=2)
export const QUIZ_QUESTIONS = [
    {
        id: 1,
        question: 'How do you usually approach difficult problems?',
        options: [
            'I think logically and build a plan',          // A
            'I read and research the topic',               // B
            'I just try and see what happens',             // C
        ],
    },
    {
        id: 2,
        question: 'What is easier for you to remember?',
        options: [
            'A rule or algorithm',                         // A
            'A word, phrase or story',                     // B
            'An action I repeated myself',                 // C
        ],
    },
    {
        id: 3,
        question: 'You see an unfamiliar topic — first reaction?',
        options: [
            'I want to understand how it works',           // A
            'I want to understand why it matters',         // B
            'I want to try it right away',                 // C
        ],
    },
    {
        id: 4,
        question: 'You have a free hour — what do you choose?',
        options: [
            'Something strategic or logical',              // A
            'Read or learn something new',                 // B
            'Make something with my hands',                // C
        ],
    },
    {
        id: 5,
        question: 'How do you learn new things?',
        options: [
            'I build a scheme — logic and structure',      // A
            'I memorize through meaning',                  // B
            'I try and see what comes out',                // C
        ],
    },
    {
        id: 6,
        question: 'What interests you more?',
        options: [
            'Finding the correct answer',                  // A
            'Understanding why it is that way',            // B
            'Making something that works',                 // C
        ],
    },
    {
        id: 7,
        question: 'Why do you want a hobby?',
        options: [
            'I want a skill useful for my career',         // A
            'I want to improve my focus',                  // B
            'I want to replace social media with something useful', // C
        ],
    },
    {
        id: 8,
        question: 'What do you want to improve right now?',
        options: [
            'Coding or logic',                             // A
            'Language skills',                             // B
            'Focus and thinking',                          // C
        ],
    },
    {
        id: 9,
        question: 'Tough task — what do you do?',
        options: [
            'I break it into steps',                       // A
            'I look for an explanation',                   // B
            'I try different approaches',                  // C
        ],
    },
    {
        id: 10,
        question: 'What is easier for you to retain?',
        options: [
            'An algorithm or rule',                        // A
            'A word or story',                             // B
            'Something I did with my own hands',           // C
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
