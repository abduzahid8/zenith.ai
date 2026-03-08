import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { colors, fonts } from '../theme';
import { useUserProfileStore } from '../store/userProfileStore';
import { useQuizStore } from '../store/quizStore';
import { useAuthStore } from '../store/authStore';
import { matchHobbies, HobbyMatch } from '../services/hobbyMatcher';
import { dbService } from '../services/supabase';
import { scale } from '../constants';

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
        backgroundColor: colors.hobbySelection.unselectedBg,
    },
    circleSelected: {
        backgroundColor: colors.text,
    },
});

export default function HobbySelectionScreen() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const { setSelectedHobby } = useUserProfileStore();
    const { answers } = useQuizStore();
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [matchedHobbies, setMatchedHobbies] = useState<HobbyMatch[]>([]);
    const [saving, setSaving] = useState(false);

    // Calculate matches when screen loads
    useEffect(() => {
        const topMatches = matchHobbies(answers, 3);
        setMatchedHobbies(topMatches);
    }, [answers]);

    const handleSelect = (hobbyId: string) => {
        setSelectedId(prev => (prev === hobbyId ? null : hobbyId));
    };

    const handleContinue = async () => {
        if (!selectedId || !user) return;
        setSaving(true);
        try {
            await dbService.saveHobby(user.id, selectedId, true);
            setSelectedHobby(selectedId);
            router.push('/subscription');
        } catch (e: unknown) {
            setSaving(false);
            Alert.alert(
                'Ошибка',
                e instanceof Error ? e.message : 'Не удалось сохранить выбор. Проверьте интернет и попробуйте снова.',
                [{ text: 'OK' }]
            );
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
                        (!selectedId || saving) && styles.continueButtonDisabled,
                    ]}
                    onPress={handleContinue}
                    disabled={!selectedId || saving}
                    activeOpacity={0.8}
                >
                    {saving ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.continueButtonText}>Приступим</Text>
                    )}
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
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(30),
        color: colors.text,
        width: scale(175),
        marginBottom: scale(16),
    },
    subtitleText: {
        fontFamily: fonts.heading.light,
        fontSize: scale(20),
        color: colors.text,
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
        backgroundColor: colors.hobbySelection.selectedBorderBg,
    },
    hobbyRowSelected: {
        backgroundColor: colors.hobbySelection.selectedBg,
    },
    hobbyLabel: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
    },
    hobbyLabelSelected: {
        color: colors.white,
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
        backgroundColor: colors.buttonPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(10),
    },
    continueButtonDisabled: {
        opacity: 0.5,
    },
    continueButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: '#FFF',
        textAlign: 'center',
    },
    noteText: {
        fontFamily: fonts.heading.light,
        fontSize: scale(10),
        color: colors.text,
        textAlign: 'center',
        marginTop: scale(12),
    },
});
