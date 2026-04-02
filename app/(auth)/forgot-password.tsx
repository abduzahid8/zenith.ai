import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TextInput,
    Alert,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { authService } from '../../src/services/supabase/auth';
import { LogoNew } from '../../src/components/Logo';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const { colors, isDark } = useAppTheme();
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleSendReset = async () => {
        const trimmed = email.trim();
        if (!trimmed) {
            Alert.alert('Error', 'Please enter your email address');
            return;
        }

        setIsLoading(true);
        try {
            await authService.forgotPassword(trimmed);
            setEmailSent(true);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Failed to send reset email';
            Alert.alert('Error', msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                <Text style={styles.headerTitle}>Forgot Password</Text>
            </View>

            {emailSent ? (
                /* Success state */
                <View style={styles.successContainer}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="mail-outline" size={48} color={colors.text} />
                    </View>
                    <Text style={styles.successTitle}>Check your email</Text>
                    <Text style={styles.successDescription}>
                        We sent password reset instructions to{'\n'}
                        <Text style={styles.emailHighlight}>{email.trim()}</Text>
                    </Text>
                    <Text style={styles.successHint}>
                        Didn't receive the email? Check your spam folder or try again.
                    </Text>

                    <Button
                        title="Send again"
                        onPress={() => {
                            setEmailSent(false);
                        }}
                        variant="outline"
                        size="large"
                        style={styles.resendButton}
                    />

                    <TouchableOpacity
                        onPress={() => router.replace('/(auth)/login')}
                        style={styles.backToLoginButton}
                    >
                        <Text style={styles.backToLoginText}>Back to Sign In</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                /* Email input state */
                <View style={styles.formContainer}>
                    <Text style={styles.description}>
                        Enter your email address and we'll send you instructions to reset your password.
                    </Text>

                    <Text style={styles.inputLabel}>Email</Text>
                    <View style={styles.inputContainer}>
                        <MaterialCommunityIcons
                            name="email-outline"
                            size={20}
                            color={colors.textLight}
                            style={styles.inputIcon}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="example@gmail.com"
                            placeholderTextColor={colors.textLight}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoFocus
                        />
                    </View>

                    <Button
                        title="Send Reset Link"
                        onPress={handleSendReset}
                        variant="primary"
                        size="large"
                        loading={isLoading}
                        style={styles.sendButton}
                    />

                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={styles.cancelButton}
                    >
                        <Text style={styles.cancelText}>Back to Sign In</Text>
                    </TouchableOpacity>
                </View>
            )}
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
        marginTop: 20,
        marginBottom: 48,
        gap: 10,
    },
    backButton: {
        padding: 4,
        marginRight: 4,
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 26,
        color: colors.text,
    },
    formContainer: {
        flex: 1,
    },
    description: {
        fontFamily: fonts.body.light,
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 36,
        lineHeight: 24,
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
        marginBottom: 28,
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
    sendButton: {
        marginBottom: 16,
    },
    cancelButton: {
        alignItems: 'center',
        padding: 12,
    },
    cancelText: {
        fontFamily: fonts.body.medium,
        fontSize: 14,
        color: colors.textSecondary,
    },
    successContainer: {
        flex: 1,
        alignItems: 'center',
        paddingTop: 20,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 32,
        backgroundColor: 'transparent',
    },
    successTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        color: colors.text,
        marginBottom: 16,
    },
    successDescription: {
        fontFamily: fonts.body.light,
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 20,
    },
    emailHighlight: {
        fontFamily: fonts.body.medium,
        color: colors.text,
    },
    successHint: {
        fontFamily: fonts.body.light,
        fontSize: 13,
        color: colors.textLight,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 40,
        paddingHorizontal: 16,
    },
    resendButton: {
        width: '100%',
        marginBottom: 16,
    },
    backToLoginButton: {
        alignItems: 'center',
        padding: 12,
    },
    backToLoginText: {
        fontFamily: fonts.body.medium,
        fontSize: 14,
        color: colors.textSecondary,
    },
});
