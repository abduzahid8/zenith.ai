import React, { useMemo, useState, useEffect } from 'react';
import {
    View,
    ScrollView,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Image,
    Modal,
    Alert,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { useTaskStore } from '../../store/taskStore';
import { TaskType } from '../../services/supabase/types';
import { useGamificationStore } from '../../store/gamificationStore';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useGoalStore } from '../../store/goalStore';
import { GoalSnapshot } from '../../types/goals';
import GoalProgressBar from '../../components/goal/GoalProgressBar';

const booksImage = require('../../../assets/images/home-books.png');
const targetImage = require('../../../assets/images/home-target.png');
const lightbulbImage = require('../../../assets/images/home-lightbulb.png');
const chartImage = require('../../../assets/images/home-chart.png');

const ENGINE_TYPES: TaskType[] = ['theory', 'practice', 'analysis', 'puzzles'];

interface HomeTabProps {
    fadeAnim: Animated.Value;
    iconTranslateY: Animated.AnimatedInterpolation<number>;
    /** When inside MainTabsScreen, use these to switch tabs instead of pushing routes */
    onDailyGoal?: () => void;
    onAICoach?: () => void;
}

const HomeTab: React.FC<HomeTabProps> = ({
    fadeAnim,
    iconTranslateY,
    onDailyGoal,
    onAICoach,
}) => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const { dailyTasks } = useTaskStore();
    const [showAllDoneModal, setShowAllDoneModal] = useState(false);
    const [goalSnapshot, setGoalSnapshot] = useState<GoalSnapshot | null>(null);
    const insightsLabel = Platform.OS === 'ios' ? t('Время Хобби') : t('Экранное время');

    const { selectedHobby } = useUserProfileStore();
    useEffect(() => {
        if (selectedHobby) {
            const snapshot = useGoalStore.getState().getSnapshot(selectedHobby as any);
            setGoalSnapshot(snapshot);
        }
    }, [selectedHobby]);

    const handleNavigate = (route: string) => {
        console.log('[HomeTab] handleNavigate - route:', route);
        router.push(route as any);
    };

    const handleStartLesson = () => {
        const gamificationStore = useGamificationStore.getState();
        const { isPremium } = useUserProfileStore.getState();
        
        if (!gamificationStore.canStartSession(isPremium)) {
            Alert.alert(
                t('Лимит сессий'),
                isPremium 
                    ? t('Вы выполнили дневной лимит (3 сессии). Возвращайтесь завтра!')
                    : t('Вы выполнили дневной лимит (1 сессия). Перейдите на Premium, чтобы выполнять больше сессий, или возвращайтесь завтра!'),
                [{ text: 'ОК' }]
            );
            return;
        }

        console.log('[HomeTab] handleStartLesson pressed');
        console.log('[HomeTab] dailyTasks total:', dailyTasks.length);
        const engineTasks = dailyTasks.filter(t => ENGINE_TYPES.includes(t.type as TaskType));
        console.log('[HomeTab] engineTasks count:', engineTasks.length);
        console.log('[HomeTab] engineTasks statuses:', engineTasks.map(t => `${t.type}:${t.status}`).join(', '));
        const allCompleted = engineTasks.length > 0 && engineTasks.every(t => t.status === 'completed');
        console.log('[HomeTab] allCompleted:', allCompleted);

        if (allCompleted) {
            console.log('[HomeTab] All tasks completed - showing all-done modal');
            setShowAllDoneModal(true);
        } else {
            console.log('[HomeTab] Not all done - navigating to session-timer');
            handleNavigate('/session-timer');
        }
    };

    return (
        <>
        <Modal
            transparent
            visible={showAllDoneModal}
            animationType="fade"
            statusBarTranslucent
            onRequestClose={() => setShowAllDoneModal(false)}
        >
            <BlurView intensity={40} tint="dark" style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>{t('Все задачи выполнены!')} 🎉</Text>
                    <Text style={styles.modalBody}>
                        {t('Вы выполнили все задачи на сегодня. Отличная работа! Вы можете начать сессию для дополнительной практики.')}
                    </Text>
                    <View style={styles.modalButtons}>
                        <TouchableOpacity
                            style={[styles.modalBtn, { flex: 1 }]}
                            activeOpacity={0.8}
                            onPress={() => {
                                console.log('[HomeTab] All-done modal dismissed');
                                setShowAllDoneModal(false);
                            }}
                        >
                            <Text style={styles.modalBtnText}>{t('Закрыть')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </BlurView>
        </Modal>
        <ScrollView
            style={styles.homeContent}
            contentContainerStyle={{ paddingBottom: scale(100), flexGrow: 1, justifyContent: 'flex-end' }}
            showsVerticalScrollIndicator={false}
        >
            {goalSnapshot && (
                <GoalProgressBar snapshot={goalSnapshot} />
            )}

            <TouchableOpacity
                onPress={handleStartLesson}
                activeOpacity={0.8}
                style={styles.cardShadowProp}
            >
                <LinearGradient
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    colors={['#BFD8F9', '#CDE3FC', '#DAEEFF']}
                    locations={[0.0258, 0.6253, 1.0]}
                    style={styles.startSessionCard}
                >
                    <Text style={styles.cardTitle}>{t('Начать занятие')}</Text>
                    <Animated.Image
                        source={booksImage}
                        style={[
                            styles.booksImage,
                            {
                                opacity: fadeAnim,
                                transform: [
                                    { translateY: iconTranslateY },
                                    { rotate: '-5.4deg' }
                                ]
                            }
                        ]}
                        resizeMode="contain"
                    />
                </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
                activeOpacity={0.8}
                style={styles.cardShadowProp}
                onPress={() => {
                    console.log('[HomeTab] Daily Goal pressed');
                    onDailyGoal ? onDailyGoal() : handleNavigate('/weekly-plan');
                }}
            >
                <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={['#76B9FF', '#D2E8FF']}
                    locations={[0.0125, 1.0]}
                    style={styles.dailyGoalButton}
                >
                    <Text style={styles.cardTitle}>{t('Цель дня')}</Text>
                    <Animated.Image
                        source={targetImage}
                        style={[
                            styles.targetImage,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: iconTranslateY }]
                            }
                        ]}
                        resizeMode="contain"
                    />
                </LinearGradient>
                        </TouchableOpacity>

            <View style={styles.bottomCardsRow}>
                <TouchableOpacity
                    onPress={() => {
                        console.log('[HomeTab] AI Coach pressed');
                        onAICoach ? onAICoach() : handleNavigate('/ai-coach');
                    }}
                    activeOpacity={0.8}
                    style={[styles.cardShadowProp, { flex: 1.3 }]}
                >
                    <LinearGradient
                        start={{ x: 0.3, y: 0 }}
                        end={{ x: 0.8, y: 1 }}
                        colors={['#8CDEFF', '#D5F3FF']}
                        locations={[0.1155, 0.9307]}
                        style={styles.aiCoachCard}
                    >
                        <View style={{ zIndex: 1 }}>
                            <Text style={styles.smallCardTitle}>{t('Личный наставник')}</Text>
                        </View>
                        <Animated.Image
                            source={lightbulbImage}
                            style={[
                                styles.lightbulbImage,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: iconTranslateY }]
                                }
                            ]}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        console.log('[HomeTab] Screen Time card pressed');
                        handleNavigate('/screen-time');
                    }}
                    activeOpacity={0.8}
                    style={[styles.cardShadowProp, { flex: 1 }]}
                >
                    <LinearGradient
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                        colors={['#D6D7F8', '#E0E2FF']}
                        style={styles.screenTimeCard}
                    >
                        <View style={{ zIndex: 1 }}>
                            <Text style={styles.smallCardTitle}>{insightsLabel}</Text>
                        </View>
                        <Animated.Image
                            source={chartImage}
                            style={[
                                styles.chartImage,
                                {
                                    opacity: fadeAnim,
                                    transform: [{ translateY: iconTranslateY }]
                                }
                            ]}
                            resizeMode="contain"
                        />
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </ScrollView>
        </>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    homeContent: {
        flex: 1,
        paddingHorizontal: scale(16),
    },
    cardShadowProp: {
        marginBottom: scale(24),
    },
    startSessionCard: {
        height: scale(150),
        borderRadius: scale(25),
        paddingHorizontal: scale(25),
        paddingTop: scale(26),
        overflow: 'hidden',
    },
    booksImage: {
        position: 'absolute',
        width: 213,
        height: 188,
        right: scale(-20),
        bottom: scale(-40),
        transform: [{ rotate: '-5.4deg' }],
    },
    cardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#1E1E2E',
        zIndex: 1,
    },
    dailyGoalButton: {
        height: scale(74),
        borderRadius: scale(50),
        paddingHorizontal: scale(25),
        justifyContent: 'center',
        overflow: 'hidden',
    },
    targetImage: {
        position: 'absolute',
        width: scale(233.508),
        height: scale(155.672),
        right: scale(-30),
        top: scale(-15),
    },
    bottomCardsRow: {
        flexDirection: 'row',
        gap: scale(16),
        alignItems: 'flex-start',
    },
    aiCoachCard: {
        height: scale(155),
        borderRadius: scale(25),
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        overflow: 'hidden',
    },
    lightbulbImage: {
        position: 'absolute',
        width: scale(199),
        height: scale(199),
        right: scale(-50),
        bottom: scale(-67),
    },
    screenTimeCard: {
        height: scale(155),
        borderRadius: scale(25),
        paddingHorizontal: scale(17),
        paddingVertical: scale(19),
        overflow: 'hidden',
    },
    chartImage: {
        position: 'absolute',
        width: scale(162),
        height: scale(162),
        right: scale(-20),
        bottom: scale(-40),
    },
    smallCardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(28),
        color: '#1E1E2E',
    },
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(32),
    },
    modalCard: {
        backgroundColor: 'rgba(30, 30, 46, 0.88)',
        borderRadius: scale(20),
        paddingHorizontal: scale(20),
        paddingTop: scale(20),
        paddingBottom: scale(16),
        width: '100%',
    },
    modalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#FFFFFF',
        marginBottom: scale(8),
    },
    modalBody: {
        fontFamily: fonts.body?.regular ?? fonts.heading.bold,
        fontSize: scale(14),
        color: 'rgba(255,255,255,0.75)',
        lineHeight: scale(20),
        marginBottom: scale(20),
    },
    modalButtons: {
        flexDirection: 'row',
        gap: scale(12),
    },
    modalBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: scale(50),
        paddingVertical: scale(12),
        alignItems: 'center',
    },
    modalBtnText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: '#FFFFFF',
    },
});

export default HomeTab;
