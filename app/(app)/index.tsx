import { useLocalSearchParams } from 'expo-router';
import { MainTabsScreen } from '../../src/screens/MainTabsScreen';

/** Main app: single screen with 3 tabs (Home, Weekly plan, AI Coach). */
export default function AppIndex() {
    const { tab } = useLocalSearchParams<{ tab?: string }>();
    const initialTab = tab != null ? Math.max(0, Math.min(2, parseInt(tab, 10) || 0)) : 0;
    return <MainTabsScreen initialTab={initialTab} />;
}
