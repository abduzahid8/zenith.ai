import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { useUserGoalsStore } from '../store/userGoalsStore';
import { GOAL_OPTIONS, MAX_GOALS } from '../domain/onboarding/goals';
import { logEvent } from '../services/analytics';
import { ROUTES } from '../config/routes';

// Total onboarding steps: 10 quiz questions + 3 extension steps.
const TOTAL_STEPS = 13;
const CURRENT_STEP = 11;

// Circle indicator — same pattern as HobbySelectionScreen.
const SelectionCircle: React.FC<{ isSelected: boolean; colors: any }> = ({ isSelected, colors }) => (
    <View
        style={[
            circleStyles.circle,
            { backgroundColor: colors.hobbySelection?.unselectedBg || colors.border },
            isSelected && { backgroundColor: colors.text },
        ]}
    />
);

const CIRCLE_SIZE = scale(24);

const circleStyles = StyleSheet.create({
    circle: {
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        borderRadius: CIRCLE_SIZE / 2,
    },
});

export default function OnboardingGoalsScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const { goals, toggleGoal } = useUserGoalsStore();

    const canProceed = goals.length > 0;

    const handleContinue = () => {
        if (!canProceed) return;
        console.log('[OnboardingGoals] continue - goals:', goals);
        logEvent('onboarding_goal_selected', { goals, count: goals.length });
        router.push(ROUTES.ONBOARDING_SESSION_LENGTH as any);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.logoContainer}>
                <LogoNew width={scale(160)} height={scale(36)} variant="full" color={colors.text} />
            </View>

            {/* Progress indicator — same pattern as QuizScreen */}
            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                    {CURRENT_STEP} / {TOTAL_STEPS}
                </Text>
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.titleText}>{t('What do you want to get from Zenyth?')}</Text>
                <Text style={styles.subtitleText}>
                    {t('Choose up to')} {MAX_GOALS}. {t('You can change this later.')}
                </Text>

                <View style={styles.optionsContainer}>
                    {GOAL_OPTIONS.map((option) => {
                        const isSelected = goals.includes(option.id);
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                                onPress={() => toggleGoal(option.id)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                    {t(option.label)}
                                </Text>
                                <SelectionCircle isSelected={isSelected} colors={colors} />
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>

            <View style={styles.bottomContainer}>
                <Button
                    title={t('Continue')}
                    onPress={handleContinue}
                    disabled={!canProceed}
                    size="large"
                />
                <TouchableOpacity
                    style={styles.backLink}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Text style={styles.backLinkText}>{t('Back')}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        logoContainer: {
            alignItems: 'center',
            marginTop: scale(60),
        },
        progressContainer: {
            paddingHorizontal: scale(24),
            marginTop: scale(24),
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(12),
        },
        progressTrack: {
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surface || colors.surfaceLight,
            overflow: 'hidden',
        },
        progressFill: {
            height: '100%',
            borderRadius: 2,
            backgroundColor: '#102852',
        },
        progressLabel: {
            fontFamily: fonts.body.medium,
            fontSize: 13,
            color: colors.textSecondary,
            minWidth: 40,
            textAlign: 'right',
        },
        scroll: {
            flex: 1,
        },
        scrollContent: {
            paddingHorizontal: scale(24),
            paddingTop: scale(24),
            paddingBottom: scale(16),
        },
        titleText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            lineHeight: scale(30),
            color: colors.text,
            marginBottom: scale(8),
        },
        subtitleText: {
            fontFamily: fonts.heading.light,
            fontSize: scale(16),
            color: colors.text,
            marginBottom: scale(24),
        },
        optionsContainer: {
            gap: scale(12),
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: scale(50),
            paddingVertical: scale(11),
            paddingHorizontal: scale(20),
            borderRadius: scale(40),
            backgroundColor: colors.hobbySelection?.selectedBorderBg || colors.surfaceLight,
        },
        optionRowSelected: {
            backgroundColor: colors.hobbySelection?.selectedBg || colors.buttonPrimary,
        },
        optionLabel: {
            flex: 1,
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.text,
            marginRight: scale(12),
        },
        optionLabelSelected: {
            color: '#FFF',
        },
        bottomContainer: {
            paddingHorizontal: scale(24),
            paddingBottom: scale(32),
            alignItems: 'center',
        },
        backLink: {
            marginTop: scale(12),
            paddingVertical: scale(6),
        },
        backLinkText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(15),
            color: colors.textSecondary,
        },
    });
