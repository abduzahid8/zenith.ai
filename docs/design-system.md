# Zenyth Design System

Единая система дизайн-токенов и компонентов. Источник истины — `src/theme/index.ts`. Все UI должны использовать токены отсюда, без хардкода.

## Основные принципы

1. **Light mode only** — тёмная тема не поддерживается.
2. **Figma base canvas**: 402 × 874 px (iPhone 14 Pro). Все размеры из дизайна обязательно масштабируются.
3. **Минимализм + acid accent** — спокойные нейтральные фоны, яркий cyan-акцент для CTA и активных состояний.
4. **Кастомные шрифты** — Gramatika (заголовки) + Geometria (тело).
5. **Адаптивность через scale-функции** — никаких фиксированных px вне scale().

## Цветовая палитра

### Brand & primary
| Токен | HEX | Использование |
|---|---|---|
| `primary` | `#1AFFD5` | Основной cyan, градиенты, активные состояния |
| `primaryGradientEnd` | `#00B7BF` | Конец основного градиента |
| `brand / dark` | `#15211F` | Тёмный брендовый акцент |
| `buttonPrimary` | `#102852` | Тёмно-синий primary button |

### Backgrounds
| Токен | HEX |
|---|---|
| `background` | `#EAF0F8` (главный фон) |
| `surface` | `#D9D9D9` (нейтральные карты) |
| `surfaceLight` | `#F5F5F5` (светлые поверхности) |

### Text
| Токен | HEX |
|---|---|
| `text.primary` | `#08132A` |
| `text.secondary` | `#666666` |
| `text.muted` | `#444444` |
| `text.light` | `#999999` |

### Status
| Токен | HEX |
|---|---|
| `success` | `#34C759` |
| `warning` | `#FF9500` |
| `error` | `#FF3B30` |

### Контекстные палитры

Сгруппированы в `lightColors` по фичам:

- **sessionTimer** (13 цветов): `primary #37A0EF`, `paused #DA37EF`, прогресс-кольцо и т.д.
- **statistics**: `screenTime #8CDEFF`, `hobby #F4C0FD`
- **aiCoach**: `bubble #D6DEF8`, `text #4E4E4E`
- **home**: card border, dark text, light bg
- **weeklyPlan** (5 цветов): фоны для theory / practice / analysis / tasks
- **subscription**, **hobbySelection**, **phoneAnalysis**, **auth**, **quiz**, **warningModal** — task-specific
- **nav**: `inactive #A3A3A3`, `active #000000`, floating bg `rgba(255,255,255,0.95)`

> При добавлении новой фичи добавляй её палитру в `lightColors`, не плодите inline-хексы.

## Типографика

### Шрифтовые семейства
- **Gramatika** (заголовки): Black, Bold, Medium, Regular, Light, ExtraLight (OTF + TTF)
- **Geometria** (тело): Light (как regular), Medium (OTF + TTF)
- **System** — fallback

### Type scale (из `getTypography()`)
| Токен | Size / Line-height / Weight |
|---|---|
| `h1` | 28 / 36 / Bold |
| `h2` | 22 / 28 / Bold |
| `h3` | 18 / 24 / Medium |
| `body` | 16 / 24 / Regular |
| `bodySmall` | 14 / 20 / Regular, цвет `secondary` |
| `label` | 14 / 20 / Regular, цвет `secondary` |
| `buttonText` | 20 / 24 / Bold |
| `buttonTextSmall` | 16 / 20 / Medium |
| `quizQuestion` | 24 / 32 / Bold |
| `quizOption` | 16 / 24 / Regular |
| `welcomeTitle` | 28 / 36 / Bold |
| `welcomeSubtitle` | 20 / 28 / Light |

Все стили включают `lineHeight` явно — не полагайся на дефолт RN.

## Spacing scale

| Токен | px |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 24 |
| `xl` | 32 |
| `xxl` | 48 |

## Border radius

| Токен | px |
|---|---|
| `sm` | 8 |
| `md` | 16 |
| `lg` | 25 |
| `full` | 100 |

## Адаптивное масштабирование

Все функции в `src/theme/`:

```ts
scaleWidth(size)        // от ширины экрана
scaleHeight(size)       // от высоты экрана
scaleFont(size)         // консервативное масштабирование шрифтов
moderateScale(size, factor=0.5)  // компромисс
```

Базовая канва: **402 × 874** (iPhone 14 Pro Figma).

Брейкпоинты устройств:
- **small**: < 375 px
- **medium**: 375–413 px
- **large**: ≥ 414 px

> Правило: любое число из дизайна → `scaleWidth(N)` (для X) или `scaleHeight(N)` (для Y/высот). Шрифты → `scaleFont(N)`.

## Анимации

Файл паттернов: `src/utils/animations.ts`. Все построены на **react-native-reanimated**.

| Паттерн | Описание |
|---|---|
| Screen entrance | `FadeInDown` + spring (damping 20, stiffness 100) |
| Header entrance | `FadeInDown` с quad easing |
| List item | Stagger `FadeInDown` (100 ms delay per item) |
| Card | `ZoomIn` + spring |
| Modal | `ZoomIn` + back easing, duration 250 ms |
| Button press | Spring (damping 10, stiffness 300, mass 0.5) |

> Не вводи новые анимационные конфиги без необходимости — переиспользуй паттерны.

## Иконки

- **Custom PNG** в `/icons/` (26 шт.): `fire`, `checkbox-*`, `menu`, `play`, `pause`, `stop`, `back` и т.д.
- Тинтинг через `tintColor: colors.text` или контекстный цвет.
- **@expo/vector-icons** доступен (`Ionicons`, `MaterialIcons`), но в проекте почти не используется — предпочитай кастомные.

## Компонентная библиотека

Источник: `src/components/`.

### Базовые
- **Button** (`Button.tsx`) — варианты: `primary`, `secondary`, `outline`, `gradient`; размеры: `small`, `medium`, `large`; loading-state.
- **LucidGlassButton** — glassmorphic-вариант (используется в специфичных местах).
- **WarningModal**, **InfoModal**, **ConfirmModal** — диалоги.

### Навигация
- **BottomNavigation** — основной таб-бар (home, weekly-plan, ai-coach, screen-time).
- **NavigationSidebar** — боковое меню (профиль, настройки, выход, удаление аккаунта).
- **SwipeableNavigation** — жестовая навигация (альтернатива).

### Сессия (`src/components/session/`)
- **SessionChat** — чат с AI-коучем во время сессии.
- **SessionSummaryView** — пост-сессионная статистика (ring chart).
- **TimerProgress** — круговой прогресс таймера.
- **TaskDrawer** — выдвижная панель подзадач.
- **TimePickerModal** — настройка длительности.
- **StopConfirmationModal** — подтверждение остановки.

### Контент
- **HobbyCard**, **DailyTasksList**, **QuizOption**, **ProgressDots**

### Чарты
- **HobbyTimeBarChart** — недельный разбор по хобби.
- **WeeklyBarChart** — экранное время по категориям.
- **Logo** — анимированное лого Zenyth.

### Состояния UI
- **UIStateComponents** — скелетоны, empty-states.
- **ErrorBoundary** — fallback при ошибках.

### Платформо-зависимые
- **PagerView** + **PagerView.web.tsx** — таб-вью с web-fallback.

## Паттерны стилизации

```ts
// 1. createStyles factory с цветами в замыкании
const createStyles = (colors: Colors) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
});

// 2. useMemo в компоненте
const colors = useTheme();
const styles = useMemo(() => createStyles(colors), [colors]);
```

> Никогда не пиши hex/px-литералы внутри JSX — только через токены.

## Чек-лист при создании нового экрана/компонента

- [ ] Цвета взяты из `colors.*` (включая контекстную палитру, если фича специфична)
- [ ] Размеры обёрнуты в `scaleWidth/scaleHeight/scaleFont`
- [ ] Шрифты применены через `typography.*`
- [ ] Spacing — только токены (`spacing.xs..xxl`)
- [ ] Радиусы — только `borderRadius.*`
- [ ] Анимации — паттерны из `src/utils/animations.ts`
- [ ] Используется `createStyles(colors)` + `useMemo`
- [ ] Иконки — из `/icons/` (PNG) или `@expo/vector-icons`
- [ ] Light mode рендерится корректно на small/medium/large брейкпоинтах
- [ ] Web-fallback продуман для платформо-специфичных модулей

## Расширение системы

При добавлении новых токенов:
1. Объяви их в `src/theme/index.ts` (в подходящей секции).
2. Если это новая фича — заведи namespace внутри `lightColors` (например, `lightColors.newFeature`).
3. Обнови этот документ в соответствующей секции.
4. Не дублируй уже существующие близкие цвета — переиспользуй.
