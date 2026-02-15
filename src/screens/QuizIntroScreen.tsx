import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme';
import { scale } from '../constants';
import { useQuizStore } from '../store/quizStore';

export default function QuizIntroScreen() {
    const router = useRouter();
    const resetQuiz = useQuizStore((state) => state.resetQuiz);

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
                <LogoNew width={scale(177)} height={scale(40)} variant="full" />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>Найди своё дело</Text>
                <Text style={styles.subtitleText}>
                    Ответь на несколько вопросов{'\n'}
                    и мы подберём занятие, которое{'\n'}
                    подойдёт именно тебе.
                </Text>
            </View>

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <Button
                    title="Приступим"
                    onPress={handleStart}
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
        color: colors.text, // Color change
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitleText: {
        fontFamily: fonts.body.light, // Font change
        fontSize: 16,
        lineHeight: 24,
        color: colors.text, // Color change
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
