## Goal
- Overhaul first-week chess module from V1 (moves[]) to V2 (solution[]), fix all test failures, align hobby IDs across the full stack, and add `reading` as a fully-supported hobby.

## Constraints & Preferences
- English prompts, mobile‑short text
- Prompts must not contain coordinates or direct commands
- Hints: soft/medium without coordinates, strong without UCI
- Multi-move puzzles require opponent moves between user moves
- Backward‑compatible: `moves[]` optional, `solution[]` primary
- `reading` lessons follow same structure as other hobbies (learn → do → deepen)

## Progress
### Done
- **Tests**: Fixed all 3 failing suites — aiService (mock `fetch` instead of supabase), taskEngine (removed early return), authStore (mocked native-module stores) — **119/119 pass**
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

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `reading` uses `free_text` task type only (no multi‑choice/translate/code)
- `python → codingLessons` alias in LESSON_BANK avoids duplicating 7 lessons
- `getThematicPuzzles` day 8+ cycles through 1-7 rather than returning empty
- Lesson `hobby` field overridden at load time to match `selectedHobby` (aliased hobby IDs can't embed the correct value at authoring time)
- `coding` hobby aliases `python` templates in `TASK_TEMPLATES_DATA` (same curriculum)

## Next Steps
- (no pending steps — user requested "dive deeper need improvment" after all fixes applied)

## Critical Context
- Pre‑existing type error in `MainTabsScreen.tsx:152` (route argument type) — unrelated to chess changes
- `handleStepComplete('do', 'solved')` passes static string as chess artifact; improvement held to avoid API‑coupling
- `PythonRunner.recordCodeRun()` fix: fires in `result` handler, not before execution
- Hobby‑ID alignment now covers: lessonContent, taskBank, taskEngine, gamificationStore, lessonGeneratorService, AICoachScreen, GamificationDebugScreen, HOBBY_INFO, HOBBY_META

## Relevant Files
- `src/data/chessPuzzlesBank.ts`: All 55 puzzles V2, validator, `getThematicPuzzles` with cycling
- `src/data/lessonContent.ts`: 7 reading lessons, `python`/`reading` in `HobbyId`, `LESSON_BANK`, `HOBBY_META`
- `src/data/taskBank.ts`: `coding` task block (28 days), `python`, `reading`
- `src/hooks/useTimer.ts`: `recordChessSolve` call, lesson hobby override, V2 puzzle loading
- `src/store/gamificationStore.ts`: `currentDay` initial state includes all 6 hobbies
- `src/services/taskEngine.ts`: Removed early return; `coding` → `python` template alias
- `src/services/lessonGeneratorService.ts`: `python`/`reading` in context, task types, fallback
- `src/__tests__/`: All 8 suites passing (119 tests)
- `src/components/session/PythonRunner.tsx`: `recordCodeRun` moved to result handler
- `src/components/session/DoStep.tsx`: Removed dead chess code and import
