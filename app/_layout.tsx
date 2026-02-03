import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const { isAuthenticated, hasCompletedOnboarding, initialize, isLoading } = useAuthStore();
    const segments = useSegments();
    const router = useRouter();

    const [fontsLoaded, fontError] = useFonts({
        // Keep trial fonts for weights not provided in new set if necessary, 
        // or map to closest available if strictly replacing. 
        // User provided Bold and Regular non-trial versions.
        'Gramatika-Black': require('../assets/fonts/GramatikaTrial-Black-BF65dea4c4a007c.otf'),
        'Gramatika-Bold': require('../assets/fonts/Gramatika-Bold.ttf'), // Updated to non-trial
        'Gramatika-Medium': require('../assets/fonts/GramatikaTrial-Medium-BF65dea4c5c6afd.otf'),
        'Gramatika-Regular': require('../assets/fonts/Gramatika-Regular.ttf'), // Updated to non-trial
        'Gramatika-Light': require('../assets/fonts/GramatikaTrial-Light-BF65dea4c59cf23.otf'),
        'Gramatika-ExtraLight': require('../assets/fonts/GramatikaTrial-ExtraLight-BF65dea4c5b0dc5.otf'),
        'Geometria-Light': require('../assets/fonts/Geometria-Light.ttf'),
    });

    useEffect(() => {
        initialize();
    }, []);

    useEffect(() => {
        if (fontsLoaded || fontError) {
            setAppIsReady(true);
        }
    }, [fontsLoaded, fontError]);

    useEffect(() => {
        if (isLoading || !appIsReady) return;

        const inAuthGroup = segments[0] === '(auth)';
        const inAppGroup = segments[0] === '(app)';

        if (!isAuthenticated) {
            if (!inAuthGroup) {
                router.replace('/(auth)/');
            }
        } else {
            // User is authenticated
            if (!hasCompletedOnboarding) {
                // Should be in onboarding flow (not in auth or app groups)
                if (inAuthGroup || inAppGroup) {
                    router.replace('/quiz-intro');
                }
            } else {
                // Completed onboarding
                // Check if user is in auth group or onboarding flow (optional: allow revisiting subscription?)
                // For strict prototype, force to app if in auth
                if (inAuthGroup) {
                    router.replace('/(app)/');
                }
            }
        }
    }, [isAuthenticated, segments, isLoading, appIsReady, hasCompletedOnboarding]);

    // Show loading screen while fonts or auth load
    if (!appIsReady || isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1AFFD5" />
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    // Show error if fonts failed
    if (fontError) {
        console.error('Font loading error:', fontError);
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="(auth)" />
                    <Stack.Screen name="(app)" />
                    <Stack.Screen name="quiz-intro" />
                    <Stack.Screen name="quiz" />
                    <Stack.Screen name="profile-complete" />
                    <Stack.Screen name="hobby-selection" />
                    <Stack.Screen name="subscription" />
                    <Stack.Screen
                        name="session-timer"
                        options={{
                            presentation: 'fullScreenModal',
                            animation: 'slide_from_bottom',
                        }}
                    />
                </Stack>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#000000',
    },
});
