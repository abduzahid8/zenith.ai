import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT, useLanguageStore } from '../store/languageStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useUserGoalsStore } from '../store/userGoalsStore';
import { getProgramForHobby } from '../domain/credentials/catalog';
import { useCertificateProgress } from '../hooks/useCertificateProgress';
import { DurationRows, SelectRow } from '../components/home/DurationRows';
import { Button } from '../components/Button';
import { QuestStrip } from '../components/credentials/QuestStrip';
import { DISCOVERY_TOPICS } from '../domain/sessions/discoveryBank';
import { weakestOpenSkill } from '../services/sessionEvidence';
import { logEvent } from '../services/analytics';

type QuickMode = 'bite' | 'discovery';

/**
 * Quick Session — two modes, one screen (no new pages):
 * - Certificate bite: a short review of the weakest open skill. Runs the
 *   shared Session Engine review-only; evidence flows through the normal
 *   artifact channel with small weight. Never completes DailyPlan tasks.
 * - Discover: independent micro-topic, fully weightless.
 */
export default function QuickSessionScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const language = useLanguageStore((s) => s.language);
    const { preferredSessionMinutes } = useUserGoalsStore();
    const selectedHobby = useUserProfileStore((s) => s.selectedHobby);
    const biteProgramSlug = selectedHobby ? (getProgramForHobby(selectedHobby)?.slug ?? null) : null;
    // Canonical progress only — never scores from today-only dailyTasks.
    const biteCert = useCertificateProgress(biteProgramSlug);

    const [mode, setMode] = useState<QuickMode>('bite');
    const [minutes, setMinutes] = useState<number>(preferredSessionMinutes ?? 5);
    const [discoveryId, setDiscoveryId] = useState<string | null>(null);

    // Weakest open skill of the active certificate track (branch 1).
    // Canonical overall only — same % as Your Day header and detail screens.
    const bite = useMemo(() => {
        const program = biteCert.program;
        if (!program) return null;
        const skill = weakestOpenSkill(program, biteCert.progress);
        if (!skill) return null;
        const def = program.skills.find((s) => s.key === skill.skillKey);
        if (!def) return null;
        return { program, skill, day: def.dayRange[0] };
    }, [biteCert.program, biteCert.progress]);

    /** Shared gate: daily session limits apply to every entry. */
    const checkSessionLimit = (): boolean => {
        const gamificationStore = useGamificationStore.getState();
        const { isPremium } = useUserProfileStore.getState();
        if (gamificationStore.canStartSession(isPremium)) return true;
        Alert.alert(
            t('Лимит сессий'),
            isPremium
                ? t('Вы выполнили дневной лимит (3 сессии). Возвращайтесь завтра!')
                : t('Вы выполнили дневной лимит (3 сессии). Перейдите на Premium для безлимитных сессий, или возвращайтесь завтра!'),
            [{ text: 'ОК' }],
        );
        return false;
    };

    const handleStartBite = () => {
        if (!checkSessionLimit() || !bite) return;
        console.log('[QuickSessionScreen] start bite - skill:', bite.skill.skillKey, 'minutes:', minutes);
        logEvent('quick_session_started', {
            minutes,
            mode: 'bite',
            taskId: null,
            duration: minutes,
        });
        router.push(
            `/session-timer?minutes=${minutes}&kind=structured&origin=quick_session&skillDay=${bite.day}` as any,
        );
    };

    const handleStartDiscovery = () => {
        if (!checkSessionLimit() || !discoveryId) return;
        console.log('[QuickSessionScreen] start discovery - topic:', discoveryId, 'minutes:', minutes);
        logEvent('quick_session_started', {
            minutes,
            mode: 'discovery',
            taskId: null,
            duration: minutes,
        });
        router.push(
            `/session-timer?minutes=${minutes}&kind=discovery&origin=quick_session&discoveryId=${discoveryId}` as any,
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.backButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('Quick session')}</Text>
            </View>

            <View style={styles.modeRow}>
                {(['bite', 'discovery'] as QuickMode[]).map((m) => {
                    const selected = mode === m;
                    return (
                        <TouchableOpacity
                            key={m}
                            style={[styles.modeBtn, selected && styles.modeBtnSelected]}
                            onPress={() => setMode(m)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
                                {t(m === 'bite' ? 'quick_mode_bite' : 'quick_mode_discover')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {mode === 'bite' ? (
                    <View style={styles.card}>
                        <QuestStrip />
                        <Text style={styles.cardTitle}>{t('How much time do you have?')}</Text>
                        <DurationRows
                            value={minutes}
                            onChange={(m) => {
                                setMinutes(m);
                                logEvent('quick_session_duration_selected', { minutes: m, mode: 'bite' });
                            }}
                        />
                        {bite ? (
                            <View style={styles.biteWrap}>
                                <Text style={styles.biteLabel}>{t('quick_bite_title')}</Text>
                                <Text style={styles.biteSkill}>{bite.skill.name}</Text>
                                <Text style={styles.biteMeta}>
                                    {bite.skill.score}% · {bite.program.title}
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.biteWrap}>
                                <Text style={styles.biteMeta}>{t('quick_bite_empty')}</Text>
                            </View>
                        )}
                        <View style={styles.startWrap}>
                            <Button
                                title={t('Start')}
                                onPress={handleStartBite}
                                disabled={!bite}
                                size="small"
                            />
                        </View>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>{t('How much time do you have?')}</Text>
                        <DurationRows
                            value={minutes}
                            onChange={(m) => {
                                setMinutes(m);
                                logEvent('quick_session_duration_selected', { minutes: m, mode: 'discovery' });
                            }}
                        />
                        <View style={styles.topicsWrap}>
                            {DISCOVERY_TOPICS.map((topic) => (
                                <SelectRow
                                    key={topic.id}
                                    label={language === 'ru' ? topic.titleRu : topic.title}
                                    selected={discoveryId === topic.id}
                                    onPress={() => setDiscoveryId((prev) => (prev === topic.id ? null : topic.id))}
                                />
                            ))}
                        </View>
                        <View style={styles.startWrap}>
                            <Button
                                title={t('Start')}
                                onPress={handleStartDiscovery}
                                disabled={!discoveryId}
                                size="small"
                            />
                        </View>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

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
            fontSize: scale(20),
            lineHeight: scale(26),
            color: colors.text,
        },
        modeRow: {
            flexDirection: 'row',
            paddingHorizontal: scale(16),
            gap: scale(12),
            marginBottom: scale(16),
        },
        modeBtn: {
            flex: 1,
            height: scale(48),
            borderRadius: scale(50),
            backgroundColor: colors.surfaceLight,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: scale(12),
        },
        modeBtnSelected: {
            backgroundColor: colors.buttonPrimary,
        },
        modeText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(15),
            color: colors.textSecondary,
            textAlign: 'center',
        },
        modeTextSelected: {
            color: '#FFF',
        },
        scroll: {
            flex: 1,
        },
        content: {
            paddingHorizontal: scale(16),
            paddingBottom: scale(32),
        },
        card: {
            backgroundColor: colors.white || '#FFFFFF',
            borderRadius: scale(25),
            paddingHorizontal: scale(20),
            paddingVertical: scale(20),
        },
        cardTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            lineHeight: scale(24),
            color: colors.home?.darkText || '#1E1E2E',
            marginBottom: scale(12),
        },
        biteWrap: {
            marginTop: scale(16),
            backgroundColor: colors.hobbySelection?.selectedBorderBg || colors.surfaceLight,
            borderRadius: scale(20),
            paddingHorizontal: scale(20),
            paddingVertical: scale(16),
        },
        biteLabel: {
            fontFamily: fonts.body.medium,
            fontSize: scale(13),
            color: colors.textSecondary,
            marginBottom: scale(4),
        },
        biteSkill: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            lineHeight: scale(24),
            color: colors.home?.darkText || '#1E1E2E',
        },
        biteMeta: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(14),
            color: colors.sessionTimer?.primary || '#37A0EF',
            marginTop: scale(4),
        },
        topicsWrap: {
            gap: scale(12),
            marginTop: scale(16),
        },
        startWrap: {
            marginTop: scale(20),
        },
    });
