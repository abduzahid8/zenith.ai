import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function AuthCallbackScreen() {
    const router = useRouter();
    const { isResettingPassword } = useAuthStore();
    const [status, setStatus] = useState<'redirecting' | 'opening-app' | 'error'>('redirecting');

    useEffect(() => {
        if (Platform.OS !== 'web') {
            return;
        }

        const hash = window.location.hash;
        if (!hash) {
            router.replace('/(auth)');
            return;
        }

        const params = new URLSearchParams(hash.substring(1));
        const type = params.get('type');
        const accessToken = params.get('access_token');

        if (!accessToken) {
            router.replace('/(auth)');
            return;
        }

        if (type === 'recovery' || type === 'signup') {
            setStatus('opening-app');
            const deepLink = `zenyth://auth-callback${hash}`;
            window.location.replace(deepLink);
        }
    }, []);

    useEffect(() => {
        if (isResettingPassword && Platform.OS === 'web') {
            router.replace('/(auth)/reset-password');
        }
    }, [isResettingPassword]);

    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.title}>
                {status === 'opening-app' ? 'Opening Zenyth...' : 'Please wait...'}
            </Text>
            {status === 'opening-app' && (
                <Text style={styles.subtitle}>
                    If the app does not open, make sure Zenyth is installed on this device.
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        padding: 32,
    },
    title: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 12,
        fontSize: 14,
        color: '#888888',
        textAlign: 'center',
        lineHeight: 20,
    },
});
