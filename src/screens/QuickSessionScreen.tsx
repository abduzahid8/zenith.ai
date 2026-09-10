import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT, useLanguageStore } from '../store/languageStore';
import { useTaskStore } from '../store/taskStore';
import { useLearningIntelligence } from '../hooks/useLearningIntelligence';
import { DISCOVERY_TOPICS } from '../domain/sessions/discoveryBank';
import {
    discoveryRoute,
    routeForRecommendation,
} from '../domain/sessions/sessionRouting';
import { reasonCopy } from '../utils/learningCopy';

const TIMES = [5, 10, 15];

/**
 * Quick Session — time first, then one recommendation.
 * User language only ("Recommended practice" / "Explore something new");
 * certificate_review + discovery stay internal kinds.
 */
export const QuickSessionScreen: React.FC = () => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const language = useLanguageStore(s => s.language);
    const dailyTasks = useTaskStore(s => s.dailyTasks);

    const [minutes, setMinutes] = useState(5);
    const [topicId, setTopicId] = useState<string | null>(null);

    // ONE recommendation source: LearningEvents -> Skill State -> action.
    const { recommendation } = useLearningIntelligence({ minutes });

    const recommended = useMemo(() => {
        if (!recommendation) return null;
        const title =
            recommendation.skillName ??
            (recommendation.taskId
                ? (dailyTasks.find(dt => dt.id === recommendation.taskId)?.title ?? null)
                : null) ??
            '';
        if (!title) return null;
        return {
            title,
            why: reasonCopy(recommendation.reasonCode, recommendation.reasonData, language),
            route: routeForRecommendation(recommendation, 'quick_session'),
        };
    }, [recommendation, dailyTasks]);

    const exploreRoute = topicId ? discoveryRoute(minutes, topicId) : null;

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        console.log('[QuickSession] Back pressed');
                        router.back();
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('Быстрая практика')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>{t('Сколько у тебя времени?')}</Text>
                <View style={styles.timeRow}>
                    {TIMES.map(m => (
                        <TouchableOpacity
                            key={m}
                            style={[styles.timePill, minutes === m && styles.timePillActive]}
                            onPress={() => setMinutes(m)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.timeText, minutes === m && styles.timeTextActive]}>
                                {m} {t('min')}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {recommended && (
                    <>
                        <Text style={styles.sectionTitle}>{t('Рекомендуем')}</Text>
                        <View style={styles.recCard}>
                            <Text style={styles.recTitle} numberOfLines={2}>{recommended.title}</Text>
                            <Text style={styles.recWhy}>
                                {t('Почему это?')} {recommended.why} · {minutes} {t('min')}
                            </Text>
                            <TouchableOpacity
                                style={styles.startButton}
                                activeOpacity={0.85}
                                onPress={() => {
                                    console.log('[QuickSession] Recommended start:', recommended.route);
                                    router.push(recommended.route as any);
                                }}
                            >
                                <Text style={styles.startText}>{t('Начать')}</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <Text style={styles.sectionTitle}>{t('Изучить новое')}</Text>
                <Text style={styles.sectionHint}>{t('Короткая тема без оценок и прогресса')}</Text>
                {DISCOVERY_TOPICS.map(topic => {
                    const label = language === 'ru' ? topic.titleRu : topic.title;
                    const active = topicId === topic.id;
                    return (
                        <TouchableOpacity
                            key={topic.id}
                            style={[styles.topicRow, active && styles.topicRowActive]}
                            activeOpacity={0.8}
                            onPress={() => setTopicId(prev => (prev === topic.id ? null : topic.id))}
                        >
                            <Text style={[styles.topicText, active && styles.topicTextActive]} numberOfLines={2}>
                                {label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity
                    style={[styles.startButton, !exploreRoute && styles.startDisabled]}
                    activeOpacity={0.85}
                    disabled={!exploreRoute}
                    onPress={() => {
                        if (!exploreRoute) return;
                        console.log('[QuickSession] Discovery start:', exploreRoute);
                        router.push(exploreRoute as any);
                    }}
                >
                    <Text style={styles.startText}>{t('Начать')}</Text>
                </TouchableOpacity>
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
            paddingBottom: scale(12),
            gap: scale(12),
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
        title: {
            flex: 1,
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
        },
        sectionTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            color: colors.text,
            marginTop: scale(16),
            marginBottom: scale(10),
        },
        sectionHint: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            color: colors.textSecondary,
            marginBottom: scale(10),
        },
        timeRow: {
            flexDirection: 'row',
            gap: scale(12),
        },
        timePill: {
            flex: 1,
            height: scale(56),
            borderRadius: scale(28),
            backgroundColor: colors.surfaceLight,
            justifyContent: 'center',
            alignItems: 'center',
        },
        timePillActive: {
            backgroundColor: '#0F2147',
        },
        timeText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            color: colors.text,
        },
        timeTextActive: {
            color: '#FFFFFF',
        },
        recCard: {
            backgroundColor: '#D1FAE5',
            borderRadius: scale(25),
            padding: scale(20),
        },
        recTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            lineHeight: scale(28),
            color: '#1E1E2E',
            marginBottom: scale(6),
        },
        recWhy: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: '#1E1E2E',
            opacity: 0.75,
            marginBottom: scale(16),
        },
        topicRow: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            paddingHorizontal: scale(16),
            paddingVertical: scale(14),
            marginBottom: scale(10),
        },
        topicRowActive: {
            backgroundColor: '#0F2147',
        },
        topicText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(15),
            color: colors.text,
        },
        topicTextActive: {
            color: '#FFFFFF',
        },
        startButton: {
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            height: scale(56),
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: scale(8),
        },
        startDisabled: {
            opacity: 0.4,
        },
        startText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: '#FFFFFF',
        },
    });

export default QuickSessionScreen;
