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
import { LogoNew } from '../../src/components/Logo';


export default function RegisterScreen() {
    const router = useRouter();
    const { signUp, isLoading } = useAuthStore();
    const { colors, isDark } = useAppTheme();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleRegister = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!agreedToTerms) {
            Alert.alert('Error', 'You must agree to the terms of use');
            return;
        }

        try {
            await signUp(email.trim(), password);
            // Check if session was created. If not, email confirmation is required.
            const session = useAuthStore.getState().session;
            if (!session) {
                router.replace('/(auth)/registration-success');
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            Alert.alert('Registration Error', msg);
        }
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
            Alert.alert('Error', msg);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                <Text style={styles.headerTitle}>Sign Up</Text>
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
                        textContentType="oneTimeCode"
                        autoCorrect={false}
                        spellCheck={false}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textLight} />
                    </TouchableOpacity>
                </View>

                {/* Register Button */}
                <Button
                    title="Sign Up"
                    onPress={handleRegister}
                    variant="primary"
                    size="large"
                    loading={isLoading}
                    style={styles.registerButton}
                />

                {/* Terms Checkbox */}
                <TouchableOpacity
                    style={styles.termsRow}
                    onPress={() => setAgreedToTerms(!agreedToTerms)}
                >
                    <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                        {agreedToTerms && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    </View>
                    <Text style={styles.termsText}>I agree to the terms of use</Text>
                </TouchableOpacity>
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

                <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
                    <FontAwesome name="apple" size={24} color={colors.text} />
                    <Text style={styles.socialButtonText}>Sign in with Apple</Text>
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
        marginBottom: 16,
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
    registerButton: {
        marginBottom: 16,
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
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
    termsText: {
        fontFamily: fonts.body.medium,
        fontSize: 13,
        color: colors.textSecondary,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
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
