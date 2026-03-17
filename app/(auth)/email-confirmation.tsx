import React, { useState, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Alert,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { authService } from '../../src/services/supabase/auth';
import { LogoNew } from '../../src/components/Logo';

const MailSentIcon = () => (
    <Svg width="80" height="80" viewBox="0 0 28 28" fill="none">
        <Path d="M22.6333 9.56665C23.1487 9.18005 23.88 9.28453 24.2666 9.79999C24.6532 10.3155 24.5487 11.0467 24.0333 11.4333L16.8 16.8583H16.7999C15.1536 18.093 12.8949 18.1027 11.239 16.8873L11.2 16.8583L3.96661 11.4334C3.45116 11.0468 3.34668 10.3155 3.73327 9.80006C4.11986 9.2846 4.85114 9.18012 5.36661 9.56672L12.6 14.9916H12.5999C13.4296 15.6139 14.5703 15.6139 15.4 14.9916L22.6333 9.56665Z" fill="#102852" />
        <Path d="M23.3334 10.7063C23.3334 10.2826 23.1036 9.89216 22.7333 9.68639L14.5666 5.14938V5.14934C14.2142 4.95359 13.7858 4.95358 13.4334 5.14934L5.26678 9.68642C4.89641 9.89219 4.66668 10.2826 4.66668 10.7063V19.8333C4.66668 20.4777 5.18903 21 5.83337 21H22.1667C22.8111 21 23.3334 20.4777 23.3334 19.8333V10.7063ZM25.6667 19.8333C25.6667 21.7663 24.0997 23.3333 22.1667 23.3333H5.83337C3.90039 23.3333 2.33337 21.7664 2.33337 19.8333V10.7063C2.33337 9.43519 3.02249 8.26401 4.13362 7.64672L12.3003 3.10967L12.3003 3.10964C13.3409 2.53158 14.6025 2.52256 15.6501 3.08257L15.6998 3.10964L15.6998 3.10967L23.8665 7.64672C24.9775 8.26401 25.6667 9.43518 25.6667 10.7063V19.8333Z" fill="#102852" />
    </Svg>
);

export default function EmailConfirmationScreen() {
    const router = useRouter();
    const { email } = useLocalSearchParams<{ email: string }>();
    const { colors, isDark } = useAppTheme();
    const [isResending, setIsResending] = useState(false);

    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleOpenMail = useCallback(() => {
        const mailUrl = 'mailto:';
        Linking.canOpenURL(mailUrl).then(supported => {
            if (supported) {
                Linking.openURL(mailUrl);
            } else {
                Alert.alert('Почта', 'Не удалось открыть почтовое приложение. Вы можете зайти в почту через браузер.');
            }
        }).catch(() => {
            Alert.alert('Ошибка', 'Произошла ошибка при открытии почтового приложения.');
        });
    }, []);

    const handleResend = useCallback(async () => {
        if (!email) return;
        setIsResending(true);
        try {
            await authService.resendConfirmation(email);
            Alert.alert('Отправлено', 'Письмо с подтверждением отправлено повторно.');
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : 'Не удалось отправить письмо';
            Alert.alert('Ошибка', msg);
        } finally {
            setIsResending(false);
        }
    }, [email]);

    const handleBackToLogin = useCallback(() => {
        router.replace('/login');
    }, [router]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
                <Text style={styles.headerTitle}>Подтвердите почту</Text>
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                {/* Mail Icon */}
                <View style={styles.iconContainer}>
                    <MailSentIcon />
                </View>

                <Text style={styles.messageTitle}>Письмо отправлено!</Text>
                <Text style={styles.messageBody}>
                    Мы отправили письмо с подтверждением на{' '}
                    <Text style={styles.emailHighlight}>{email || 'вашу почту'}</Text>.
                    {'\n\n'}
                    Перейдите по ссылке в письме, чтобы завершить регистрацию.
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
                <Button
                    title="Открыть почту"
                    onPress={handleOpenMail}
                    variant="primary"
                    size="large"
                    style={styles.openMailButton}
                    textStyle={styles.openMailButtonText}
                />

                <TouchableOpacity
                    onPress={handleResend}
                    disabled={isResending}
                    style={styles.resendButton}
                >
                    <Text style={[styles.resendText, isResending && styles.resendTextDisabled]}>
                        {isResending ? 'Отправляем...' : 'Отправить ещё раз'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleBackToLogin} style={styles.backButton}>
                    <Text style={styles.backText}>Назад к входу</Text>
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
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(16, 40, 82, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    messageTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    messageBody: {
        fontFamily: fonts.body.light,
        fontSize: 17,
        lineHeight: 26,
        color: '#808B9B',
        textAlign: 'center',
    },
    emailHighlight: {
        fontFamily: fonts.body.medium,
        color: '#102852',
    },
    actionsContainer: {
        paddingBottom: 48,
        alignItems: 'center',
    },
    openMailButton: {
        height: 60,
        borderRadius: 35,
        backgroundColor: '#102852',
        marginBottom: 20,
    },
    openMailButtonText: {
        fontFamily: fonts.heading.bold,
        color: '#FFFFFF',
        fontSize: 20,
    },
    resendButton: {
        paddingVertical: 12,
    },
    resendText: {
        fontFamily: fonts.body.medium,
        fontSize: 16,
        color: '#102852',
        textDecorationLine: 'underline',
    },
    resendTextDisabled: {
        opacity: 0.5,
    },
    backButton: {
        paddingVertical: 12,
    },
    backText: {
        fontFamily: fonts.body.medium,
        fontSize: 16,
        color: '#808B9B',
    },
});
