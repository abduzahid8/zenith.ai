import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useQuizStore } from '../store/quizStore';
import { useAppTheme } from '../theme/useAppTheme';

export default function QuizIntroScreen() {
    const router = useRouter();
    const resetQuiz = useQuizStore((state) => state.resetQuiz);
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Reset quiz when entering this screen
    useEffect(() => {
        resetQuiz();
    }, []);

    const handleStart = () => {
        router.push('/quiz');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(177)} height={scale(40)} variant="full" color={colors.text} />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>Find your thing</Text>
                <Text style={styles.subtitleText}>
                    Answer a few questions{'\n'}
                    and we'll find an activity{'\n'}
                    that suits you perfectly.
                </Text>
            </View>

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <Button
                    title="Let's go"
                    onPress={handleStart}
                />
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 80,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    titleText: {
        fontFamily: fonts.heading.bold,
        fontSize: 26,
        lineHeight: 34,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitleText: {
        fontFamily: fonts.body.light,
        fontSize: 16,
        lineHeight: 24,
        color: colors.text,
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
