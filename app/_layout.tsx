import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    const [fontsLoaded, fontError] = useFonts({
        'Gramatika-Black': require('../assets/fonts/GramatikaTrial-Black-BF65dea4c4a007c.otf'),
        'Gramatika-Bold': require('../assets/fonts/GramatikaTrial-Bold-BF65dea4c5530e5.otf'),
        'Gramatika-Medium': require('../assets/fonts/GramatikaTrial-Medium-BF65dea4c5c6afd.otf'),
        'Gramatika-Regular': require('../assets/fonts/GramatikaTrial-Regular-BF65dea4c5a77e9.otf'),
        'Gramatika-Light': require('../assets/fonts/GramatikaTrial-Light-BF65dea4c59cf23.otf'),
        'Gramatika-ExtraLight': require('../assets/fonts/GramatikaTrial-ExtraLight-BF65dea4c5b0dc5.otf'),
        'Geometria-Light': require('../assets/fonts/Geometria-Light.ttf'),
    });

    useEffect(() => {
        if (fontsLoaded || fontError) {
            setAppIsReady(true);
        }
    }, [fontsLoaded, fontError]);

    // Show loading screen while fonts load
    if (!appIsReady) {
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
                    <Stack.Screen name="index" />
                    <Stack.Screen name="auth" />
                    <Stack.Screen name="login" />
                    <Stack.Screen name="register" />
                    <Stack.Screen name="quiz-intro" />
                    <Stack.Screen name="quiz" />
                    <Stack.Screen name="profile-complete" />
                    <Stack.Screen name="hobby-selection" />
                    <Stack.Screen name="subscription" />
                    <Stack.Screen name="home" />
                    <Stack.Screen
                        name="session-timer"
                        options={{
                            presentation: 'fullScreenModal',
                            animation: 'slide_from_bottom',
                        }}
                    />
                    <Stack.Screen
                        name="ai-coach"
                        options={{
                            presentation: 'modal',
                            animation: 'slide_from_bottom',
                        }}
                    />
                    <Stack.Screen name="screen-time" />
                    <Stack.Screen name="weekly-plan" />
                    <Stack.Screen name="main-tabs" options={{ animation: 'none' }} />
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
