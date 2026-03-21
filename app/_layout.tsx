import { useEffect, useState, useMemo } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, Text, ActivityIndicator, AppState, Platform } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { useTaskStore } from '../src/store/taskStore';
import { useUserProfileStore } from '../src/store/userProfileStore';
import { useSubscriptionStore } from '../src/store/subscriptionStore';
import { iapService } from '../src/services/iapService';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { useAppTheme } from '../src/theme/useAppTheme';
import { ROUTES } from '../src/config/routes';

// On web, use plain View; GestureHandlerRootView is only needed on native
let RootView: typeof View = View;
if (Platform.OS !== 'web') {
    try {
        RootView = require('react-native-gesture-handler').GestureHandlerRootView;
    } catch {
        // Fallback if gesture handler is unavailable
    }
}

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    const { isAuthenticated, initialize, isLoading, isResettingPassword } = useAuthStore();
    const { hasCompletedOnboarding } = useUserProfileStore();
    const segments = useSegments();
    const router = useRouter();
    const { colors } = useAppTheme();

    const styles = useMemo(() => createStyles(colors), [colors]);

    const [fontsLoaded, fontError] = useFonts({
        'Gramatika-Black': require('../assets/fonts/GramatikaTrial-Black-BF65dea4c4a007c.otf'),
        'Gramatika-Bold': require('../assets/fonts/Gramatika-Bold.ttf'),
        'Gramatika-Medium': require('../assets/fonts/GramatikaTrial-Medium-BF65dea4c5c6afd.otf'),
        'Gramatika-Regular': require('../assets/fonts/Gramatika-Regular.ttf'),
        'Gramatika-Light': require('../assets/fonts/GramatikaTrial-Light-BF65dea4c59cf23.otf'),
        'Gramatika-ExtraLight': require('../assets/fonts/GramatikaTrial-ExtraLight-BF65dea4c5b0dc5.otf'),
        'Geometria-Light': require('../assets/fonts/Geometria-Light.ttf'),
        'Geometria-Medium': require('../assets/fonts/geometria_medium.otf'),
    });

    useEffect(() => {
        initialize();
    }, []);

    // Initialize IAP subscription system
    useEffect(() => {
        useSubscriptionStore.getState().initialize();
        return () => {
            iapService.teardown();
        };
    }, []);

    useEffect(() => {
        if (fontsLoaded || fontError) {
            setAppIsReady(true);
        }
    }, [fontsLoaded, fontError]);

    // Safety timeout: unblock after 3s if fonts stall on web
    useEffect(() => {
        if (Platform.OS !== 'web') return;
        const timer = setTimeout(() => setAppIsReady(true), 3000);
        return () => clearTimeout(timer);
    }, []);

    // Handle app state changes for midnight reset
    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                const { user } = useAuthStore.getState();
                if (user?.id) {
                    useTaskStore.getState().fetchDailyPlan(user.id);
                }
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        // Wait for both app ready AND auth to finish before redirecting
        if (isLoading || !appIsReady) return;

        // If we are in password recovery mode, force redirect to reset-password
        if (isResettingPassword) {
            router.replace('/(auth)/reset-password');
            return;
        }

        const inAuthGroup = segments[0] === '(auth)';
        const inAppGroup = segments[0] === '(app)';
        const isPrivacy = segments[0] === ('privacy' as any);

        if (!isAuthenticated) {
            if (!inAuthGroup && !isPrivacy) {
                router.replace(ROUTES.AUTH as any);
            }
        } else {
            if (!hasCompletedOnboarding) {
                if ((inAuthGroup || inAppGroup) && !isPrivacy) {
                    router.replace('/quiz-intro');
                }
            } else {
                if (inAuthGroup && !isPrivacy) {
                    router.replace(ROUTES.APP as any);
                }
            }
        }
    }, [isAuthenticated, segments, isLoading, appIsReady, hasCompletedOnboarding, isResettingPassword]);

    // Show loading screen only until fonts/app are ready (NOT blocked on auth)
    if (!appIsReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    // Show error if fonts failed
    if (fontError) {
        console.error('Font loading error:', fontError);
    }

    return (
        <RootView style={styles.container}>
            <ErrorBoundary>
                <SafeAreaProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(app)" />
                        <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                        <Stack.Screen name="quiz-intro" />
                        <Stack.Screen name="quiz" />

                        <Stack.Screen name="hobby-selection" />
                        <Stack.Screen name="subscription" />
                        <Stack.Screen
                            name="session-timer"
                            options={{
                                animation: 'slide_from_bottom',
                            }}
                        />
                        <Stack.Screen
                            name="your-tasks"
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="category/[id]"
                            options={{
                                presentation: 'card',
                                animation: 'slide_from_right',
                                title: ''
                            }}
                        />
                    </Stack>
                </SafeAreaProvider>
            </ErrorBoundary>
        </RootView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: colors.text,
    },
});
