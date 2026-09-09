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
import { ONBOARDING_DURATION_OPTIONS } from '../domain/sessions/sessionDurations';
import { logEvent } from '../services/analytics';
import { ROUTES } from '../config/routes';

const TOTAL_STEPS = 13;
const CURRENT_STEP = 12;

export default function OnboardingSessionLengthScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const { preferredSessionMinutes, setPreferredSessionMinutes } = useUserGoalsStore();
    const [selected, setSelected] = useState<number | null>(preferredSessionMinutes);

    const handleSelect = (minutes: number) => {
        setSelected((prev) => (prev === minutes ? null : minutes));
    };

    const handleContinue = () => {
        if (selected === null) return;
        console.log('[OnboardingSessionLength] continue - minutes:', selected);
        setPreferredSessionMinutes(selected);
        logEvent('preferred_session_minutes_selected', { minutes: selected });
        router.push(ROUTES.ONBOARDING_EXPERIENCE as any);
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

            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>{t('How much time do you usually have?')}</Text>
                <Text style={styles.subtitleText}>
                    {t('We will tailor sessions to fit your day.')}
                </Text>
            </View>

            <View style={styles.optionsContainer}>
                {ONBOARDING_DURATION_OPTIONS.map((minutes) => {
                    const isSelected = selected === minutes;
                    const isLast = minutes === ONBOARDING_DURATION_OPTIONS[ONBOARDING_DURATION_OPTIONS.length - 1];
                    return (
                        <TouchableOpacity
                            key={minutes}
                            style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                            onPress={() => handleSelect(minutes)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                                {minutes} {t('min')}
                                {isLast ? '+' : ''}
                            </Text>
                            <View
                                style={[
                                    styles.circle,
                                    { backgroundColor: colors.hobbySelection?.unselectedBg || colors.border },
                                    isSelected && { backgroundColor: '#FFF' },
                                ]}
                            />
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.spacer} />

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
        contentContainer: {
            paddingHorizontal: scale(24),
            marginTop: scale(32),
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
        },
        optionsContainer: {
            paddingHorizontal: scale(24),
            marginTop: scale(28),
            gap: scale(12),
        },
        optionRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: scale(50),
            paddingVertical: scale(11),
            paddingHorizontal: scale(20),
            borderRadius: scale(40),
            backgroundColor: colors.hobbySelection?.selectedBorderBg || colors.surfaceLight,
        },
        optionRowSelected: {
            backgroundColor: colors.hobbySelection?.selectedBg || colors.buttonPrimary,
        },
        optionLabel: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.text,
        },
        optionLabelSelected: {
            color: '#FFF',
        },
        circle: {
            width: scale(24),
            height: scale(24),
            borderRadius: scale(12),
        },
        spacer: {
            flex: 1,
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
