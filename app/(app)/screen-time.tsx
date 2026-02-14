import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../../src/theme';

/** Redirect to main app on Statistics tab (screen time). */
export default function ScreenTimeRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/(app)/?tab=3');
    }, []);
    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
            <ActivityIndicator size="large" color={colors.primary} />
        </View>
    );
}
