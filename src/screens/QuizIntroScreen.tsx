import React, { useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors } from '../theme';
import { useQuizStore } from '../store/quizStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

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
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
