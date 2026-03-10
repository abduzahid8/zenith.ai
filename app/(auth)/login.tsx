// Auth Fix
import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TextInput,
    Alert,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/services/supabase/auth';
import { LogoNew } from '../../src/components/Logo';


export default function LoginScreen() {
    const router = useRouter();
    const { signIn, isLoading } = useAuthStore();
    const { colors, isDark } = useAppTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Ошибка', 'Заполните все поля');
            return;
        }

        try {
            await signIn(email.trim(), password);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Произошла ошибка';
            Alert.alert('Ошибка входа', msg);
        }
    };

    const handleForgotPassword = async () => {
        const trimmed = email.trim();
        if (!trimmed) {
            Alert.alert('Восстановление пароля', 'Введите email в поле выше, затем нажмите «Забыли пароль?»');
            return;
        }
        try {
            await authService.forgotPassword(trimmed);
            Alert.alert('Письмо отправлено', `Инструкции по сбросу пароля отправлены на ${trimmed}`);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Не удалось отправить письмо';
            Alert.alert('Ошибка', msg);
        }
    };

    const handleGoogleSignIn = () => {
        Alert.alert('Скоро', 'Вход через Google будет доступен в следующем обновлении.');
    };

    const handleAppleSignIn = () => {
        Alert.alert('Скоро', 'Вход через Apple будет доступен в следующем обновлении.');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                <Text style={styles.headerTitle}>Вход</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                {/* Email */}
                <Text style={styles.inputLabel}>Почта</Text>
                <View style={styles.inputContainer}>
                    <MaterialCommunityIcons name="email-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="example@gmail.com"
                        placeholderTextColor={colors.textLight}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                {/* Password */}
                <Text style={styles.inputLabel}>Пароль</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textLight}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textLight} />
                    </TouchableOpacity>
                </View>

                {/* Remember Me + Forgot Password */}
                <View style={styles.optionsRow}>
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setRememberMe(!rememberMe)}
                    >
                        <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                            {rememberMe && <Ionicons name="checkmark" size={14} color={colors.white} />}
                        </View>
                        <Text style={styles.checkboxLabel}>Запомнить меня</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleForgotPassword}>
                        <Text style={styles.forgotPassword}>Забыли пароль?</Text>
                    </TouchableOpacity>
                </View>

                {/* Login Button */}
                <Button
                    title="Войти"
                    onPress={handleLogin}
                    variant="primary"
                    size="large"
                    loading={isLoading}
                    style={styles.loginButton}
                />
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Или</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialContainer}>
                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                    <Image
                        source={require('../../assets/icons/google-logo.png')}
                        style={styles.socialIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                    <FontAwesome name="apple" size={24} color={isDark ? colors.white : colors.black} />
                    <Text style={styles.socialButtonText}>Войти с Apple</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 28,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 80,
        gap: 10,
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 26,
        color: colors.text,
    },
    formContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontFamily: fonts.body.light,
        fontSize: 14,
        color: colors.text,
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 28,
        paddingHorizontal: 16,
        height: 52,
        backgroundColor: colors.surfaceLight,
        marginBottom: 20,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontFamily: fonts.body.light,
        fontSize: 15,
        color: colors.text,
    },
    eyeIcon: {
        padding: 4,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: colors.textSecondary,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: colors.buttonPrimary,
        borderColor: colors.buttonPrimary,
    },
    checkboxLabel: {
        fontFamily: fonts.body.medium,
        fontSize: 13,
        color: colors.textSecondary,
    },
    forgotPassword: {
        fontFamily: fonts.body.medium,
        fontSize: 13,
        color: colors.text,
    },
    loginButton: {
        marginBottom: 0,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
        paddingHorizontal: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    dividerText: {
        fontFamily: fonts.body.light,
        fontSize: 14,
        color: colors.textSecondary,
        marginHorizontal: 16,
    },
    socialContainer: {
        gap: 14,
        paddingBottom: 40,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceLight,
        gap: 12,
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    socialButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 18,
        color: colors.text,
    },
});
