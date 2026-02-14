# Navigation consolidation: one page = one route

## The problem

Right now the app has **two ways** to show the same content:

| Content        | Way 1                          | Way 2                    |
|----------------|--------------------------------|---------------------------|
| Home           | `/(app)/` → MainTabsScreen tab 0 | `/home` → HomeScreen      |
| Weekly plan    | MainTabsScreen tab 1           | `/weekly-plan` → WeeklyPlanScreen |
| AI Coach       | MainTabsScreen tab 2           | `/ai-coach` → MainTabsScreen(2)   |
| Statistics     | MainTabsScreen tab 3           | `/statistics` → MainTabsScreen(3) |

So:

- **Progress** can differ: e.g. you're on MainTabsScreen (tab 0), then navigate to `/home` → you get a different screen instance; scroll position, local state, and “where I am” are not the same.
- **Navigation** gets messy: back button and deep links can land on either “version” of the same page; the stack can have both MainTabsScreen and HomeScreen.
- **State** is split: tab index lives in MainTabsScreen, while standalone screens have their own mount/unmount. One source of truth per “page” is clearer.

So the concern is valid: with two entry points per concept, the user can’t rely on one place for progress and navigation can break.

## Why `src/screens/tabs/` exists

- **MainTabsScreen** was built first: one screen with a PagerView and four “tab” components (HomeTab, WeeklyPlanTab, AICoachTab, StatisticsTab). So the **content** of each tab lives in `tabs/`.
- Later, **standalone routes** were added (`/home`, `/weekly-plan`, etc.) so that bottom nav and deep links could open a specific “page.” To avoid duplicating UI, those screens **reuse** the same tab components from `tabs/`.

So `tabs/` is not “another set of pages” — it’s the **shared content** (cards, charts, chat). The real duplication is at the **navigation** level: we have both “one big screen with 4 tabs” and “one route per page.”

## Recommended approach: one page = one route

Make **each logical page a single route** and stop using MainTabsScreen as a route target.

- **One URL per page**  
  Home = `/home`, Weekly plan = `/weekly-plan`, AI Coach = `/ai-coach`, Statistics = `/statistics`, Screen time = `/screen-time`. No second “version” of the same page.

- **Single place for progress**  
  Each URL always mounts the same screen (e.g. HomeScreen). Scroll position and local state are tied to that screen; no separate “tab index” or second instance.

- **Predictable navigation**  
  Back, deep links, and “Open Statistics” always go to the same screen type. No mixing MainTabsScreen and standalone screens for the same content.

Concretely:

1. **Use only standalone screens for (app) routes**
   - `/(app)/` (index) → redirect to `/home` (or render HomeScreen).
   - `/(app)/home` → HomeScreen  
   - `/(app)/weekly-plan` → WeeklyPlanScreen  
   - `/(app)/screen-time` → ScreenTimeScreen  
   - `/(app)/statistics` → **StatisticsScreen** (not MainTabsScreen).
   - `/(app)/ai-coach` → **AICoachScreen** (not MainTabsScreen).

2. **Stop using MainTabsScreen in the router**  
   Remove or repurpose `(app)/statistics` and `(app)/ai-coach` that currently render `MainTabsScreen` with `initialTab`. Have them export StatisticsScreen and AICoachScreen instead.

3. **Keep `src/screens/tabs/` as content only**  
  Keep using HomeTab, WeeklyPlanTab, etc. as **presentational components** that the standalone screens import. So:
   - **Screens** = route targets, full layout (header, bottom nav), one per URL.
   - **Tabs** = reusable content blocks, no route, no chrome; used inside screens.

4. **Bottom nav**  
  Bottom nav only does `router.push('/home')`, `router.push('/weekly-plan')`, etc. It never opens “MainTabsScreen with tab N.”

Result:

- User progress lives in one place per page (the screen for that route).
- Navigation has one path per page; nothing “breaks” because we don’t have two competing ways to show the same thing.
- `tabs/` stays as the shared UI building blocks; the “main” pages are the screens in `src/screens/` that are attached to routes.
