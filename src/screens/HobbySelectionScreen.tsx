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
import { LogoNew } from '../components/Logo';
import { colors } from '../theme';
import { useUserProfileStore } from '../store/userProfileStore';
import { useQuizStore } from '../store/quizStore';
import { matchHobbies, quizAnswersToProfile, HobbyMatch } from '../services/hobbyMatcher';

// Scale from Figma (402x874) to iPhone 17 Pro
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Custom circle indicator matching Figma design
const SelectionCircle: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
    <View style={[circleStyles.circle, isSelected && circleStyles.circleSelected]} />
);

const CIRCLE_SIZE = scale(24);

const circleStyles = StyleSheet.create({
    circle: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
        backgroundColor: '#C8D0DC',
    },
    circleSelected: {
        backgroundColor: '#08132A',
    },
});

export default function HobbySelectionScreen() {
    const router = useRouter();
    const { setSelectedHobby } = useUserProfileStore();
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
        // Toggle: deselect if already selected, otherwise select new one
        setSelectedId(prev => (prev === hobbyId ? null : hobbyId));
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
                <LogoNew width={scale(160)} height={scale(36)} variant="full" />
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

            {/* Hobby rows with custom toggles */}
            <View style={styles.hobbiesContainer}>
                {matchedHobbies.map((match) => {
                    const isSelected = selectedId === match.hobby.id;
                    return (
                        <TouchableOpacity
                            key={match.hobby.id}
                            style={[
                                styles.hobbyRow,
                                isSelected && styles.hobbyRowSelected,
                            ]}
                            onPress={() => handleSelect(match.hobby.id)}
                            activeOpacity={0.8}
                        >
                            <Text
                                style={[
                                    styles.hobbyLabel,
                                    isSelected && styles.hobbyLabelSelected,
                                ]}
                            >
                                {match.hobby.titleRu}
                            </Text>
                            <SelectionCircle isSelected={isSelected} />
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[
                        styles.continueButton,
                        !selectedId && styles.continueButtonDisabled,
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
        marginTop: scale(80),
    },
    titleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(30),
        color: '#08132A',
        width: scale(175),
        marginBottom: scale(16),
    },
    subtitleText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        color: '#08132A',
        width: scale(342),
    },
    hobbiesContainer: {
        paddingHorizontal: scale(24),
        marginTop: scale(40),
        gap: scale(15),
    },
    hobbyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: scale(50),
        paddingVertical: scale(11),
        paddingHorizontal: scale(20),
        borderRadius: scale(40),
        backgroundColor: '#DAE7F8',
    },
    hobbyRowSelected: {
        backgroundColor: '#37A0EF',
    },
    hobbyLabel: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        color: '#08132A',
    },
    hobbyLabelSelected: {
        color: '#08132A',
    },
    spacer: {
        flex: 1,
    },
    buttonContainer: {
        paddingHorizontal: scale(44),
        paddingBottom: scale(32),
        alignItems: 'center',
    },
    continueButton: {
        width: scale(315),
        height: scale(60),
        borderRadius: scale(30),
        backgroundColor: '#102852',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    continueButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        color: '#FFF',
        textAlign: 'center',
    },
    noteText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(10),
        color: '#08132A',
        textAlign: 'center',
        marginTop: scale(12),
    },
});
