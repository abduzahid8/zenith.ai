/**
 * gamificationStore.ts
 * Центральное Zustand-хранилище для игровой механики Zenyth.AI.
 * Управляет: чеклистом дня, streak с заморозкой, артефактами,
 * текущим днём по каждому хобби и системой бейджей (ачивок).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HobbyId } from '../data/lessonContent';

// ─────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────

export interface Artifact {
  id: string;
  date: string;           // ISO: "2026-05-26"
  hobbyId: HobbyId;
  lessonId: string;       // напр. "english_d1"
  taskType: 'do' | 'deepen1' | 'deepen2';
  userInput: string;      // Ответ пользователя
  aiFeedback: string;     // Оценка AI
}

export interface RepetitionItem {
  id: string;
  lessonId: string;
  hobbyId: HobbyId;
  question: string;
  correctAnswer?: string;
  createdAt: string;
  reviewDates: string[];  // ISO-даты плановых повторений
  completedReviews: number;
}

export interface Badge {
  id: string;
  title: string;
  emoji: string;
  unlockedAt: string;     // ISO datetime
}

// Определения всех бейджей
export const BADGE_DEFINITIONS: Record<string, { title: string; emoji: string; description: string }> = {
  first_session:  { title: 'Первый шаг сделан!',      emoji: '🎯', description: 'Завершил(а) первое задание' },
  streak_3:       { title: '3 дня подряд',              emoji: '🔥', description: 'Занимался(ась) 3 дня без пропуска' },
  streak_7:       { title: 'Неделя без пропусков',      emoji: '🔥', description: '7 дней активности подряд' },
  streak_30:      { title: 'Месяц дисциплины',          emoji: '🏆', description: '30 дней непрерывного обучения' },
  unit_complete:  { title: 'Первая тема освоена',        emoji: '📘', description: 'Прошёл(а) первый полный юнит' },
  artifacts_10:   { title: '10 работ в библиотеке',      emoji: '📦', description: 'Накопил(а) 10 выполненных заданий' },
  artifacts_50:   { title: '50 работ — серьёзная коллекция', emoji: '🗄️', description: '50 артефактов в библиотеке' },
  freeze_survived:{ title: 'Заморозка спасла streak!',   emoji: '❄️', description: 'Заморозка защитила твою серию' },
  first_code_run: { title: 'Первый код запущен!',        emoji: '🐍', description: 'Запустил(а) первую Python-программу' },
  chess_solver:   { title: 'Шахматный решатель',         emoji: '♟', description: 'Решил(а) первую шахматную задачу' },
  polyglot:       { title: 'Полиглот',                   emoji: '🌍', description: 'Занимался(ась) двумя языками в один день' },
};

export type BadgeId = keyof typeof BADGE_DEFINITIONS;

// ─────────────────────────────────────────────
// Вспомогательные функции для работы с датами
// ─────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]; // "2026-05-26"
}

function getYesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getDaysDiff(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
}

function getMondayString(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=воскресенье, 1=пн ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getSpacedRepetitionDates(fromDate: string): string[] {
  const dates: string[] = [];
  const offsets = [1, 7, 30]; // дни до следующего повторения
  offsets.forEach(offset => {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + offset);
    dates.push(d.toISOString().split('T')[0]);
  });
  return dates;
}

// ─────────────────────────────────────────────
// Тип состояния стора
// ─────────────────────────────────────────────

interface DailyChecklist {
  learn: boolean;
  do: boolean;
  deepen1: boolean;
  deepen2: boolean;
}

interface GamificationState {
  // Чеклист текущего дня
  dailyChecklist: DailyChecklist;
  lastChecklistDate: string | null;   // Дата последнего чеклиста (для сброса)

  // Streak с заморозкой
  currentStreak: number;
  lastActiveDate: string | null;
  weeklyFreezeUsed: boolean;
  weeklyFreezeWeekStart: string | null;
  freezeActivatedToday: boolean;       // Флаг для показа уведомления о заморозке

  // Лимиты сессий
  sessionsCompletedToday: number;
  lastSessionDate: string | null;

  // Текущий день обучения по каждому хобби
  currentDay: Record<HobbyId, number>;

  // Прогресс юнитов (каждый юнит = 7 дней)
  unitProgress: Record<string, boolean>;  // "english_unit1" => true

  // Артефакты (сохранённые работы)
  artifacts: Artifact[];

  // Интервальное повторение
  repetitionItems: RepetitionItem[];

  // Бейджи
  unlockedBadges: Badge[];
  pendingBadge: BadgeId | null;

  // Флаги сессии
  currentSessionHobby: HobbyId | null;
  codeRunCount: number;               // Счётчик запусков Python-кода
  chessTaskSolved: boolean;           // Решена ли хоть одна шахматная задача

  // ─── Действия ───

  /** Отметить шаг текущего урока как завершённый */
  markStepComplete: (step: 'learn' | 'do' | 'deepen1' | 'deepen2') => void;

  /** Сбросить чеклист дня (вызывается при начале новой сессии) */
  resetDailyChecklist: () => void;

  /** Обновить streak при открытии приложения */
  updateStreak: () => void;

  /** Сохранить выполненное задание как артефакт (возвращает id для ссылок) */
  saveArtifact: (artifact: Omit<Artifact, 'id' | 'date'>) => string;

  /** Перейти к следующему дню обучения по хобби */
  advanceDay: (hobby: HobbyId) => void;

  /** Проверить и разблокировать бейджи */
  checkAndUnlockBadges: () => void;

  /** Убрать показ текущего бейджа */
  dismissBadge: () => void;

  /** Начать сессию с указанным хобби */
  startSession: (hobby: HobbyId) => void;

  /** Зафиксировать запуск Python-кода */
  recordCodeRun: () => void;

  /** Увеличить счетчик выполненных сессий за сегодня */
  incrementSessionsCompleted: () => void;

  /** Проверить, может ли пользователь начать новую сессию */
  canStartSession: (isPremium: boolean) => boolean;

  /** Зафиксировать решение шахматной задачи */
  recordChessSolve: () => void;

  /** Получить задачи на повторение на сегодня */
  getItemsDueToday: () => RepetitionItem[];

  /** Отметить повторение как завершённое */
  completeRepetition: (itemId: string) => void;

  /** Сбросить всё (выход из аккаунта) */
  resetGamification: () => void;
}

// ─────────────────────────────────────────────
// Начальное состояние
// ─────────────────────────────────────────────

const initialState: Omit<GamificationState,
  | 'markStepComplete' | 'resetDailyChecklist' | 'updateStreak'
  | 'saveArtifact' | 'advanceDay' | 'checkAndUnlockBadges'
  | 'dismissBadge' | 'startSession' | 'recordCodeRun'
  | 'recordChessSolve' | 'getItemsDueToday' | 'completeRepetition'
  | 'resetGamification' | 'incrementSessionsCompleted' | 'canStartSession'
> = {
  dailyChecklist: { learn: false, do: false, deepen1: false, deepen2: false },
  lastChecklistDate: null,
  currentStreak: 0,
  lastActiveDate: null,
  weeklyFreezeUsed: false,
  weeklyFreezeWeekStart: null,
  freezeActivatedToday: false,
  sessionsCompletedToday: 0,
  lastSessionDate: null,
  currentDay: { english: 1, chess: 1, chinese: 1, coding: 1, python: 1, reading: 1 },
  unitProgress: {},
  artifacts: [],
  repetitionItems: [],
  unlockedBadges: [],
  pendingBadge: null,
  currentSessionHobby: null,
  codeRunCount: 0,
  chessTaskSolved: false,
};

// ─────────────────────────────────────────────
// Стор
// ─────────────────────────────────────────────

export const useGamificationStore = create<GamificationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── startSession ──────────────────────────────────────────
      startSession: (hobby: HobbyId) => {
        const today = getTodayString();
        const { lastChecklistDate } = get();

        // Если новый день — сбрасываем чеклист
        if (lastChecklistDate !== today) {
          set({
            dailyChecklist: { learn: false, do: false, deepen1: false, deepen2: false },
            lastChecklistDate: today,
            currentSessionHobby: hobby,
            freezeActivatedToday: false,
          });
        } else {
          set({ currentSessionHobby: hobby });
        }

        get().updateStreak();
      },

      // ── markStepComplete ──────────────────────────────────────
      markStepComplete: (step) => {
        set(state => ({
          dailyChecklist: {
            ...state.dailyChecklist,
            [step]: true,
          },
        }));

        // Проверяем бейджи после каждого шага
        get().checkAndUnlockBadges();
      },

      // ── resetDailyChecklist ───────────────────────────────────
      resetDailyChecklist: () => {
        set({
          dailyChecklist: { learn: false, do: false, deepen1: false, deepen2: false },
          lastChecklistDate: getTodayString(),
        });
      },

      // ── updateStreak ──────────────────────────────────────────
      updateStreak: () => {
        const today = getTodayString();
        const yesterday = getYesterdayString();
        const {
          lastActiveDate,
          currentStreak,
          weeklyFreezeUsed,
          weeklyFreezeWeekStart,
        } = get();

        // Уже обновляли сегодня — ничего не делаем
        if (lastActiveDate === today) return;

        const currentMonday = getMondayString(today);

        // Первый раз вообще
        if (!lastActiveDate) {
          set({
            currentStreak: 1,
            lastActiveDate: today,
            weeklyFreezeWeekStart: currentMonday,
            weeklyFreezeUsed: false,
          });
          return;
        }

        const daysDiff = getDaysDiff(lastActiveDate, today);

        if (daysDiff === 1) {
          // Занимался вчера — streak продолжается
          set({
            currentStreak: currentStreak + 1,
            lastActiveDate: today,
          });
        } else if (daysDiff === 2) {
          // Пропустил один день
          const shouldResetFreeze = weeklyFreezeWeekStart !== currentMonday;

          if (!weeklyFreezeUsed || shouldResetFreeze) {
            // Используем заморозку
            set({
              currentStreak: currentStreak, // streak сохраняется
              lastActiveDate: today,
              weeklyFreezeUsed: true,
              weeklyFreezeWeekStart: currentMonday,
              freezeActivatedToday: true,
            });
          } else {
            // Заморозка уже использована — сбрасываем
            set({
              currentStreak: 1,
              lastActiveDate: today,
              weeklyFreezeUsed: shouldResetFreeze ? false : true,
              weeklyFreezeWeekStart: currentMonday,
              freezeActivatedToday: false,
            });
          }
        } else {
          // Пропустил 2+ дня — streak сбрасывается
          const resetFreeze = weeklyFreezeWeekStart !== currentMonday;
          set({
            currentStreak: 1,
            lastActiveDate: today,
            weeklyFreezeUsed: resetFreeze ? false : weeklyFreezeUsed,
            weeklyFreezeWeekStart: currentMonday,
            freezeActivatedToday: false,
          });
        }

        get().checkAndUnlockBadges();
      },

      // ── saveArtifact ──────────────────────────────────────────
      saveArtifact: (artifact) => {
        const newArtifact: Artifact = {
          ...artifact,
          id: `artifact_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          date: getTodayString(),
        };

        set(state => ({
          artifacts: [newArtifact, ...state.artifacts],
        }));

        // Добавляем в очередь интервального повторения (только для заданий с правильным ответом)
        if (artifact.userInput && artifact.taskType === 'do') {
          const repItem: RepetitionItem = {
            id: `rep_${Date.now()}`,
            lessonId: artifact.lessonId,
            hobbyId: artifact.hobbyId,
            question: '(повторение задания)',
            createdAt: new Date().toISOString(),
            reviewDates: getSpacedRepetitionDates(getTodayString()),
            completedReviews: 0,
          };
          set(state => ({
            repetitionItems: [...state.repetitionItems, repItem],
          }));
        }

        get().checkAndUnlockBadges();
        return newArtifact.id;
      },

      // ── advanceDay ────────────────────────────────────────────
      advanceDay: (hobby: HobbyId) => {
        const { currentDay } = get();
        const nextDay = (currentDay[hobby] || 1) + 1;

        // Проверяем завершение юнита (каждые 7 дней)
        const newUnitProgress = { ...get().unitProgress };
        if (nextDay % 7 === 1) {
          const unitKey = `${hobby}_unit${Math.floor((nextDay - 1) / 7)}`;
          newUnitProgress[unitKey] = true;
        }

        set(state => ({
          currentDay: { ...state.currentDay, [hobby]: nextDay },
          unitProgress: newUnitProgress,
        }));

        get().checkAndUnlockBadges();
      },

      // ── checkAndUnlockBadges ──────────────────────────────────
      checkAndUnlockBadges: () => {
        const {
          artifacts,
          currentStreak,
          unitProgress,
          unlockedBadges,
          weeklyFreezeUsed,
          codeRunCount,
          chessTaskSolved,
          pendingBadge,
        } = get();

        const alreadyUnlocked = new Set(unlockedBadges.map(b => b.id));

        const candidates: BadgeId[] = [];

        if (artifacts.length >= 1 && !alreadyUnlocked.has('first_session')) {
          candidates.push('first_session');
        }
        if (currentStreak >= 3 && !alreadyUnlocked.has('streak_3')) {
          candidates.push('streak_3');
        }
        if (currentStreak >= 7 && !alreadyUnlocked.has('streak_7')) {
          candidates.push('streak_7');
        }
        if (currentStreak >= 30 && !alreadyUnlocked.has('streak_30')) {
          candidates.push('streak_30');
        }
        if (Object.values(unitProgress).some(v => v) && !alreadyUnlocked.has('unit_complete')) {
          candidates.push('unit_complete');
        }
        if (artifacts.length >= 10 && !alreadyUnlocked.has('artifacts_10')) {
          candidates.push('artifacts_10');
        }
        if (artifacts.length >= 50 && !alreadyUnlocked.has('artifacts_50')) {
          candidates.push('artifacts_50');
        }
        if (weeklyFreezeUsed && currentStreak > 0 && !alreadyUnlocked.has('freeze_survived')) {
          candidates.push('freeze_survived');
        }
        if (codeRunCount >= 1 && !alreadyUnlocked.has('first_code_run')) {
          candidates.push('first_code_run');
        }
        if (chessTaskSolved && !alreadyUnlocked.has('chess_solver')) {
          candidates.push('chess_solver');
        }

        if (candidates.length === 0) return;

        // Разблокируем ВСЕ подходящие бейджи за один раз
        const newBadges: Badge[] = candidates.map(badgeId => {
          const def = BADGE_DEFINITIONS[badgeId];
          return {
            id: badgeId,
            title: `${def.emoji} ${def.title}`,
            emoji: def.emoji,
            unlockedAt: new Date().toISOString(),
          };
        }).filter(Boolean);

        set(state => ({
          unlockedBadges: [...state.unlockedBadges, ...newBadges],
          // Показываем первый новый бейдж (если сейчас нет ожидающего)
          pendingBadge: state.pendingBadge ?? candidates[0],
        }));
      },

      // ── dismissBadge ──────────────────────────────────────────
      dismissBadge: () => {
        set({ pendingBadge: null });
      },

      // ── recordCodeRun ─────────────────────────────────────────
      recordCodeRun: () => {
        set(state => ({ codeRunCount: state.codeRunCount + 1 }));
        get().checkAndUnlockBadges();
      },

      // ── incrementSessionsCompleted ────────────────────────────
      incrementSessionsCompleted: () => {
        const today = getTodayString();
        const { lastSessionDate, sessionsCompletedToday } = get();

        if (lastSessionDate !== today) {
          set({
            sessionsCompletedToday: 1,
            lastSessionDate: today,
          });
        } else {
          set({
            sessionsCompletedToday: sessionsCompletedToday + 1,
            lastSessionDate: today,
          });
        }
      },

      // ── canStartSession ───────────────────────────────────────
      canStartSession: (isPremium: boolean) => {
        try {
          const { useAuthStore } = require('./authStore');
          const email = useAuthStore.getState().user?.email;
          if (email === 'dovud.jurayev@icloud.com') {
            console.log('[gamificationStore] canStartSession: Bypassed daily session limit for dovud.jurayev@icloud.com');
            return true;
          }
        } catch (e) {
          console.warn('[gamificationStore] Failed to check premium email bypass:', e);
        }

        const today = getTodayString();
        const { lastSessionDate, sessionsCompletedToday } = get();

        // Если сегодня еще не было сессий, то можно начать
        if (lastSessionDate !== today) return true;

        const maxSessions = isPremium ? 3 : 1;
        return sessionsCompletedToday < maxSessions;
      },

      // ── recordChessSolve ──────────────────────────────────────
      recordChessSolve: () => {
        set({ chessTaskSolved: true });
        get().checkAndUnlockBadges();
      },

      // ── getItemsDueToday ──────────────────────────────────────
      getItemsDueToday: () => {
        const today = getTodayString();
        return get().repetitionItems.filter(item => {
          const nextReviewDate = item.reviewDates[item.completedReviews];
          return nextReviewDate && nextReviewDate <= today;
        });
      },

      // ── completeRepetition ────────────────────────────────────
      completeRepetition: (itemId: string) => {
        set(state => ({
          repetitionItems: state.repetitionItems.map(item =>
            item.id === itemId
              ? { ...item, completedReviews: item.completedReviews + 1 }
              : item
          ).filter(item => item.completedReviews < item.reviewDates.length),
        }));
      },

      // ── resetGamification ─────────────────────────────────────
      resetGamification: () => {
        set(initialState as any);
      },
    }),
    {
      name: 'gamification-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

// ─────────────────────────────────────────────
// Вспомогательные селекторы (для компонентов)
// ─────────────────────────────────────────────

/** Процент завершения чеклиста дня (0-100) */
export function getDailyProgress(checklist: DailyChecklist, isPremium: boolean): number {
  const steps = isPremium
    ? [checklist.learn, checklist.do, checklist.deepen1, checklist.deepen2]
    : [checklist.learn, checklist.do];
  const completed = steps.filter(Boolean).length;
  return Math.round((completed / steps.length) * 100);
}

/** Сколько осталось шагов на сегодня */
export function getRemainingSteps(checklist: DailyChecklist, isPremium: boolean): number {
  const steps = isPremium
    ? [checklist.learn, checklist.do, checklist.deepen1, checklist.deepen2]
    : [checklist.learn, checklist.do];
  return steps.filter(v => !v).length;
}
