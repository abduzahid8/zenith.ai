import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { LucidGlassButton } from '../components/LucidGlassButton';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';
import { useQuizStore } from '../store/quizStore';
import { matchHobbies, quizAnswersToProfile, HobbyMatch } from '../services/hobbyMatcher';

// Scale from Figma (402x874) to iPhone 17 Pro
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

export default function HobbySelectionScreen() {
    const router = useRouter();
    const { setSelectedHobby } = useAuthStore();
    const { answers } = useQuizStore();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [matchedHobbies, setMatchedHobbies] = useState<HobbyMatch[]>([]);

    // Calculate matches when screen loads
    useEffect(() => {
        const userProfile = quizAnswersToProfile(answers);
        const topMatches = matchHobbies(userProfile, 3);
        setMatchedHobbies(topMatches);
    }, [answers]);

    const handleSelect = (hobbyId: string) => {
        setSelectedId(hobbyId);
    };

    const handleContinue = () => {
        if (selectedId) {
            setSelectedHobby(selectedId);
            router.push('/subscription');
        }
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
                <Text style={styles.titleText}>
                    Хобби, которые{'\n'}подходят тебе
                </Text>
                <Text style={styles.subtitleText}>
                    На основе твоих ответов.{'\n'}
                    Выбери одно, чтобы начать.
                </Text>
            </View>

            {/* Hobby pills with lucid glass effect */}
            <View style={styles.hobbiesContainer}>
                {matchedHobbies.map((match) => (
                    <LucidGlassButton
                        key={match.hobby.id}
                        label={match.hobby.titleRu}
                        emoji={match.hobby.emoji}
                        isSelected={selectedId === match.hobby.id}
                        onPress={() => handleSelect(match.hobby.id)}
                    />
                ))}
            </View>

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        !selectedId && styles.continueButtonDisabled
                    ]}
                    onPress={handleContinue}
                    disabled={!selectedId}
                    activeOpacity={0.8}
                >
                    <Text style={styles.continueButtonText}>Приступим</Text>
                </TouchableOpacity>
                <Text style={styles.noteText}>
                    Не переживай — это не навсегда.
                </Text>
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
        marginTop: scale(60),
    },
    contentContainer: {
        paddingHorizontal: scale(24),
        marginTop: scale(50),
    },
    // Figma: Gramatika 24px, 700, line-height 30px
    titleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(30),
        color: '#000',
        marginBottom: scale(16),
    },
    // Figma: Geometria 20px, 300 (using Gramatika-Light as fallback)
    subtitleText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        lineHeight: scale(26),
        color: '#000',
    },
    hobbiesContainer: {
        paddingHorizontal: scale(24),
        marginTop: scale(48),
        alignItems: 'center',
        gap: scale(16),
    },
    spacer: {
        flex: 1,
    },
    buttonContainer: {
        paddingHorizontal: scale(44),
        paddingBottom: scale(32),
        alignItems: 'center',
    },
    // Figma: 315px width, 60px height, border-radius 30px, BLACK background
    continueButton: {
        width: scale(315),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    // Figma: Gramatika 20px, 700, WHITE text
    continueButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        color: '#FFF',
        textAlign: 'center',
    },
    // Figma: Geometria 10px, 300
    noteText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(10),
        color: '#000',
        textAlign: 'center',
        marginTop: scale(12),
    },
});
