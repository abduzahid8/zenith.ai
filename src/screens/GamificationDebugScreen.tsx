/**
 * GamificationDebugScreen.tsx
 * Временный экран для ручного тестирования системы геймификации.
 * Показывает состояние стора в реальном времени и позволяет
 * нажимать кнопки для проверки всей логики.
 * УДАЛИТЬ перед production-релизом.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useGamificationStore, BADGE_DEFINITIONS, getDailyProgress } from '../store/gamificationStore';
import { getLessonByDay, LESSON_BANK, HOBBY_META, HobbyId } from '../data/lessonContent';
import { useUserProfileStore } from '../store/userProfileStore';

const HOBBIES: HobbyId[] = ['english', 'chinese', 'chess', 'coding', 'python', 'reading'];

export const GamificationDebugScreen: React.FC = () => {
    const router = useRouter();
    const store = useGamificationStore();
    const profile = useUserProfileStore();
    const [selectedHobby, setSelectedHobby] = useState<HobbyId>('english');
    const [log, setLog] = useState<string[]>(['🟢 Debug экран запущен']);

    const addLog = (msg: string) => {
        setLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 19)]);
    };

    // ── Действия ─────────────────────────────────────────────

    const handleStartSession = () => {
        store.startSession(selectedHobby);
        addLog(`▶️ startSession("${selectedHobby}")`);
    };

    const handleMarkLearn = () => {
        store.markStepComplete('learn');
        addLog('✅ markStepComplete("learn")');
    };

    const handleMarkDo = () => {
        store.markStepComplete('do');
        addLog('✅ markStepComplete("do")');
    };

    const handleSaveArtifact = () => {
        store.saveArtifact({
            hobbyId: selectedHobby,
            lessonId: `${selectedHobby}_d${store.currentDay[selectedHobby]}`,
            taskType: 'do',
            userInput: 'Тестовый ответ пользователя',
            aiFeedback: '🎉 Отлично! Всё верно.',
        });
        addLog(`💾 saveArtifact для "${selectedHobby}"`);
    };

    const handleAdvanceDay = () => {
        store.advanceDay(selectedHobby);
        addLog(`📅 advanceDay("${selectedHobby}") → день ${store.currentDay[selectedHobby] + 1}`);
    };

    const handleUpdateStreak = () => {
        store.updateStreak();
        addLog(`🔥 updateStreak() → streak = ${store.currentStreak}`);
    };

    const handleSimulateFreeze = () => {
        // Симулируем пропуск 2 дней
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        useGamificationStore.setState({
            lastActiveDate: twoDaysAgo.toISOString().split('T')[0],
            weeklyFreezeUsed: false,
        } as any);
        store.updateStreak();
        addLog('❄️ Симуляция заморозки: пропуск 2 дней');
    };

    const handleRecordCodeRun = () => {
        store.recordCodeRun();
        addLog('🐍 recordCodeRun() — запуск Python');
    };

    const handleRecordChessSolve = () => {
        store.recordChessSolve();
        addLog('♟ recordChessSolve() — задача решена');
    };

    const handleShowBadge = () => {
        store.checkAndUnlockBadges();
        addLog('🏅 checkAndUnlockBadges() выполнен');
    };

    const handleDismissBadge = () => {
        store.dismissBadge();
        addLog('❌ dismissBadge()');
    };

    const handleReset = () => {
        Alert.alert('Сброс', 'Сбросить всё состояние геймификации?', [
            { text: 'Отмена', style: 'cancel' },
            {
                text: 'Сбросить',
                style: 'destructive',
                onPress: () => {
                    store.resetGamification();
                    addLog('🔄 ПОЛНЫЙ СБРОС');
                },
            },
        ]);
    };

    const handleShowLesson = () => {
        const lesson = getLessonByDay(selectedHobby, store.currentDay[selectedHobby]);
        if (lesson) {
            Alert.alert(
                `📖 ${lesson.learn.title}`,
                `Тип задания: ${lesson.do?.type ?? '—'}\n\nЗадание: ${(lesson.do?.prompt ?? '—').slice(0, 120)}...`,
                [{ text: 'OK' }]
            );
            addLog(`📖 Показан урок: ${lesson.id}`);
        } else {
            Alert.alert('AI-урок', `День ${store.currentDay[selectedHobby]} > 7. Нужна AI-генерация.`);
            addLog(`🤖 День ${store.currentDay[selectedHobby]} — нужен AI-генератор`);
        }
    };

    const handleSetStreak = (days: number) => {
        useGamificationStore.setState({ currentStreak: days } as any);
        store.checkAndUnlockBadges();
        addLog(`🔥 Streak вручную установлен: ${days}`);
    };

    // ── Данные для отображения ───────────────────────────────

    const { dailyChecklist, currentStreak, currentDay, artifacts,
        unlockedBadges, pendingBadge, weeklyFreezeUsed, freezeActivatedToday,
        lastActiveDate, codeRunCount, chessTaskSolved } = store;

    const progress = getDailyProgress(dailyChecklist, false);
    const currentLesson = getLessonByDay(selectedHobby, currentDay[selectedHobby]);

    return (
        <SafeAreaView style={s.container}>
            {/* Шапка */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Text style={s.backText}>← Назад</Text>
                </TouchableOpacity>
                <Text style={s.title}>🛠 Debug: Геймификация</Text>
                <TouchableOpacity onPress={handleReset} style={s.resetBtn}>
                    <Text style={s.resetText}>Сброс</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

                {/* ─── Состояние стора ─────────────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>📊 Текущее состояние</Text>

                    <View style={s.row}>
                        <Text style={s.label}>🔥 Streak:</Text>
                        <Text style={s.value}>{currentStreak} дней</Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>📅 Последний вход:</Text>
                        <Text style={s.value}>{lastActiveDate ?? 'никогда'}</Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>❄️ Заморозка:</Text>
                        <Text style={[s.value, weeklyFreezeUsed ? s.warn : s.good]}>
                            {weeklyFreezeUsed ? 'использована' : 'доступна'}{freezeActivatedToday ? ' (сегодня!)' : ''}
                        </Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>💾 Артефактов:</Text>
                        <Text style={s.value}>{artifacts.length}</Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>🏅 Бейджей:</Text>
                        <Text style={s.value}>{unlockedBadges.length} / {Object.keys(BADGE_DEFINITIONS).length}</Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>🐍 Запусков кода:</Text>
                        <Text style={s.value}>{codeRunCount}</Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>♟ Шахматы решены:</Text>
                        <Text style={[s.value, chessTaskSolved ? s.good : s.warn]}>
                            {chessTaskSolved ? 'да' : 'нет'}
                        </Text>
                    </View>
                    <View style={s.row}>
                        <Text style={s.label}>⭐ Premium:</Text>
                        <Text style={[s.value, profile.isPremium ? s.good : s.warn]}>
                            {profile.isPremium ? 'да' : 'нет'} ({profile.subscriptionLevel})
                        </Text>
                    </View>

                    {pendingBadge && (
                        <View style={s.badgeAlert}>
                            <Text style={s.badgeAlertText}>
                                🎉 Новый бейдж: {BADGE_DEFINITIONS[pendingBadge]?.emoji} {BADGE_DEFINITIONS[pendingBadge]?.title}
                            </Text>
                            <TouchableOpacity onPress={handleDismissBadge} style={s.dismissBtn}>
                                <Text style={s.dismissText}>Закрыть</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ─── Чеклист дня ─────────────────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>✅ Чеклист дня ({progress}% выполнено)</Text>
                    <View style={s.progressBar}>
                        <View style={[s.progressFill, { width: `${progress}%` as any }]} />
                    </View>
                    <View style={s.checkRow}>
                        {['learn', 'do', 'deepen1', 'deepen2'].map(step => (
                            <View key={step} style={s.checkItem}>
                                <Text style={s.checkEmoji}>
                                    {(dailyChecklist as any)[step] ? '✅' : '⬜'}
                                </Text>
                                <Text style={s.checkLabel}>{step}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ─── Текущие дни по хобби ────────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>📅 Текущий день по хобби</Text>
                    <View style={s.hobbyGrid}>
                        {HOBBIES.map(h => {
                            const meta = HOBBY_META[h];
                            const hasLesson = !!getLessonByDay(h, currentDay[h]);
                            return (
                                <TouchableOpacity
                                    key={h}
                                    style={[s.hobbyChip, selectedHobby === h && s.hobbyChipSelected]}
                                    onPress={() => setSelectedHobby(h)}
                                >
                                    <Text style={s.hobbyEmoji}>{meta.emoji}</Text>
                                    <Text style={s.hobbyLabel}>{meta.label}</Text>
                                    <Text style={s.hobbyDay}>
                                        День {currentDay[h]}{!hasLesson ? ' 🤖' : ''}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <Text style={s.hint}>Нажми на хобби для выбора (🤖 = нужен AI)</Text>
                </View>

                {/* ─── Текущий урок ────────────────────────────── */}
                {currentLesson && (
                    <View style={s.card}>
                        <Text style={s.cardTitle}>📖 Текущий урок: {currentLesson.learn.title}</Text>
                        <Text style={s.lessonBody} numberOfLines={3}>{currentLesson.learn.body}</Text>
                        <View style={s.lessonMeta}>
                            <Text style={s.tag}>📚 {currentLesson.id}</Text>
                            <Text style={s.tag}>🎯 {currentLesson.do?.type ?? '—'}</Text>
                        </View>
                        <Text style={s.taskPrompt} numberOfLines={2}>
                            Задание: {currentLesson.do?.prompt ?? '—'}
                        </Text>
                        {currentLesson.do?.hints && (
                            <Text style={s.hint}>💡 {currentLesson.do.hints[0]}</Text>
                        )}
                    </View>
                )}

                {/* ─── Кнопки действий ─────────────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>🎮 Действия (тапай и смотри лог)</Text>

                    <Text style={s.sectionLabel}>— Сессия —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.btn} onPress={handleStartSession}>
                            <Text style={s.btnText}>▶️ Начать сессию</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btn} onPress={handleShowLesson}>
                            <Text style={s.btnText}>📖 Показать урок</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.sectionLabel}>— Чеклист —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={handleMarkLearn}>
                            <Text style={s.btnText}>✅ Узнай</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnGreen]} onPress={handleMarkDo}>
                            <Text style={s.btnText}>✅ Сделай</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.sectionLabel}>— Прогресс —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.btn} onPress={handleSaveArtifact}>
                            <Text style={s.btnText}>💾 Сохранить работу</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btn} onPress={handleAdvanceDay}>
                            <Text style={s.btnText}>📅 Следующий день</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.sectionLabel}>— Streak —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.btn} onPress={handleUpdateStreak}>
                            <Text style={s.btnText}>🔥 +1 день</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnBlue]} onPress={handleSimulateFreeze}>
                            <Text style={s.btnText}>❄️ Тест заморозки</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.sectionLabel}>— Premium —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity
                            style={[s.btn, profile.isPremium ? s.btnGreen : s.btn]}
                            onPress={() => {
                                profile.setPremium(!profile.isPremium);
                                addLog(`⭐ Premium: ${!profile.isPremium ? 'включён' : 'выключен'}`);
                            }}
                        >
                            <Text style={s.btnText}>
                                {profile.isPremium ? '⭐ Premium ✓' : '⭐ Дать Premium'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={s.sectionLabel}>— Бейджи —</Text>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.btn} onPress={handleRecordCodeRun}>
                            <Text style={s.btnText}>🐍 Запустить Python</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.btn} onPress={handleRecordChessSolve}>
                            <Text style={s.btnText}>♟ Решить задачу</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={s.btnRow}>
                        <TouchableOpacity style={[s.btn, s.btnPurple]} onPress={() => handleSetStreak(3)}>
                            <Text style={s.btnText}>🔥 streak=3</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnPurple]} onPress={() => handleSetStreak(7)}>
                            <Text style={s.btnText}>🔥 streak=7</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.btn, s.btnPurple]} onPress={() => handleSetStreak(30)}>
                            <Text style={s.btnText}>🏆 streak=30</Text>
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={[s.btn, s.btnWide]} onPress={handleShowBadge}>
                        <Text style={s.btnText}>🏅 Проверить бейджи</Text>
                    </TouchableOpacity>
                </View>

                {/* ─── Разблокированные бейджи ─────────────────── */}
                {unlockedBadges.length > 0 && (
                    <View style={s.card}>
                        <Text style={s.cardTitle}>🏅 Разблокированные бейджи ({unlockedBadges.length})</Text>
                        {unlockedBadges.map(badge => (
                            <View key={badge.id} style={s.badgeRow}>
                                <Text style={s.badgeEmoji}>{badge.emoji}</Text>
                                <View>
                                    <Text style={s.badgeTitle}>{badge.title}</Text>
                                    <Text style={s.badgeDesc}>{BADGE_DEFINITIONS[badge.id]?.description}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* ─── Последние артефакты ─────────────────────── */}
                {artifacts.length > 0 && (
                    <View style={s.card}>
                        <Text style={s.cardTitle}>💾 Последние артефакты ({artifacts.length})</Text>
                        {artifacts.slice(0, 3).map(a => (
                            <View key={a.id} style={s.artifactRow}>
                                <Text style={s.artifactHobby}>{HOBBY_META[a.hobbyId]?.emoji} {a.hobbyId} / {a.lessonId}</Text>
                                <Text style={s.artifactInput} numberOfLines={1}>📝 {a.userInput}</Text>
                                <Text style={s.artifactFeedback} numberOfLines={1}>🤖 {a.aiFeedback}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ─── Лог событий ─────────────────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>📋 Лог событий</Text>
                    {log.map((entry, i) => (
                        <Text key={i} style={[s.logEntry, i === 0 && s.logEntryNew]}>{entry}</Text>
                    ))}
                </View>

                {/* ─── Проверка банка уроков ───────────────────── */}
                <View style={s.card}>
                    <Text style={s.cardTitle}>📚 Статус банка уроков</Text>
                    {HOBBIES.map(h => {
                        const meta = HOBBY_META[h];
                        const count = LESSON_BANK[h].length;
                        return (
                            <View key={h} style={s.row}>
                                <Text style={s.label}>{meta.emoji} {meta.label}:</Text>
                                <Text style={s.value}>{count} уроков ✅</Text>
                            </View>
                        );
                    })}
                    <Text style={[s.hint, { marginTop: 8 }]}>
                        Итого: {HOBBIES.reduce((sum, h) => sum + LESSON_BANK[h].length, 0)} статических уроков
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// ─────────────────────────────────────────────
// Стили
// ─────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F0F1A' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A2A40',
    },
    backBtn: { padding: 8 },
    backText: { color: '#7C7CFF', fontSize: 14, fontWeight: '600' },
    title: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    resetBtn: { backgroundColor: '#FF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    resetText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
    scroll: { flex: 1, padding: 12 },

    card: {
        backgroundColor: '#1A1A2E', borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: '#2A2A40',
    },
    cardTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 12 },

    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    label: { color: '#9999BB', fontSize: 13 },
    value: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    good: { color: '#4CAF50' },
    warn: { color: '#FF9800' },

    progressBar: {
        height: 8, backgroundColor: '#2A2A40', borderRadius: 4, marginBottom: 12, overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: '#7C7CFF', borderRadius: 4 },

    checkRow: { flexDirection: 'row', justifyContent: 'space-around' },
    checkItem: { alignItems: 'center' },
    checkEmoji: { fontSize: 22 },
    checkLabel: { color: '#9999BB', fontSize: 10, marginTop: 2 },

    hobbyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hobbyChip: {
        backgroundColor: '#2A2A40', borderRadius: 12, padding: 10,
        alignItems: 'center', minWidth: '45%', flex: 1,
        borderWidth: 2, borderColor: 'transparent',
    },
    hobbyChipSelected: { borderColor: '#7C7CFF', backgroundColor: '#2A2A5A' },
    hobbyEmoji: { fontSize: 20, marginBottom: 2 },
    hobbyLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
    hobbyDay: { color: '#7C7CFF', fontSize: 11, marginTop: 2 },
    hint: { color: '#666688', fontSize: 11, marginTop: 6 },

    lessonBody: { color: '#CCCCEE', fontSize: 12, lineHeight: 18, marginBottom: 8 },
    lessonMeta: { flexDirection: 'row', gap: 8, marginBottom: 6 },
    tag: {
        backgroundColor: '#2A2A5A', color: '#9999FF', fontSize: 11,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    },
    taskPrompt: { color: '#AAAACC', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },

    sectionLabel: { color: '#666688', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 4, textTransform: 'uppercase' },
    btnRow: { flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
    btn: {
        backgroundColor: '#2A2A50', paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 10, borderWidth: 1, borderColor: '#3A3A60', flex: 1,
    },
    btnGreen: { backgroundColor: '#1A3A2A', borderColor: '#2A6040' },
    btnBlue:  { backgroundColor: '#1A2A4A', borderColor: '#2A4080' },
    btnPurple:{ backgroundColor: '#2A1A4A', borderColor: '#5A30A0' },
    btnWide: { flex: 0, marginTop: 4 },
    btnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', textAlign: 'center' },

    badgeAlert: {
        backgroundColor: '#2A2A10', borderRadius: 10, padding: 10,
        borderWidth: 1, borderColor: '#FFD700', marginTop: 8,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    badgeAlertText: { color: '#FFD700', fontSize: 13, fontWeight: '600', flex: 1 },
    dismissBtn: { backgroundColor: '#3A3A10', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    dismissText: { color: '#FFD700', fontSize: 11 },

    badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    badgeEmoji: { fontSize: 24, marginRight: 10 },
    badgeTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
    badgeDesc: { color: '#9999BB', fontSize: 11 },

    artifactRow: {
        backgroundColor: '#252535', borderRadius: 10, padding: 10,
        marginBottom: 8, borderWidth: 1, borderColor: '#3A3A50',
    },
    artifactHobby: { color: '#7C7CFF', fontSize: 12, fontWeight: '600', marginBottom: 2 },
    artifactInput: { color: '#CCCCEE', fontSize: 12, marginBottom: 2 },
    artifactFeedback: { color: '#88CC88', fontSize: 11 },

    logEntry: { color: '#888899', fontSize: 11, lineHeight: 18, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
    logEntryNew: { color: '#AAFFAA' },
});
