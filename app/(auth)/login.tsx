// Auth Fix
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { LogoSimple } from '../../src/components/Logo';
import { colors, typography, spacing, borderRadius } from '../../src/theme';
import { scaleWidth, scaleHeight, scaleFont } from '../../src/theme/responsive';

import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, isLoading } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Ошибка', 'Заполните все поля');
            return;
        }

        try {
            const trimmedEmail = email.trim();
            console.log('Submitting login for:', trimmedEmail);
            await signIn(trimmedEmail, password);
            // Redirect is handled by RootLayout based on auth state
        } catch (error: any) {
            Alert.alert('Ошибка входа', error.message || 'Произошла ошибка');
        }
    };

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.logoContainer}>
                <LogoSimple size="large" />
            </View>

            <View style={styles.content}>
                <Text style={styles.title}>Вход</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Email"
                    placeholderTextColor={colors.textLight}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                />

                <TextInput
                    style={styles.input}
                    placeholder="Пароль"
                    placeholderTextColor={colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />

                <Button
                    title="Войти"
                    onPress={handleLogin}
                    variant="primary"
                    size="large"
                    loading={isLoading}
                    style={styles.button}
                />

                <Button
                    title="Назад"
                    onPress={handleBack}
                    variant="outline"
                    size="medium"
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: scaleHeight(60),
    },
    content: {
        flex: 1,
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingTop: scaleHeight(spacing.xxl),
    },
    title: {
        fontFamily: typography.h1.fontFamily,
        fontSize: scaleFont(28),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scaleHeight(spacing.xl),
    },
    input: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        paddingHorizontal: scaleWidth(spacing.md),
        paddingVertical: scaleHeight(14),
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.text,
        marginBottom: scaleHeight(spacing.md),
    },
    button: {
        marginBottom: scaleHeight(spacing.md),
    },
});
