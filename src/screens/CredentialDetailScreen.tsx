import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { getProgram, programShortTitle } from '../domain/credentials/catalog';
import { useCredentialStore } from '../store/credentialStore';
import { useCertificateProgress } from '../hooks/useCertificateProgress';
import { useLearningIntelligence } from '../hooks/useLearningIntelligence';
import { useTaskStore } from '../store/taskStore';
import { ProgressBar, SkillBar } from '../components/credentials/SkillBar';
import { routeForRecommendation } from '../domain/sessions/sessionRouting';
import { reasonCopy } from '../utils/learningCopy';

/**
 * Verified-skill detail — progressive disclosure.
 * Shows: verified state, skills, next best action, readiness.
 * Hides until relevant: retake/recovery/project mechanics, credential
 * ID/verification (backend phases). Practice uses the shared swipe
 * session (review-only weak-skill bite).
 */
export const CredentialDetailScreen: React.FC = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const slug = String(params.slug ?? '');
    const program = getProgram(slug);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const cert = useCertificateProgress(slug || null);
    const enroll = useCredentialStore(s => s.enroll);
    const getReadiness = useCredentialStore(s => s.getReadiness);
    const snapshot = useTaskStore(s => s.snapshot);
    const dailyTasks = useTaskStore(s => s.dailyTasks);

    const readiness = useMemo(() => {
        if (!program || !cert.eligible) return null;
        try {
            return getReadiness(slug, cert.tasks, cert.sessions, cert.streakDays, snapshot?.avg_completion_7d ?? null);
        } catch {
            return null;
        }
    }, [program, cert.eligible, cert.tasks, cert.sessions, cert.streakDays, snapshot, getReadiness, slug]);

    // Next action comes from the ONE intelligence source (Skill State +
    // recommendation), targeting a real encountered day.
    const { recommendation } = useLearningIntelligence({ hobbyId: program?.evidenceHobbyIds[0] ?? null, minutes: 10 });

    if (!program) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.title}>Program not found</Text>
            </SafeAreaView>
        );
    }

    const enrolled = cert.enrolled;
    const pct = Math.round(cert.overall);
    const failingCount = cert.skills.filter(s => !s.passed).length;
    const actionTitle =
        recommendation?.skillName ??
        (recommendation?.taskId ? (dailyTasks.find(dt => dt.id === recommendation.taskId)?.title ?? null) : null);
    const actionRoute = recommendation ? routeForRecommendation(recommendation, 'quick_session') : null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        console.log('[CredentialDetail] Back pressed');
                        router.back();
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{programShortTitle(program.title)}</Text>

                {!enrolled ? (
                    <View style={styles.card}>
                        <Text style={styles.body}>
                            {t('Учись как обычно — Zenyth сам проверит навыки по твоим занятиям.')}
                        </Text>
                        <TouchableOpacity
                            style={styles.primaryButton}
                            activeOpacity={0.85}
                            onPress={() => {
                                console.log('[CredentialDetail] Enroll pressed:', slug);
                                enroll(slug);
                            }}
                        >
                            <Text style={styles.primaryText}>{t('Начать проверку')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.heroCard}>
                            <Text style={styles.heroKicker}>{t('Подтверждённый навык')}</Text>
                            <Text style={styles.heroPct}>{pct}%</Text>
                            <ProgressBar value={pct} />
                        </View>

                        <Text style={styles.sectionTitle}>{t('Навыки')}</Text>
                        {cert.skills.map(s => (
                            <SkillBar key={s.skillKey} name={s.name} score={s.score} minimumScore={s.minimumScore} />
                        ))}

                        {enrolled && actionTitle && actionRoute && recommendation && (
                            <View style={styles.actionCard}>
                                <Text style={styles.actionKicker}>{t('Следующий шаг')}</Text>
                                <Text style={styles.actionTitle}>{actionTitle}</Text>
                                <Text style={styles.actionWhy}>
                                    {t('Почему это?')} {reasonCopy(recommendation.reasonCode, recommendation.reasonData)} · 10 {t('min')}
                                </Text>
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        console.log('[CredentialDetail] Practice pressed:', actionRoute);
                                        router.push(actionRoute as any);
                                    }}
                                >
                                    <Text style={styles.primaryText}>{t('Практиковать')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {readiness && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>
                                    {t('Готовность')} · {Math.round(readiness.readiness)}%
                                </Text>
                                <Text style={styles.body}>
                                    {readiness.likelyToPass
                                        ? t('Высокий шанс сдать экзамен.')
                                        : failingCount > 0
                                          ? t('Пока не готов') +
                                            ` — ${failingCount} ${t('навыка ниже нужного уровня')}.`
                                          : t('Продолжай практиковаться.')}
                                </Text>
                            </View>
                        )}
                    </>
                )}
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
            paddingHorizontal: scale(16),
            paddingTop: scale(8),
            paddingBottom: scale(4),
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: scale(6),
        },
        backText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(16),
            color: colors.text,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(26),
            lineHeight: scale(32),
            color: colors.text,
            marginTop: scale(4),
            marginBottom: scale(12),
        },
        heroCard: {
            backgroundColor: '#D1FAE5',
            borderRadius: scale(25),
            padding: scale(20),
            marginBottom: scale(16),
        },
        heroKicker: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: '#1E1E2E',
            opacity: 0.7,
            marginBottom: scale(4),
        },
        heroPct: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(44),
            color: '#1E1E2E',
            marginBottom: scale(8),
        },
        sectionTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            color: colors.text,
            marginTop: scale(8),
            marginBottom: scale(12),
        },
        actionCard: {
            backgroundColor: '#D6EBFD',
            borderRadius: scale(25),
            padding: scale(20),
            marginTop: scale(16),
        },
        actionKicker: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: '#1E1E2E',
            opacity: 0.7,
            marginBottom: scale(4),
        },
        actionTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: '#1E1E2E',
            marginBottom: scale(4),
        },
        actionWhy: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            color: '#1E1E2E',
            opacity: 0.75,
            marginBottom: scale(14),
        },
        card: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(25),
            padding: scale(20),
            marginTop: scale(12),
        },
        cardTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: colors.text,
            marginBottom: scale(8),
        },
        body: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.text,
        },
        primaryButton: {
            marginTop: scale(12),
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
        },
        primaryText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#FFFFFF',
        },
    });

export default CredentialDetailScreen;
