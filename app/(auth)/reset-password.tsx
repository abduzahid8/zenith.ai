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
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { useAuthStore } from '../../src/store/authStore';
import { LogoNew } from '../../src/components/Logo';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { updatePassword, isLoading, setResettingPassword } = useAuthStore();
    const { colors, isDark } = useAppTheme();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleUpdatePassword = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        try {
            await updatePassword(password);
            Alert.alert('Success', 'Password updated successfully', [
                {
                    text: 'OK',
                    onPress: () => {
                        setResettingPassword(false);
                        router.replace('/(app)');
                    },
                },
            ]);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'An error occurred';
            Alert.alert('Error', msg);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                <Text style={styles.headerTitle}>New Password</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                <Text style={styles.description}>
                    Please enter your new password below.
                </Text>

                {/* Password */}
                <Text style={styles.inputLabel}>New password</Text>
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

                {/* Confirm Password */}
                <Text style={styles.inputLabel}>Confirm password</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.textLight} style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor={colors.textLight}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showPassword}
                    />
                </View>

                {/* Reset Button */}
                <Button
                    title="Update Password"
                    onPress={handleUpdatePassword}
                    variant="primary"
                    size="large"
                    loading={isLoading}
                    style={styles.resetButton}
                />
                
                <TouchableOpacity 
                    onPress={() => {
                        setResettingPassword(false);
                        router.replace('/(auth)/login');
                    }}
                    style={styles.cancelButton}
                >
                    <Text style={styles.cancelText}>Cancel</Text>
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
        marginBottom: 40,
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
    description: {
        fontFamily: fonts.body.light,
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 32,
        lineHeight: 22,
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
    resetButton: {
        marginTop: 12,
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
});
