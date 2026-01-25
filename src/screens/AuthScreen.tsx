import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { colors } from '../theme';

export default function AuthScreen() {
    const router = useRouter();

    const handleGoogleSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleAppleSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleEmailSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleEmailSignUp = () => {
        router.push('/quiz-intro');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <Logo size="large" />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>Давайте начнем !</Text>
                <Text style={styles.subtitleText}>
                    Поможем тебе перестать{'\n'}
                    залипать и начать заниматься{'\n'}
                    тем, что реально развивает
                </Text>
            </View>

            {/* Auth buttons */}
            <View style={styles.authContainer}>
                {/* Google Sign-In */}
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleGoogleSignIn}
                >
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                {/* Apple Sign-In */}
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleAppleSignIn}
                >
                    <Image
                        source={require('../../assets/icons/apple.png')}
                        style={styles.appleIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Apple</Text>
                </TouchableOpacity>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Email buttons */}
                <Button
                    title="Войти"
                    onPress={handleEmailSignIn}
                    style={styles.emailButton}
                />

                <Button
                    title="Зарегистрироваться"
                    onPress={handleEmailSignUp}
                    variant="secondary"
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
        marginTop: 60,
    },
    contentContainer: {
        paddingHorizontal: 24,
        marginTop: 40,
        alignItems: 'center',
    },
    titleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 26,
        lineHeight: 34,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitleText: {
        fontFamily: 'Gramatika-Light',
        fontSize: 16,
        lineHeight: 24,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    authContainer: {
        flex: 1,
        paddingHorizontal: 48,
        justifyContent: 'flex-end',
        paddingBottom: 48,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        borderRadius: 28,
        paddingVertical: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        gap: 12,
    },
    googleIcon: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 20,
        color: '#4285F4',
    },
    appleIcon: {
        width: 20,
        height: 24,
    },
    socialButtonText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: 16,
        color: colors.text,
    },
    spacer: {
        height: 24,
    },
    emailButton: {
        marginBottom: 12,
    },
});
