import React, { useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Image,
    Easing,
} from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { BlurView } from 'expo-blur';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { useGamificationStore, BADGE_DEFINITIONS } from '../../store/gamificationStore';

interface SessionCompleteStepProps {
    isPremium: boolean;
    streakDays: number;
    onExit: () => void;
}

export const SessionCompleteStep: React.FC<SessionCompleteStepProps> = ({
    isPremium,
    streakDays,
    onExit,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();

    const { dailyChecklist, pendingBadge, dismissBadge } = useGamificationStore();

    // Checkmark scale animation
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const badgeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Start checkmark animation
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // Start badge animation if pending
        if (pendingBadge) {
            Animated.timing(badgeAnim, {
                toValue: 1,
                duration: 800,
                easing: Easing.out(Easing.back(1.5)),
                useNativeDriver: true,
            }).start();
        }
    }, [pendingBadge]);

    const handleDismissBadge = () => {
        dismissBadge();
    };

    const badgeInfo = pendingBadge ? BADGE_DEFINITIONS[pendingBadge] : null;

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                {/* Pulsing checkmark */}
                <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
                    <Text style={styles.checkIcon}>🎉</Text>
                </Animated.View>

                <Text style={styles.congratsTitle}>{t('Все задачи выполнены!')}</Text>
                <Text style={styles.congratsSubtitle}>
                    {t('Вы провели отличную сессию сегодня. Дисциплина — залог успеха!')}
                </Text>

                {/* Day Streak */}
                <View style={styles.streakContainer}>
                    <Text style={styles.streakText}>
                        {streakDays} 🔥 {t('дней подряд')}
                    </Text>
                </View>

                {/* Checklist progress */}
                <View style={styles.checklistCard}>
                    <Text style={styles.checklistTitle}>{t('Чеклист дня:')}</Text>
                    
                    <View style={styles.checklistItem}>
                        <Text style={styles.checkmark}>{dailyChecklist.learn ? '✅' : '⬜'}</Text>
                        <Text style={[styles.checklistLabel, dailyChecklist.learn && styles.completedItem]}>
                            {t('Теория («Узнай»)')}
                        </Text>
                    </View>

                    <View style={styles.checklistItem}>
                        <Text style={styles.checkmark}>{dailyChecklist.do ? '✅' : '⬜'}</Text>
                        <Text style={[styles.checklistLabel, dailyChecklist.do && styles.completedItem]}>
                            {t('Практика («Сделай»)')}
                        </Text>
                    </View>

                    <View style={styles.checklistItem}>
                        <Text style={styles.checkmark}>
                            {isPremium ? (dailyChecklist.deepen1 ? '✅' : '⬜') : '🔒'}
                        </Text>
                        <Text style={[
                            styles.checklistLabel, 
                            !isPremium && styles.lockedLabel,
                            dailyChecklist.deepen1 && styles.completedItem
                        ]}>
                            {t('Углуби 1')} {!isPremium && '(Premium)'}
                        </Text>
                    </View>

                    <View style={styles.checklistItem}>
                        <Text style={styles.checkmark}>
                            {isPremium ? (dailyChecklist.deepen2 ? '✅' : '⬜') : '🔒'}
                        </Text>
                        <Text style={[
                            styles.checklistLabel, 
                            !isPremium && styles.lockedLabel,
                            dailyChecklist.deepen2 && styles.completedItem
                        ]}>
                            {t('Углуби 2')} {!isPremium && '(Premium)'}
                        </Text>
                    </View>
                </View>
            </View>

            <TouchableOpacity style={styles.exitButton} onPress={onExit} activeOpacity={0.8}>
                <Text style={styles.exitButtonText}>{t('Завершить сессию')}</Text>
            </TouchableOpacity>

            {/* Badge Popup Modal */}
            {pendingBadge && badgeInfo && (
                <View style={StyleSheet.absoluteFillObject}>
                    <View style={styles.badgeOverlay}>
                        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject} />
                        <Animated.View style={[
                            styles.badgeCard,
                            {
                                transform: [
                                    { scale: badgeAnim },
                                    {
                                        translateY: badgeAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [scale(200), 0],
                                        })
                                    }
                                ]
                            }
                        ]}>
                            <Text style={styles.badgeEmoji}>{badgeInfo.emoji}</Text>
                            <Text style={styles.badgeTitle}>{t('Новое достижение!')}</Text>
                            <Text style={styles.badgeName}>{badgeInfo.title}</Text>
                            <Text style={styles.badgeDesc}>{badgeInfo.description}</Text>

                            <TouchableOpacity
                                style={styles.badgeButton}
                                onPress={handleDismissBadge}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.badgeButtonText}>{t('Ура! 🎉')}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </View>
            )}
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: scale(24),
        justifyContent: 'space-between',
        paddingBottom: scale(20),
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: scale(40),
    },
    checkCircle: {
        width: scale(100),
        height: scale(100),
        borderRadius: scale(50),
        backgroundColor: 'rgba(255, 87, 34, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(24),
        borderWidth: 2,
        borderColor: '#FF5722',
    },
    checkIcon: {
        fontSize: scale(48),
    },
    congratsTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text || '#1E1E2E',
        marginBottom: scale(8),
        textAlign: 'center',
    },
    congratsSubtitle: {
        fontFamily: fonts.heading.light,
        fontSize: scale(15),
        color: 'rgba(30, 30, 46, 0.7)',
        textAlign: 'center',
        lineHeight: scale(22),
        paddingHorizontal: scale(20),
        marginBottom: scale(24),
    },
    streakContainer: {
        backgroundColor: '#FFF8E1',
        borderColor: '#FFE082',
        borderWidth: 1,
        borderRadius: scale(20),
        paddingHorizontal: scale(20),
        paddingVertical: scale(8),
        marginBottom: scale(24),
    },
    streakText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: '#FF8F00',
    },
    checklistCard: {
        backgroundColor: colors.surfaceLight || 'rgba(255, 255, 255, 0.08)',
        borderRadius: scale(20),
        padding: scale(20),
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    checklistTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text || '#1E1E2E',
        marginBottom: scale(16),
    },
    checklistItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    checkmark: {
        fontSize: scale(18),
        marginRight: scale(12),
        width: scale(24),
        textAlign: 'center',
    },
    checklistLabel: {
        fontFamily: fonts.heading.light,
        fontSize: scale(15),
        color: colors.text || '#1E1E2E',
    },
    completedItem: {
        fontFamily: fonts.heading.bold,
        color: '#FF5722',
        textDecorationLine: 'line-through',
        opacity: 0.8,
    },
    lockedLabel: {
        color: 'rgba(30, 30, 46, 0.4)',
    },
    exitButton: {
        backgroundColor: colors.buttonPrimary || '#1E1E2E',
        borderRadius: scale(30),
        height: scale(56),
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.buttonPrimary || '#1E1E2E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 6,
        marginTop: scale(20),
    },
    exitButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: '#FFFFFF',
    },
    // Badge Overlay popup
    badgeOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(30),
    },
    badgeCard: {
        backgroundColor: '#1E1E2E',
        borderRadius: scale(24),
        padding: scale(24),
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFE082',
        shadowColor: '#FFE082',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 10,
    },
    badgeEmoji: {
        fontSize: scale(72),
        marginBottom: scale(16),
    },
    badgeTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#FFE082',
        textTransform: 'uppercase',
        letterSpacing: 2,
        marginBottom: scale(8),
    },
    badgeName: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: scale(12),
    },
    badgeDesc: {
        fontFamily: fonts.heading.light,
        fontSize: scale(15),
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        lineHeight: scale(22),
        marginBottom: scale(24),
    },
    badgeButton: {
        backgroundColor: '#FFE082',
        borderRadius: scale(20),
        paddingVertical: scale(12),
        paddingHorizontal: scale(40),
        alignItems: 'center',
    },
    badgeButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: '#1E1E2E',
    },
});

export default SessionCompleteStep;
