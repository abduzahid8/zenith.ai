## Goal
- The app should be a conversational AI coach (like Folk.app) — not a dashboard with task descriptions. The GoalDetailScreen must make the user feel GUIDED: coach teaches → user learns → coach assigns → user does → coach celebrates.

## Constraints & Preferences
- No labels (LEARN, DO THIS, YOUR PLAN, etc.) — just content and action
- Coach bubble with green background for the daily message
- Focus reason (from dailyFocusEngine) is the coach's strategy insight
- Steps are checkable (checkbox pattern), Done button only when all checked
- `dailyFocusEngine.ts` computes 8 focus strategies (pure function)
- `test:components` script for component integration tests (RNTL v14)

## Progress
### Done
- **GoalDetailScreen → coaching message**: Replaced card-based layout with 4-section chat-like format: green coach bubble (goal + focus + plan + commitment) → 📖 Learn section → 🎯 Practice section (checkable steps) → Done button. Completion state shows 🎉 with stats.
- **Component tests (RNTL v14)**: `GoalDetailScreen.test.tsx` — 10 tests covering all states (coach bubble, focus, learn, practice, step checking, done flow, header, goal not found, completed, paused). Uses `test-renderer` (callstack) with mocked RN, safe-area, expo-router.
- **Maestro e2e**: Basic `home-flow.yaml` in `.maestro/` — verifies Home/Weekly/Coach tabs visible, scrolls down. Requires booted simulator with authenticated app.
- **`jest.config.components.js`**: Separate jest config for component tests (`testEnvironment: 'jsdom'`, RNTL-friendly mocks). `npm run test:components` to run.
- **Tests**: Fixed all 3 failing suites — aiService (mock `fetch` instead of supabase), taskEngine (removed early return), authStore (mocked native-module stores) — **159/159 pass** + **10 component tests pass**
- **`recordChessSolve()`**: Added to `useTimer.ts:128` — `chess_solver` badge now earnable
- **Hobby ID alignment**: `python` added to `HobbyId`, `LESSON_BANK` maps `python → codingLessons`; `coding` added to `TASK_BANK` and `HOBBY_INFO`
- **Reading lessons**: 7 days of content (learn + do + deepen) in `lessonContent.ts`; added to `HOBBY_CONTEXT`, `TASK_TYPE_BY_HOBBY`, fallback in `lessonGeneratorService.ts`
- **Day 2 Puzzle 6 → V2**: Converted from V1 orphan to full V2 format with `id`, `solution[]`, `sideToMove`, `metadata`
- **`getThematicPuzzles` loading**: Now loads all 7 days (was day‑1 only)
- **Day 8+ cycling**: `getThematicPuzzles` now cycles `(day-1) % 7` instead of always returning day 1
- **AI Coach greeting**: Uses `HOBBY_META` labels instead of hardcoded ternary
- **Debug screen**: Includes `python`, `reading` in HOBBIES array
- **Lesson hobby override**: `useTimer.ts:87-89` fixes lesson hobby to match `selectedHobby` — `python` users no longer advance `coding`'s day counter
- **Dead code**: Removed unused `handleChessComplete` and `chess_puzzle` case from `DoStep.tsx` (never reached)
- **`recordCodeRun` timing**: Removed from `handleRunCode` (before execution); added to `result` handler (after code executes)
- **Day 1 text**: Fixed "8 puzzles" → "6" in lesson content
- **Puzzle mapping completeness**: `useTimer.ts` now propagates `sideToMove`, `metadata`, `id`, `day`, `topic`, `dayKey` to ChessBoard
- **`ACTIVE_CHESS_PUZZLES` removed**: Dead export (never imported) — validator uses `getThematicPuzzles` directly
- **`coding` TASK_TEMPLATES_DATA alias**: `coding → python` templates — was falling back to generic `default`
- **Empty puzzles guard**: `useTimer.ts` checks `puzzles.length > 0` before accessing `puzzles[0]`
- **Puzzle content quality**: Fixed 10 violations (coordinates in soft/medium hints, direct command in prompt) across days 2, 3, 4, 7
- **Dead code cleanup**: Removed unused `BlurView`, `APP_TAB_ROUTES` imports in SessionTimerScreen; unused `state` param in ChessBoard
### Done (continued)

- **`adjustDifficulty` scaling**: Step is now `max(25, range * 5%)` of the goal's own range instead of a fixed 50 — a chess goal (400→1200) gets ~40/step, a small skill (0→100) gets 5/step
- **`computeNextMode()`**: Extracted mode-transition logic from `recordCheckin` ternary into a documented pure function in `goalHandlers.ts` — takes `(currentMode, history, isBehind, dailyActions)` and returns `HelpMode`
- **Index healing**: `getSnapshot`/`getSnapshotById` now repair `goalByHobby`/`executionGoalByHobby` after fallback — subsequent calls hit the direct index instead of scanning every time
- **Goal-aware Plan-of-Attack**: New `PlanOfAttack` + `CommitmentRecord` types in `goals.ts`; `services/goalPlanService.ts` generates a per-goal roadmap from the user's free-form description (LLM with heuristic fallback) and parses free-form commits into structured actions
- **Daily content is goal-aware**: `dailyGoalCoach.generateDailyContent` now feeds the AI the user's plan, yesterday's commitment, and today's commitment; `getFallbackContent` interpolates the plan tile into legacy mode-aware fallbacks; new `learnTitle`/`doTitle` reflect the user's *specific* step (e.g. "Read 20 pages of Meditations" instead of generic "Read more")
- **Smart commit follow-through**: Free-form commits in `GoalCheckinCard` are parsed (verb, action, minutes), stashed as `progress.commitment`, surfaced back tomorrow on `DailyGoalCard`; honored-flag flips automatically when a check-in is logged the next day
- **LLM bottleneck→tools**: `getBottleneckTools` now does: curated static pattern (preferred) → LLM with `GENERIC_TOOL_CATALOG` allowlist → local heuristic on the allowlist. New `GENERIC_TOOL_CATALOG` (Notion, Forest, Obsidian, ChatGPT, etc.) constrains the LLM to safe URLs
- **AICoachScreen context**: now includes today's plan step + yesterday's commitment (honored/cold) when chatting with the coach
- **`setGoal` is non-blocking**: attaches a heuristic plan immediately so today's tile shows instantly; LLM enrichment runs in the background and replaces it on success
- **Daily content lifecycle**: `getOrGenerateDailyContent` rolls forward yesterday's commitment and refreshes `currentStepIndex` before serving cache, so the same card reload after midnight correctly shows follow-through on yesterday and a fresh step today
- **Tests**: new `goalAware.test.ts` covers `parseCommitment`, `buildHeuristicPlan`, `pickTodayStepIndex`, `deriveDailyTile`, `generateDailyContent` (success/failure/parse error), `generatePlanOfAttack` (LLM / heuristic / malformed), `getBottleneckTools` (static / LLM / local fallback) — **148/148 pass, typecheck clean**

### In Progress
- (none)

### Done (continued)

- **Empty learn/practice bug**: `GoalDetailScreen.tsx` never called `getOrGenerateDailyContent` — the screen only read `progress.dailyContent[today]` but nothing ever populated it (unless `DailyGoalCard` or `GoalCheckinCard` happened to mount first). Added a `useEffect` on mount that calls `getOrGenerateDailyContent` and sets `todayContent` → content now appears immediately when navigating directly to `/goal-detail`.
- **Folk-style GoalDetail redesign**: Removed all labels (`"Learn"`, `"Practice"`, `"Check off all steps"`) — the content speaks for itself. Added quick-reply chips (`✓ Done`, `⚡ Too much`, `🔄 Give me another`, `🔍 Research`) that signal back to the coach. Added step progress strip. Coach bubble now shows yesterday's commitment nudge if unhonored.
- **`coachTools.ts` (agent capability registry)**: New `CoachTool` type + `COACH_TOOLS` array defining what the AI coach can *do* (launch timer, open puzzle, reading drill, code-runner, deep research, swap task). Each tool resolves goal-aware actions (e.g. reading drill only appears for `reading` hobby). `getCoachToolsForContext` filters to max 4 relevant tools per screen.
- **Agent tool buttons in GoalDetail**: `GoalDetailScreen` now renders contextual tool chips below the quick-reply row — `Start 15-min timer`, `Open code-runner`, `♟️ Solve today's puzzle` etc. — with route deep-links and explanations.
- **RNTL test-renderer v14 fixes**: Removed `?? useMemo()` short-circuit pattern (causes conditional hook calls). Replaced optional-chaining in `useEffect` deps with stable ref-based triggers. All 13 component tests pass.
- **Component tests**: Expanded from 10 to 13 tests — new tests for step progress strip, quick reply chips, agent tool buttons. No-label assertions (`queryByText('Learn').toBeNull()`, `queryByText('Practice').toBeNull()`).
- **Maestro e2e expanded**: `home-flow.yaml` now drives a full cycle — tabs → goal detail → check steps → done → celebration → back. Requires booted + authenticated app.

### Blocked
- (none)

## Key Decisions
- `reading` uses `free_text` task type only (no multi‑choice/translate/code)
- `python → codingLessons` alias in LESSON_BANK avoids duplicating 7 lessons
- `getThematicPuzzles` day 8+ cycles through 1-7 rather than returning empty
- Lesson `hobby` field overridden at load time to match `selectedHobby` (aliased hobby IDs can't embed the correct value at authoring time)
- `coding` hobby aliases `python` templates in `TASK_TEMPLATES_DATA` (same curriculum)

## Next Steps
- (no pending steps — all work complete)

## Critical Context
- Pre‑existing type error in `MainTabsScreen.tsx:152` (route argument type) — unrelated to coach changes
- RNTL v14 uses `test-renderer` (callstack) not `react-test-renderer` — render() is async, fireEvent is async
- Component test config (`jest.config.components.js`) uses `testEnvironment: 'jsdom'` with full RN mock
- Maestro e2e requires booted iOS simulator with authenticated app

## Relevant Files
- `src/screens/GoalDetailScreen.tsx`: Coaching message format — green coach bubble → Learn → Practice (checkable) → Done → 🎉. No labels. Quick-reply chips. Agent tool buttons.
- `src/__tests__/GoalDetailScreen.test.tsx`: 13 component tests (RNTL v14) covering all states (no-label assertions, progress strip, chips, agent tools)
- `src/__tests__/__mocks__/reactNativeComponent.ts`: Full RN mock for component tests (View, Text, TouchableOpacity, Alert, Animated)
- `src/__tests__/__mocks__/safeArea.ts`: SafeArea mocks for component tests
- `src/__tests__/__setup__/componentSetup.ts`: Mocked expo-router, constants, theme for component tests
- `jest.config.components.js`: Component test config (jsdom, RNTL v14)
- `.maestro/home-flow.yaml`: Full-cycle e2e flow (tabs → detail → done → celebration)
- `src/services/dailyFocusEngine.ts`: 8 focus strategies (pure function)
- `src/services/coachTools.ts`: Agent capability registry (7 tools, goal-aware resolution)
