import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';

export type Language = 'ru' | 'en';

interface LanguageState {
    language: Language;
    setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
    persist(
        (set) => ({
            language: 'ru',
            setLanguage: (language) => set({ language }),
        }),
        {
            name: 'language-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);

// Translation dictionary
const translations: Record<string, Record<Language, string>> = {
    // Greetings
    'Доброй ночи': { ru: 'Доброй ночи', en: 'Good night' },
    'Доброе утро': { ru: 'Доброе утро', en: 'Good morning' },
    'Добрый день': { ru: 'Добрый день', en: 'Good afternoon' },
    'Добрый вечер': { ru: 'Добрый вечер', en: 'Good evening' },

    // Navigation / Side menu
    'Основное': { ru: 'Основное', en: 'Main' },
    'Развитие': { ru: 'Развитие', en: 'Growth' },
    'Управление': { ru: 'Управление', en: 'Settings' },
    'О продукте': { ru: 'О продукте', en: 'About' },
    'Главная': { ru: 'Главная', en: 'Home' },
    'Хобби и план': { ru: 'Хобби и план', en: 'Hobbies & Plan' },
    'AI-наставник': { ru: 'AI-наставник', en: 'AI Coach' },
    'Подборка контента': { ru: 'Подборка контента', en: 'Content Collection' },
    'Достижения и бейджи': { ru: 'Достижения и бейджи', en: 'Achievements & Badges' },
    'Настройки': { ru: 'Настройки', en: 'Settings' },
    'Уведомления': { ru: 'Уведомления', en: 'Notifications' },
    'Как это работает': { ru: 'Как это работает', en: 'How It Works' },
    'Обратная связь': { ru: 'Обратная связь', en: 'Feedback' },
    'Поделиться с другом': { ru: 'Поделиться с другом', en: 'Share with a Friend' },
    'Выйти': { ru: 'Выйти', en: 'Log Out' },
    'Язык': { ru: 'Язык', en: 'Language' },
    'Удалить аккаунт': { ru: 'Удалить аккаунт', en: 'Delete Account' },
    'Вы уверены?': { ru: 'Вы уверены?', en: 'Are you sure?' },
    'Это действие необратимо. Все ваши данные будут удалены.': {
        ru: 'Это действие необратимо. Все ваши данные будут удалены.',
        en: 'This action is permanent. All your data will be deleted.'
    },
    'Удалить': { ru: 'Удалить', en: 'Delete' },
    'Отмена': { ru: 'Отмена', en: 'Cancel' },
    'Управление подпиской': { ru: 'Управление подпиской', en: 'Manage Subscription' },

    // Tasks
    'Твой день': { ru: 'Твой день', en: 'Your Day' },
    'Теория': { ru: 'Теория', en: 'Theory' },
    'Практика': { ru: 'Практика', en: 'Practice' },
    'Анализ': { ru: 'Анализ', en: 'Analysis' },
    'Задачи': { ru: 'Задачи', en: 'Tasks' },
    'Задача': { ru: 'Задача', en: 'Task' },
    'Твои задачи': { ru: 'Твои задачи', en: 'Your Tasks' },
    'Узнай': { ru: 'Узнай', en: 'Learn' },
    'Сделай': { ru: 'Сделай', en: 'Practice' },
    'Углуби 1': { ru: 'Углуби 1', en: 'Deepen 1' },
    'Углуби 2': { ru: 'Углуби 2', en: 'Deepen 2' },

    // Session Timer
    'Завершить': { ru: 'Завершить', en: 'Finish' },

    // Home
    'Начать занятие': { ru: 'Начать занятие', en: 'Start Session' },
    'Экранное время': { ru: 'Экранное время', en: 'Screen Time' },
    'За последнюю неделю': { ru: 'За последнюю неделю', en: 'This past week' },

    // Auth
    'Вход': { ru: 'Вход', en: 'Login' },
    'Регистрация': { ru: 'Регистрация', en: 'Registration' },
    'Почта': { ru: 'Почта', en: 'Email' },
    'Пароль': { ru: 'Пароль', en: 'Password' },
    'Войти': { ru: 'Войти', en: 'Sign In' },
    'Зарегистрироваться': { ru: 'Зарегистрироваться', en: 'Sign Up' },
    'Или': { ru: 'Или', en: 'Or' },
    'Войти с Google': { ru: 'Войти с Google', en: 'Sign in with Google' },
    'Войти с Apple': { ru: 'Войти с Apple', en: 'Sign in with Apple' },
    'Забыли пароль?': { ru: 'Забыли пароль?', en: 'Forgot password?' },
    'Запомнить меня': { ru: 'Запомнить меня', en: 'Remember me' },

    // Subscription
    'Premium': { ru: 'Премиум', en: 'Premium' },
    'Free': { ru: 'Бесплатный', en: 'Free' },
    'Trial': { ru: 'Пробный', en: 'Trial' },

    // Alerts / Popups
    'Ошибка': { ru: 'Ошибка', en: 'Error' },
    'Заполните все поля': { ru: 'Заполните все поля', en: 'Please fill in all fields' },
    'Поздравляем!': { ru: 'Поздравляем!', en: 'Congratulations!' },
    'Все задачи выполнены!': { ru: 'Все задачи выполнены!', en: 'All tasks completed!' },
    'Вы выполнили все задачи на сегодня. Отличная работа!': {
        ru: 'Вы выполнили все задачи на сегодня. Отличная работа!',
        en: 'You completed all tasks for today. Great job!'
    },
    'Начать': { ru: 'Начать', en: 'Start' },
    'Скоро': { ru: 'Скоро', en: 'Coming soon' },
    'Этот раздел находится в разработке и скоро будет доступен.': {
        ru: 'Этот раздел находится в разработке и скоро будет доступен.',
        en: 'This section is under development and will be available soon.'
    },

    // Misc
    'Пользователь': { ru: 'Пользователь', en: 'User' },
    'Политика\nКонфиденциальности': { ru: 'Политика\nКонфиденциальности', en: 'Privacy\nPolicy' },
    'Личный наставник': { ru: 'Личный наставник', en: 'Personal Coach' },
    'Цель дня': { ru: 'Цель дня', en: 'Daily Goal' },
    'Отличная работа!': { ru: 'Отличная работа!', en: 'Great job!' },
    'Ты выполнил все задачи на сегодня! Продолжай в том же духе — каждый день делает тебя лучше.': {
        ru: 'Ты выполнил все задачи на сегодня! Продолжай в том же духе — каждый день делает тебя лучше.',
        en: 'You completed all tasks for today! Keep it up — every day makes you better.',
    },
    'Достигни\nсвоего зенита!': { ru: 'Достигни\nсвоего зенита!', en: 'Reach\nyour zenith!' },
    'Как быстрее прогрессировать?': { ru: 'Как быстрее прогрессировать?', en: 'How to progress faster?' },
    'Объясни мой прогресс': { ru: 'Объясни мой прогресс', en: 'Explain my progress' },
    'Что сделать сегодня?': { ru: 'Что сделать сегодня?', en: 'What should I do today?' },
    'Чем я могу помочь?': { ru: 'Чем я могу помочь?', en: 'How can I help?' },
    'Не удалось удалить аккаунт': { ru: 'Не удалось удалить аккаунт', en: 'Failed to delete account' },

    // AI Coach
    'Думаю...': { ru: 'Думаю...', en: 'Thinking...' },
    'Извините, произошла ошибка. Попробуйте еще раз.': { ru: 'Извините, произошла ошибка. Попробуйте еще раз.', en: 'Sorry, an error occurred. Please try again.' },

    // Congratulations page
    'Перейти к входу': { ru: 'Перейти к входу', en: 'Go to Login' },

    // Forgot password
    'Восстановление пароля': { ru: 'Восстановление пароля', en: 'Password Recovery' },
    'Введите email в поле выше, затем нажмите «Забыли пароль?»': {
        ru: 'Введите email в поле выше, затем нажмите «Забыли пароль?»',
        en: 'Enter your email above, then tap "Forgot password?"'
    },
    'Письмо отправлено': { ru: 'Письмо отправлено', en: 'Email sent' },
};

/**
 * Translate a key to the current language.
 * Falls back to the key itself if no translation is found.
 * Use this only outside of React components (e.g. in store helpers).
 */
export const t = (key: string): string => {
    const lang = useLanguageStore.getState().language;
    return translations[key]?.[lang] ?? key;
};

/**
 * React hook that returns a reactive `t()` function.
 * Components using this hook will automatically re-render when the language changes.
 *
 * Usage inside a component:
 *   const t = useT();
 *   <Text>{t('Основное')}</Text>
 */
export const useT = (): ((key: string) => string) => {
    const language = useLanguageStore((s) => s.language);
    return useCallback(
        (key: string): string => translations[key]?.[language] ?? key,
        [language],
    );
};

export default useLanguageStore;
