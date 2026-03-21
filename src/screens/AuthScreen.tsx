import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Image,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { fonts } from '../theme';
import { Button } from '../components/Button';
import { LogoNew } from '../components/Logo';
import { useAppTheme } from '../theme/useAppTheme';
import { useAuthStore } from '../store/authStore';

export default function AuthScreen() {
    const router = useRouter();
    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { signInWithGoogle, signInWithApple } = useAuthStore();

    const handleGoogleSignIn = async () => {
        try {
            await signInWithGoogle();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Не удалось войти через Google';
            Alert.alert('Ошибка', msg);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            await signInWithApple();
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Не удалось войти через Apple';
            Alert.alert('Ошибка', msg);
        }
    };

    const handleEmailSignIn = () => {
        router.push('/login');
    };

    const handleEmailSignUp = () => {
        router.push('/register');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header with Star Logo - LEFT aligned */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={32} height={32} />
                <Text style={styles.headerTitle}>Давайте начнем</Text>
            </View>

            {/* Subtitle - LEFT aligned */}
            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitleText}>
                    Поможем тебе перестать залипать и начать заниматься тем, что реально развивает
                </Text>
            </View>

            {/* Spacer above buttons to center them */}
            <View style={styles.spacer} />


            {/* Main Action Buttons */}
            <View style={styles.actionContainer}>
                <Button
                    title="Войти"
                    onPress={handleEmailSignIn}
                    variant="primary"
                />
                <Button
                    title="Зарегистрироваться"
                    onPress={handleEmailSignUp}
                    variant="primary"
                />
            </View>

            {/* Spacer below buttons to center them */}
            <View style={styles.spacer} />

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Или</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialContainer}>
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleGoogleSignIn}
                >
                    <Image
                        source={require('../../assets/icons/google-logo.png')}
                        style={styles.socialIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleAppleSignIn}
                >
                    <FontAwesome name="apple" size={24} color="black" />
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
        justifyContent: 'flex-start',
        marginTop: 130,
        marginBottom: 12,
        gap: 10,
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        color: colors.text,
        fontWeight: '700',
    },
    subtitleContainer: {
        alignItems: 'flex-start',
        marginBottom: 0,
    },
    subtitleText: {
        fontFamily: fonts.heading.light,
        fontSize: 16,
        lineHeight: 24,
        color: colors.textMuted || colors.textSecondary,
        textAlign: 'left',
        width: '90%',
    },
    spacer: {
        flex: 1,
    },
    actionContainer: {
        gap: 14,
        marginBottom: 24,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.auth?.divider || colors.border,
    },
    dividerText: {
        fontFamily: fonts.heading.regular,
        fontSize: 14,
        color: colors.auth?.dividerText || colors.textSecondary,
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
        borderColor: colors.auth?.socialBorder || colors.border,
        backgroundColor: 'transparent',
        gap: 12,
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    socialButtonText: {
        fontFamily: fonts.heading.medium,
        fontSize: 18,
        color: colors.text,
    },
});
