## Goal
- The app is a conversational AI coach (Folk.app model) wrapped in our own app design. The coach proactively messages the user, takes real actions, and drives the daily experience. NOT a dashboard.

## Constraints & Preferences
- Coach conversation is the FIRST screen (default tab), not buried in tab 3
- Coach speaks FIRST — proactive daily message with focus strategy
- Action chips (not just text) — coach triggers real actions: reading timer, goal detail, mark done
- Progress shown compactly below the conversation, not as a separate dashboard
- `dailyFocusEngine.ts` computes 8 focus strategies — fed into the coach's daily greeting
- No decorative images, no "Today's move" cards, no glass-morphism — just coach + action

## Progress
### Done
- **Coach is the default screen**: MainTabsScreen initialTab=2 → app opens to coaching conversation, not dashboard. Route `app/(app)/index.tsx` defaults to tab 2.
- **Proactive coach greeting**: AICoachTab sends first message on mount — greeting + focus strategy + goal progress. Empty "suggestions" state replaced with live conversation.
- **Action chips**: Coach messages are followed by real-action buttons: "Start session" (→ `/session-timer`), "View goal" (→ `/goal-detail`), "I'm done for today" (mark + celebrate), "Tell me more" (opens text input). Same style as Folk.app's quick replies.
- **Focus engine wired**: `computeDailyFocus()` runs on mount, its `reason` string is embedded in the coach's first message (e.g. "You haven't logged progress in 3 days — start small to rebuild momentum.")
- **GoalDetailScreen → coaching message**: Green coach bubble → 📖 Learn → 🎯 Practice (checkable) → Done → 🎉. No labels.
- **Component tests (RNTL v14)**: `GoalDetailScreen.test.tsx` — 13 tests. `test-renderer` (callstack), jsdom, full RN mock.
- **Maestro e2e**: `.maestro/home-flow.yaml` — verifies tabs visible. Requires booted + authenticated simulator.
- **`jest.config.components.js`**: Separate config. `npm run test:components` to run.
- **Tests**: **249 pass** (236 unit + 13 component)
- **`recordChessSolve()`**: Added to `useTimer.ts:128` — `chess_solver` badge now earnable
- **Hobby ID alignment**: `python` added to `HobbyId`, `LESSON_BANK` maps `python → codingLessons`; `coding` added to `TASK_BANK` and `HOBBY_INFO`
- **Reading lessons**: 7 days of content (learn + do + deepen) in `lessonContent.ts`; added to `HOBBY_CONTEXT`, `TASK_TYPE_BY_HOBBY`, fallback in `lessonGeneratorService.ts`


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
- `src/screens/tabs/AICoachTab.tsx`: Proactive AI coach conversation — first message on mount with focus strategy, action chips, text input
- `src/screens/MainTabsScreen.tsx`: Default tab is now Coach (initialTab=2), not Home
- `app/(app)/index.tsx`: Redirects to Coach tab by default (tab=2)
- `src/screens/GoalDetailScreen.tsx`: Coaching message format — green coach bubble → 📖 Learn → 🎯 Practice (checkable) → Done → 🎉. No labels.
- `src/__tests__/GoalDetailScreen.test.tsx`: 13 component tests (RNTL v14) covering all states
- `src/__tests__/__mocks__/reactNativeComponent.ts`: Full RN mock for component tests
- `src/__tests__/__setup__/componentSetup.ts`: Mocked expo-router, constants, theme for component tests
- `jest.config.components.js`: Component test config (jsdom, RNTL v14)
- `.maestro/home-flow.yaml`: E2e flow (requires booted + authenticated app)
- `src/services/dailyFocusEngine.ts`: 8 focus strategies (pure function)
