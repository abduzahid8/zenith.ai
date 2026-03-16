/**
 * Single source of truth for app tabs.
 * Navigate via dedicated tab routes from getMainTabUrl().
 */
export type AppTabKey = 'home' | 'weekly-plan' | 'ai-coach';

const TAB_INDEX: Record<AppTabKey, number> = {
  home: 0,
  'weekly-plan': 1,
  'ai-coach': 2,
};

export const APP_TAB_ROUTES = [
  { key: 'home' as const, icon: 'home', iconOutline: 'home-outline', type: 'ionicon' as const, image: require('../../icons/home.png') },
  { key: 'weekly-plan' as const, icon: 'clipboard-text', iconOutline: 'clipboard-text-outline', type: 'material' as const, image: require('../../icons/tasks.png') },
  { key: 'ai-coach' as const, icon: 'lightbulb', iconOutline: 'lightbulb-outline', type: 'material' as const, image: require('../../icons/assistant.png') },
] as const;

/** Navigate to tab routes. Use with router.replace()/push(). */
export function getMainTabUrl(key: AppTabKey): string {
  switch (key) {
    case 'home':
      return '/(app)/';
    case 'weekly-plan':
      return '/(app)/weekly-plan';
    case 'ai-coach':
      return '/(app)/ai-coach';
    default:
      return '/(app)/';
  }
}

/** Tab index for MainTabsScreen (0 = home, 1 = weekly-plan, 2 = ai-coach). */
export function getTabIndex(key: AppTabKey): number {
  return TAB_INDEX[key];
}
