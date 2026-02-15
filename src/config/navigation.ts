/**
 * Single source of truth for app tabs. Main app is one screen (MainTabsScreen).
 * Navigate to main with tab index: use getMainTabUrl() and router.replace().
 */
export type AppTabKey = 'home' | 'weekly-plan' | 'ai-coach' | 'statistics';

const TAB_INDEX: Record<AppTabKey, number> = {
  home: 0,
  'weekly-plan': 1,
  'ai-coach': 2,
  statistics: 3,
};

export const APP_TAB_ROUTES = [
  { key: 'home' as const, icon: 'home', iconOutline: 'home-outline', type: 'ionicon' as const, image: require('../../icons/home.png') },
  { key: 'weekly-plan' as const, icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' as const, image: require('../../icons/tasks.png') },
  { key: 'ai-coach' as const, icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' as const, image: require('../../icons/assistant.png') },
  { key: 'statistics' as const, icon: 'bar-chart', iconOutline: 'bar-chart-outline', type: 'ionicon' as const, image: require('../../icons/stats.png') },
] as const;

/** Navigate to main screen (MainTabsScreen) on the given tab. Use with router.replace(). */
export function getMainTabUrl(key: AppTabKey): string {
  const index = TAB_INDEX[key];
  return index === 0 ? '/(app)/' : `/(app)/?tab=${index}`;
}

/** Tab index for MainTabsScreen (0 = home, 1 = weekly-plan, 2 = ai-coach, 3 = statistics). */
export function getTabIndex(key: AppTabKey): number {
  return TAB_INDEX[key];
}
