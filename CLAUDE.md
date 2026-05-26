# CLAUDE.md — Zenyth.ai

Контекст проекта для Claude Code и других AI-ассистентов. Поддерживай этот файл актуальным при существенных изменениях архитектуры.

## Концепция продукта

**Zenyth.ai** — приложение для осознанного развития хобби и цифрового благополучия. Объединяет:

- **AI-подбор хобби** через персонализированный квиз (8-мерный профиль личности)
- **Структурированные ежедневные задачи** по выбранному хобби: theory → practice → analysis → puzzles
- **30-минутные фокус-сессии** с отслеживанием подзадач и оценкой качества
- **Аналитику экранного времени** (нативные модули iOS/Android)
- **AI-коуча** (Gemini 2.5-flash) для персональных советов
- **Недельное планирование** с разбивкой по типам активности
- **Стрики и метрики прогресса**

**Целевая аудитория**: пользователи, осознанно подходящие к цифровой гигиене, желающие освоить новое хобби и поддерживать стабильную практику.

**Основные флоу**:
1. **Onboarding**: Welcome → квиз личности → рекомендация хобби → подписка/free
2. **Daily Loop**: Home (дневной план) → Session Timer (30 мин) → Summary → метрики
3. **Discovery**: AI Coach (чат) ↔ Weekly Plan ↔ Screen Time analytics

## Технологический стек

### Frontend
- **React Native 0.81.5** + **Expo SDK 54.0.33**
- **Expo Router 6** (file-based routing в `app/`)
- **React 19.1.0**, React Native Web 0.21.2 (для web-сборки)
- **TypeScript 5.9** в strict-режиме

### State management
- **Zustand 4.4.7** — 11+ стораджей в `src/store/`:
  - `authStore`, `userProfileStore`, `taskStore`, `subscriptionStore`
  - `deviceScreenTimeStore`, `screenTimeStore`, `hobbyTimeStore`
  - `contentStore`, `earningsStore`, `quizStore`, `languageStore`

### Backend
- **Supabase** (Auth + Postgres + Edge Functions) — в `supabase/`
  - Email/password, Google, Apple Sign-In
  - RLS политики на все user-таблицы
- **Cloudflare Workers** (`workers/ai-proxy/`) — прокси для Gemini API
  - Ключ Gemini хранится только на сервере
  - URL по умолчанию: `https://ai-proxy.ppolqx065.workers.dev`

### AI
- **Google Gemini 2.5-flash** через Worker proxy (`src/services/ai.ts`)
- Локальный fallback: `src/services/gemini.ts`

### Native modules (`modules/`)
- **device-activity** — экранное время и app usage (iOS DeviceActivity / Android UsageStatsManager)
- **sms-reader** — доступ к SMS (Android)

### Монетизация
- **expo-iap 3.4.10** — подписки `com.zenyth.premium.monthly|annual`
- Логика в `src/services/iapService.ts`

### Animations & UI
- **react-native-reanimated 4.1.1** (spring physics, паттерны в `src/utils/animations.ts`)
- **expo-linear-gradient**, **expo-blur**
- **react-native-pager-view** (с web-fallback `.web.tsx`)
- Иконки: PNG в `/icons/` + `@expo/vector-icons`

## Структура проекта

```
app/                       # Expo Router (роуты)
  (auth)/                  # Логин, регистрация, recovery
  (app)/                   # Основные экраны (home, weekly-plan, ai-coach...)
  _layout.tsx              # Root layout + deep linking
src/
  components/              # Переиспользуемые UI-компоненты
    session/               # Компоненты сессии (Timer, Chat, Drawer...)
    ui/                    # Generic модалки
  screens/                 # Screen-компоненты (используются роутами)
    tabs/                  # Содержимое табов
  services/                # Бизнес-логика
    supabase/              # DB/Auth (18 файлов)
    taskEngine.ts          # Генерация задач (CORE, ~87KB)
    ai.ts, gemini.ts       # AI-интеграции
    iapService.ts          # In-app purchases
  store/                   # Zustand стораджи
  theme/                   # Design system (см. design-system.md)
  config/                  # routes.ts, навигационные константы
  utils/                   # Утилиты (date, animations, scaling)
  hooks/                   # Кастомные хуки (useTimer)
  domain/                  # Доменные правила (tasks/, earnings/)
  locales/                 # i18n
  types/                   # TypeScript типы
modules/                   # Нативные модули (device-activity, sms-reader)
workers/ai-proxy/          # Cloudflare Worker для Gemini
supabase/                  # Миграции, edge functions, конфиг
plugins/                   # Expo config plugins
```

### TypeScript path aliases (tsconfig.json)
- `@/*` → `src/*`
- `@components/*`, `@screens/*`, `@theme/*`, `@services/*`, `@store/*`

## Соглашения по коду

- **Компоненты**: PascalCase (`HomeScreen`, `SessionChat`)
- **Хуки/функции**: camelCase (`useTimer`, `scaleWidth`)
- **Константы**: UPPER_SNAKE_CASE (`TOTAL_TIME`, `STORAGE_KEY_PREF`)
- **Стораджи/сервисы**: camelCase + суффикс (`useAuthStore`, `taskService`)
- **Типы/интерфейсы**: PascalCase, экспорт через `export interface/type`
- **Стили**: `createStyles(colors)` factory + `useMemo` на уровне компонента
- **Адаптивность**: ВСЕ размеры через `scaleWidth/scaleHeight/scaleFont/moderateScale` из `src/theme`
- **Анимации**: reanimated с spring (damping/stiffness/mass), паттерны в `src/utils/animations.ts`

## Модель данных (Supabase)

| Таблица | Назначение |
|---|---|
| `user_profiles` | Профиль, премиум, personality_type, стрик |
| `quiz_answers` | Ответы квиза (JSONB) |
| `user_hobbies` | Выбранные хобби, skill_level, total_practice_minutes |
| `tasks` | Задачи (type: theory/practice/analysis/puzzles, status, ratings) |
| `sessions` | Завершённые сессии (длительность, focus_score, quality) |
| `user_state_snapshot` | Снапшот состояния (стрик, weakness_tags, ai_focus_area) |
| `ai_jobs` | Очередь AI-задач (PROFILE_UPDATE/REBUILD_DAY) |
| `user_metrics_history` | Дневные метрики |
| `screen_time_logs` | Логи экранного времени с устройства |
| `earnings` | Награды/очки |

RLS: каждая таблица фильтрует по `user_id = auth.uid()`.

## Сборка и деплой

- **iOS**: EAS Build (`development`/`preview`/`production`), iOS 16+, bundle `com.zenyth.ai`, App Store ID `6759964271`
- **Android**: package `com.zenyth.ai`, разрешения `PACKAGE_USAGE_STATS`, `READ_SMS`
- **Web**: Vercel, `expo export -p web` → `dist/`, SPA rewrite в `vercel.json`
- **Worker**: `cd workers/ai-proxy && npx wrangler deploy`

### Скрипты
- `npm start` — Expo dev server
- `npm run ios` / `npm run android` / `npm run web`
- `npm run build` — экспорт web-сборки
- `npm run lint` / `npm run test`

### Переменные окружения
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_AI_PROXY_URL`
- `EXPO_PUBLIC_GEMINI_API_KEY` (только локальный fallback)

## Принципы разработки

1. **Light mode only** — тёмная тема пока не поддерживается. Не вводи `useColorScheme` без необходимости.
2. **Всё через теорию дизайн-системы** — цвета, отступы, типографика, радиусы только из `src/theme`. См. `design-system.md`.
3. **Адаптивность обязательна** — никаких хардкод-размеров, только scale-функции.
4. **AI-ключи только на сервере** — никогда не клади Gemini API key в клиент. Используй Worker proxy.
5. **RLS first** — при создании новых таблиц всегда добавляй RLS-политики.
6. **Zustand вместо Context** — для глобального состояния используем Zustand-стораджи в `src/store/`.
7. **Деплинки** — обработка в `app/_layout.tsx`, не дублировать в экранах.
8. **Тесты** — Jest настроен (`jest.config.js`), тесты в `src/__tests__/`. Моки RN и AsyncStorage уже есть.
9. **Дизайн-канва Figma** — 402×874 px (iPhone 14 Pro). Все размеры из дизайна масштабируются через `scaleWidth/scaleHeight`.

## Полезные точки входа

- **Task engine**: `src/services/taskEngine.ts` — ядро генерации дневных планов (28-дневная ротация банка задач)
- **Routing**: `src/config/routes.ts` — типизированные роут-константы
- **Theme**: `src/theme/index.ts` — все токены дизайн-системы
- **Auth flow**: `app/_layout.tsx` + `src/store/authStore.ts` + `src/services/supabase/`
- **AI calls**: `src/services/ai.ts` (через Worker), `src/services/gemini.ts` (fallback)
- **Native screen time**: `modules/device-activity/`
- **Navigation reorg**: см. `docs/NAVIGATION_CONSOLIDATION.md`

## История и контекст

- Бэкенд мигрирован на Cloudflare Workers (см. коммит `5eb588b`)
- Добавлена поддержка iPad
- Релиз в TestFlight выполнен (коммит `1c73409`)
- Account deletion и связанные fallback-механизмы реализованы (`6ff88f0`)
