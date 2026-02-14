import { useLocalSearchParams } from 'expo-router';
import { MainTabsScreen } from '../../src/screens/MainTabsScreen';

/** Main app: single screen with 4 tabs (Home, Weekly plan, AI Coach, Statistics). */
export default function AppIndex() {
    const { tab } = useLocalSearchParams<{ tab?: string }>();
    const initialTab = tab != null ? Math.max(0, Math.min(3, parseInt(tab, 10) || 0)) : 0;
    return <MainTabsScreen initialTab={initialTab} />;
}
