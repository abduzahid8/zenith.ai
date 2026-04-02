import { useEffect, useState, useMemo } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StyleSheet, View, Text, ActivityIndicator, AppState, Platform } from 'react-native';
import * as Linking from 'expo-linking';
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
    const { hasCompletedOnboarding, _hasHydrated } = useUserProfileStore();
    const segments = useSegments();
    const router = useRouter();
    const url = Linking.useURL();
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

    // Handle deep links (specifically for password recovery)
    useEffect(() => {
        if (!url) return;

        try {
            // Parse both query params AND hash fragment
            // Supabase may send: zenyth://auth-callback?code=xxx#access_token=yyy&type=recovery
            const getAllParams = (inputUrl: string): URLSearchParams => {
                const params = new URLSearchParams();
                
                // Extract query params (after ?)
                const queryIndex = inputUrl.indexOf('?');
                const hashIndex = inputUrl.indexOf('#');
                
                if (queryIndex !== -1) {
                    const queryEnd = hashIndex !== -1 ? hashIndex : inputUrl.length;
                    const queryString = inputUrl.substring(queryIndex + 1, queryEnd);
                    new URLSearchParams(queryString).forEach((value, key) => {
                        params.set(key, value);
                    });
                }
                
                // Extract hash params (after #)
                if (hashIndex !== -1) {
                    const hashString = inputUrl.substring(hashIndex + 1);
                    new URLSearchParams(hashString).forEach((value, key) => {
                        params.set(key, value);
                    });
                }
                
                return params;
            };

            const params = getAllParams(url);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const type = params.get('type');

            if (accessToken && (type === 'recovery' || type === 'signup')) {
                if (type === 'recovery') {
                    // Mark immediately so the routing effect routes to reset-password
                    // before the async setSession() resolves (avoids race with sign-in redirect)
                    useAuthStore.getState().setResettingPassword(true);
                }

                const { getSupabase } = require('../src/services/supabase/client');
                const supabase = getSupabase();

                supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                }).then(({ error }: { error: any }) => {
                    if (error && type === 'recovery') {
                        // Token was invalid — cancel the reset flow
                        useAuthStore.getState().setResettingPassword(false);
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to parse incoming deep link:', e);
        }
    }, [url]);

    useEffect(() => {
        // Wait for app assets, auth session, AND profile store AsyncStorage
        // hydration before making any routing decision.  Without the
        // _hasHydrated guard a returning (onboarded) user would briefly see
        // the quiz-intro screen on every cold start because hasCompletedOnboarding
        // starts as `false` until AsyncStorage finishes loading.
        if (isLoading || !appIsReady || !_hasHydrated) return;

        // Password recovery deep-link always wins
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
    }, [isAuthenticated, segments, isLoading, appIsReady, hasCompletedOnboarding, isResettingPassword, _hasHydrated]);

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
                    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(app)" />
                        <Stack.Screen name="auth-callback" />
                        <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
                        <Stack.Screen name="quiz-intro" />
                        <Stack.Screen name="quiz" />

                        <Stack.Screen name="hobby-selection" />
                        <Stack.Screen name="subscription" />
                        <Stack.Screen name="manage-subscription" />
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
