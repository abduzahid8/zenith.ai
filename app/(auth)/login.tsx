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
    KeyboardAvoidingView,
    ScrollView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { useAuthStore } from '../../src/store/authStore';
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
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        try {
            await signIn(email.trim(), password);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            Alert.alert('Sign In Error', msg);
        }
    };

    const handleForgotPassword = () => {
        router.push('/(auth)/forgot-password');
    };

    const { signInWithGoogle, signInWithApple } = useAuthStore();

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to sign in with Google';
            if (msg.includes('cancelled')) return;
            Alert.alert('Error', msg);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            await signInWithApple();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to sign in with Apple';
            if (msg.includes('cancelled') || msg.includes('ERR_CANCELED')) return;
            Alert.alert('Error', msg);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.headerContainer}>
                        <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                        <Text style={styles.headerTitle}>Sign In</Text>
                    </View>

                    {/* Form */}
                    <View style={styles.formContainer}>
                {/* Email */}
                <Text style={styles.inputLabel}>Email</Text>
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
                <Text style={styles.inputLabel}>Password</Text>
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
                            {rememberMe && <Image source={require('../../icons/Vector.png')} style={styles.checkmarkIcon} />}
                        </View>
                        <Text style={styles.checkboxLabel}>Remember me</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleForgotPassword}>
                        <Text style={styles.forgotPassword}>Forgot password?</Text>
                    </TouchableOpacity>
                </View>

                {/* Login Button */}
                <Button
                    title="Sign In"
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
                <Text style={styles.dividerText}>Or</Text>
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
                    <Text style={styles.socialButtonText}>Sign in with Google</Text>
                </TouchableOpacity>

                {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                        <FontAwesome name="apple" size={24} color={colors.text} />
                        <Text style={styles.socialButtonText}>Sign in with Apple</Text>
                    </TouchableOpacity>
                )}
            </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
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
        fontSize: 18,
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
        backgroundColor: colors.background,
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
    checkmarkIcon: {
        width: 9,
        height: 9,
        tintColor: colors.white,
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
        backgroundColor: colors.background,
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
