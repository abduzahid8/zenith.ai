import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { ANIMATIONS } from '../utils/animations';
import { CREDENTIAL_PROGRAMS } from '../domain/credentials/catalog';
import { computeSkillXp, levelForXp } from '../domain/credentials/xp';
import { useCredentialStore } from '../store/credentialStore';
import { useAllCertificateProgress } from '../hooks/useCertificateProgress';
import { CredentialCard } from '../components/credentials/CredentialCard';
import TimerProgress from '../components/session/TimerProgress';

/**
 * Credentials hub (§18, §27).
 * - "Zenyth Skill Passport": issued credentials, grouped and verifiable.
 * - "Certification paths": the five launch programs. Progress shown here is
 *   the canonical overall (same % as every other surface) — enroll and keep learning.
 */
export const CredentialsScreen: React.FC = () => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    // Canonical progress only — one engine read shared by all five cards.
    const allCert = useAllCertificateProgress();
    const programs = useCredentialStore(s => s.programs);
    const getPassport = useCredentialStore(s => s.getPassport);

    const passport = getPassport();

    // Skill XP: derived from credential state (correct answers, passes,
    // projects, issued) — same idea as session streaks/badges, no grind.
    const totalXp = CREDENTIAL_PROGRAMS.reduce((sum, p) => {
        const s = programs[p.slug];
        return (
            sum +
            computeSkillXp({
                enrolled: s?.enrolled ?? false,
                correctAnswers: (s?.storedAnswers ?? []).filter(a => a.correct).length,
                finalPassed: (s?.attempts ?? []).some(a => a.passed === true),
                projectSubmitted: s?.projectScore !== null && s?.projectScore !== undefined,
                issued: s?.issued !== null && s?.issued !== undefined,
            })
        );
    }, 0);
    const skillLevel = levelForXp(totalXp);

    const cards = CREDENTIAL_PROGRAMS.map(program => {
        const state = programs[program.slug];
        const cert = allCert[program.slug];
        const progress = state?.enrolled ? cert.progress : null;
        return { program, progress };
    });

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        console.log('[CredentialsScreen] Back pressed');
                        router.back();
                    }}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Credentials</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Skill level header: session-ring language for XP */}
                <Animated.View entering={ANIMATIONS.CardEntrance} style={styles.levelCard}>
                    <TimerProgress
                        progress={skillLevel.progressToNext}
                        size={scale(84)}
                        strokeWidth={scale(10)}
                        color="#37A0EF"
                        trackColor="#D6EBFD"
                    >
                        <Text style={styles.levelNumber}>{skillLevel.level}</Text>
                    </TimerProgress>
                    <View style={styles.levelTextWrap}>
                        <Text style={styles.levelTitle}>
                            Skill Level {skillLevel.level} — {skillLevel.title}
                        </Text>
                        <Text style={styles.levelMeta}>
                            {totalXp} XP
                            {skillLevel.nextLevelMin !== null
                                ? ` · ${skillLevel.xpToNext} XP to Level ${skillLevel.level + 1}`
                                : ' · Max level'}
                        </Text>
                        <Text style={styles.levelHint}>+10 XP per correct answer · +150 final pass · +300 credential</Text>
                    </View>
                </Animated.View>

                <Text style={styles.sectionTitle}>Zenyth Skill Passport</Text>
                {passport.length === 0 ? (
                    <View style={styles.passportEmpty}>
                        <Text style={styles.passportEmptyText}>
                            No verified credentials yet. Enroll in a path below — your daily tasks already count as
                            evidence.
                        </Text>
                    </View>
                ) : (
                    passport.map(cred => (
                        <TouchableOpacity
                            key={cred.credentialId}
                            style={styles.passportCard}
                            activeOpacity={0.85}
                            onPress={() => {
                                console.log('[CredentialsScreen] Passport entry pressed:', cred.credentialId);
                                router.push(`/verify/${encodeURIComponent(cred.credentialId)}` as any);
                            }}
                        >
                            <Text style={styles.passportTitle}>{cred.programTitle}</Text>
                            <Text style={styles.passportMeta}>
                                {cred.credentialId} · {Math.round(cred.finalScore)}% · Verified ✓
                            </Text>
                        </TouchableOpacity>
                    ))
                )}

                <Text style={styles.sectionTitle}>Certification paths</Text>
                <Text style={styles.sectionHint}>
                    One path per hobby you already train. Your Узнай/Сделай tasks, session verdicts and finished
                    units count automatically — enroll and keep learning as usual.
                </Text>
                {cards.map(({ program, progress }, i) => (
                    <Animated.View key={program.slug} entering={ANIMATIONS.ListItemEntrance(i)}>
                    <CredentialCard
                        program={program}
                        progress={progress ? progress.certificationProgress : null}
                        enrolled={programs[program.slug]?.enrolled ?? false}
                        issued={programs[program.slug]?.issued !== null && programs[program.slug]?.issued !== undefined}
                        onPress={() => {
                            console.log('[CredentialsScreen] Program pressed:', program.slug);
                            router.push(`/credential/${program.slug}` as any);
                        }}
                    />
                    </Animated.View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(12),
            paddingHorizontal: scale(20),
            paddingTop: scale(8),
            paddingBottom: scale(12),
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        backText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            color: colors.text,
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            lineHeight: scale(30),
            color: colors.text,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(60),
        },
        levelCard: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: scale(25),
            padding: scale(16),
            marginTop: scale(4),
            marginBottom: scale(8),
            gap: scale(14),
        },
        levelNumber: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(28),
            color: '#1E1E2E',
        },
        levelTextWrap: {
            flex: 1,
        },
        levelTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            lineHeight: scale(24),
            color: colors.text,
        },
        levelMeta: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            color: '#2B5B84',
            marginTop: scale(2),
        },
        levelHint: {
            fontFamily: fonts.body.regular,
            fontSize: scale(12),
            color: colors.textSecondary,
            marginTop: scale(4),
        },
        sectionTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            lineHeight: scale(28),
            color: colors.text,
            marginTop: scale(12),
            marginBottom: scale(8),
        },
        sectionHint: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.textSecondary,
            marginBottom: scale(12),
        },
        passportEmpty: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(8),
        },
        passportEmptyText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.textSecondary,
        },
        passportCard: {
            backgroundColor: '#D1FAE5',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(10),
        },
        passportTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.text,
            marginBottom: scale(4),
        },
        passportMeta: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
        },
    });

export default CredentialsScreen;
