import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../../src/theme';

/** Redirect to main app (MainTabsScreen). */
export default function HomeRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/(app)/');
    }, []);
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
