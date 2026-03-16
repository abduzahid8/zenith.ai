import React, { useMemo } from 'react';
import {
    View,
    ScrollView,
    Text,
    StyleSheet,
    TouchableOpacity,
    Animated,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

const booksImage = require('../../../assets/images/home-books.png');
const targetImage = require('../../../assets/images/home-target.png');
const lightbulbImage = require('../../../assets/images/home-lightbulb.png');
const chartImage = require('../../../assets/images/home-chart.png');

interface HomeTabProps {
    fadeAnim: Animated.Value;
    iconTranslateY: Animated.AnimatedInterpolation<number>;
    /** When inside MainTabsScreen, use these to switch tabs instead of pushing routes */
    onDailyGoal?: () => void;
    onAICoach?: () => void;
    onScreenTime?: () => void;
}

const HomeTab: React.FC<HomeTabProps> = ({
    fadeAnim,
    iconTranslateY,
    onDailyGoal,
    onAICoach,
    onScreenTime,
}) => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleNavigate = (route: string) => {
        router.push(route as any);
    };

    return (
        <ScrollView
            style={styles.homeContent}
            contentContainerStyle={{ paddingBottom: scale(100), flexGrow: 1, justifyContent: 'flex-end' }}
            showsVerticalScrollIndicator={false}
        >
            <TouchableOpacity
                onPress={() => handleNavigate('/session-timer')}
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
                    <Text style={styles.cardTitle}>Начать{'\n'}занятие</Text>
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
                onPress={() => (onDailyGoal ? onDailyGoal() : handleNavigate('/weekly-plan'))}
            >
                <LinearGradient
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    colors={['#76B9FF', '#D2E8FF']}
                    locations={[0.0125, 1.0]}
                    style={styles.dailyGoalButton}
                >
                    <Text style={styles.cardTitle}>Цель дня</Text>
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
                    onPress={() => (onAICoach ? onAICoach() : handleNavigate('/ai-coach'))}
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
                            <Text style={styles.smallCardTitle}>Личный{'\n'}наставник</Text>
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
                    onPress={() =>
                        onScreenTime ? onScreenTime() : handleNavigate('/(app)/screen-time')
                    }
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
                            <Text style={styles.smallCardTitle}>Экранное{'\n'}время</Text>
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
});

export default HomeTab;
