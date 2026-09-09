import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { useUserGoalsStore } from '../store/userGoalsStore';
import { EXPERIENCE_OPTIONS, ExperiencePreference } from '../domain/onboarding/goals';
import { logEvent } from '../services/analytics';
import { ROUTES } from '../config/routes';

const TOTAL_STEPS = 13;
const CURRENT_STEP = 13;

export default function OnboardingExperienceScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const { experiencePreference, setExperiencePreference, markExtensionCompleted } =
        useUserGoalsStore();
    const [selected, setSelected] = useState<ExperiencePreference | null>(experiencePreference);

    const handleContinue = () => {
        if (selected === null) return;
        console.log('[OnboardingExperience] continue - preference:', selected);
        setExperiencePreference(selected);
        markExtensionCompleted();
        logEvent('experience_level_selected', { preference: selected });
        logEvent('onboarding_extended_completed', {});
        router.push(ROUTES.HOBBY_SELECTION as any);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            <View style={styles.logoContainer}>
                <LogoNew width={scale(160)} height={scale(36)} variant="full" color={colors.text} />
            </View>

            <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>
                    {CURRENT_STEP} / {TOTAL_STEPS}
                </Text>
            </View>

            <View style={styles.contentWrapper}>
                <View style={styles.questionContainer}>
                    <Text style={styles.questionText}>
                        {t('How do you usually approach new skills?')}
                    </Text>
                    <Text style={styles.hintText}>
                        {t('This is just a hint — we will ask per skill later.')}
                    </Text>
                </View>

                <View style={styles.optionsContainer}>
                    {EXPERIENCE_OPTIONS.map((option) => {
                        const isSelected = selected === option.id;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                style={styles.optionRow}
                                onPress={() => setSelected(option.id)}
                                activeOpacity={0.7}
                            >
                                <View
                                    style={[
                                        styles.radioCircle,
                                        isSelected && styles.radioCircleSelected,
                                    ]}
                                >
                                    {isSelected && <View style={styles.radioInner} />}
                                </View>
                                <View style={styles.optionTextWrap}>
                                    <Text style={styles.optionText}>{t(option.label)}</Text>
                                    <Text style={styles.optionHint}>{t(option.hint)}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <View style={styles.bottomContainer}>
                <Button
                    title={t('Continue')}
                    onPress={handleContinue}
                    disabled={selected === null}
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
        contentWrapper: {
            flex: 1,
            justifyContent: 'center',
        },
        questionContainer: {
            paddingHorizontal: scale(24),
            marginBottom: scale(28),
        },
        questionText: {
            fontFamily: fonts.heading.bold,
            fontSize: 24,
            lineHeight: 32,
            color: colors.text,
            marginBottom: scale(8),
        },
        hintText: {
            fontFamily: fonts.body.light,
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
        },
        optionsContainer: {
            paddingHorizontal: scale(24),
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
            minHeight: 56,
        },
        radioCircle: {
            width: 24,
            height: 24,
            borderRadius: 12,
            borderWidth: 1.5,
            borderColor: colors.text,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 16,
        },
        radioCircleSelected: {
            borderColor: colors.text,
        },
        radioInner: {
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: colors.text,
        },
        optionTextWrap: {
            flex: 1,
        },
        optionText: {
            fontFamily: fonts.body.light,
            fontSize: 16,
            lineHeight: 24,
            color: colors.text,
        },
        optionHint: {
            fontFamily: fonts.body.light,
            fontSize: 13,
            lineHeight: 18,
            color: colors.textSecondary,
            marginTop: 2,
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
