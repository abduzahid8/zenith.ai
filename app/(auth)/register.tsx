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

export default function RegisterScreen() {
    const router = useRouter();
    const { signUp, isLoading } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Ошибка', 'Заполните все поля');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Ошибка', 'Пароли не совпадают');
            return;
        }

        try {
            const trimmedEmail = email.trim();
            console.log('Submitting registration for:', trimmedEmail);
            await signUp(trimmedEmail, password);
            // Redirect is handled by RootLayout
            // Note: if Supabase requires email confirmation, we might need to tell the user.
            // But assuming auto-confirm or session provided.
        } catch (error: any) {
            console.error('Registration UI error:', error);
            Alert.alert('Ошибка регистрации', error.message || 'Произошла ошибка');
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
                <Text style={styles.title}>Регистрация</Text>

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
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                    spellCheck={false}
                />

                <TextInput
                    style={styles.input}
                    placeholder="Подтвердите пароль"
                    placeholderTextColor={colors.textLight}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    textContentType="oneTimeCode"
                    autoCorrect={false}
                    spellCheck={false}
                />

                <Button
                    title="Зарегистрироваться"
                    onPress={handleRegister}
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
