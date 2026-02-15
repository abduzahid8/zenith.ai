import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
    Image,
} from 'react-native';
import { scale, SCREEN_WIDTH } from '../../constants';
import { colors, fonts } from '../../theme';

interface WeeklyPlanTabProps {
    isPremium: boolean;
}

const WeeklyPlanTab: React.FC<WeeklyPlanTabProps> = ({ isPremium }) => {
    const [visibleTaskCount, setVisibleTaskCount] = useState(2);

    return (
        <View style={styles.yourDayPage}>
            <Text style={styles.yourDayTitle}>Твой день</Text>

            {/* Task Card 1: Theory */}
            <TouchableOpacity style={styles.theoryCard} activeOpacity={0.8}>
                <View style={styles.taskCardContent}>
                    <View style={styles.taskCardTextContainer}>
                        <Text style={styles.taskCardTitle}>Теория</Text>
                        <Text style={styles.taskCardDescription}>Изучить{"\n"}Королевский Гамбит</Text>
                    </View>
                    <View style={[styles.theoryIconContainer, { backgroundColor: 'transparent' }]}>
                        <Image source={require('../../../icons/book.png')} style={{ width: scale(24), height: scale(24), tintColor: '#000' }} resizeMode="contain" />
                    </View>
                </View>
            </TouchableOpacity>

            {/* Task Card 2: Practice */}
            <TouchableOpacity style={styles.practiceCard} activeOpacity={0.8}>
                <View style={styles.taskCardContent}>
                    <View style={styles.taskCardTextContainer}>
                        <Text style={styles.taskCardTitle}>Практика</Text>
                        <Text style={styles.taskCardDescription}>Сыграть 2 партии</Text>
                    </View>
                    <View style={[styles.practiceIconContainer, { backgroundColor: 'transparent' }]}>
                        <Image source={require('../../../icons/dumbbell.png')} style={{ width: scale(24), height: scale(24), tintColor: '#000' }} resizeMode="contain" />
                    </View>
                </View>
            </TouchableOpacity>

            {/* Task Card 3: Analysis */}
            {visibleTaskCount >= 3 && (
                <View style={styles.analysisCard}>
                    <View style={styles.taskCardContent}>
                        <View style={styles.taskCardTextContainer}>
                            <Text style={styles.analysisTitle}>Анализ</Text>
                            <Text style={styles.analysisDescription}>Рассмотреть партию</Text>
                        </View>
                        <View style={[styles.analysisIconContainer, { backgroundColor: 'transparent' }]}>
                            <Image source={require('../../../icons/magnifier.png')} style={{ width: scale(24), height: scale(24), tintColor: '#000' }} resizeMode="contain" />
                        </View>
                    </View>
                </View>
            )}

            {/* Task Card 4: Tasks */}
            {visibleTaskCount >= 4 && (
                <View style={styles.tasksCard}>
                    <View style={styles.taskCardContent}>
                        <View style={styles.taskCardTextContainer}>
                            <Text style={styles.tasksTitle}>Задачи</Text>
                            <Text style={styles.tasksDescription}>Решить 15 тактических{"\n"}задач</Text>
                        </View>
                        <View style={[styles.tasksIconContainer, { backgroundColor: 'transparent' }]}>
                            <Image source={require('../../../icons/puzzle.png')} style={{ width: scale(28), height: scale(28), tintColor: '#000' }} resizeMode="contain" />
                        </View>
                    </View>
                </View>
            )}

            {/* Add Task button */}
            {visibleTaskCount < 4 && (
                <TouchableOpacity
                    style={[
                        styles.addTaskCard,
                        visibleTaskCount === 2 && { height: scale(179) }
                    ]}
                    activeOpacity={0.8}
                    onPress={() => setVisibleTaskCount(prev => prev + 1)}
                >
                    <Image source={require('../../../icons/plus.png')} style={{ width: scale(32), height: scale(32), tintColor: colors.iconMuted }} resizeMode="contain" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    yourDayPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: scale(20),
    },
    yourDayTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(32),
        lineHeight: scale(34),
        color: colors.sessionTimer.text,
        marginBottom: scale(80),
        paddingHorizontal: scale(0),
    },
    theoryCard: {
        height: scale(119),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.theoryBg,
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    practiceCard: {
        height: scale(100),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.practiceBg,
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.analysisBg,
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(26),
        color: colors.black,
        marginBottom: scale(6),
    },
    analysisDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(19),
        lineHeight: scale(22),
        color: colors.black,
        alignSelf: 'stretch',
    },
    analysisIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: colors.weeklyPlan.iconBg,
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    tasksCard: {
        height: scale(123),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.tasksBg,
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    tasksTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(26),
        color: colors.black,
        marginBottom: scale(6),
    },
    tasksDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(20),
        lineHeight: scale(22),
        color: colors.sessionTimer.text,
        width: scale(322),
    },
    tasksIconContainer: {
        width: scale(40),
        height: scale(100),
        backgroundColor: colors.weeklyPlan.iconBg,
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    taskCardContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    taskCardTextContainer: {
        flex: 1,
    },
    taskCardTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(26),
        color: colors.text,
        marginBottom: scale(6),
        paddingHorizontal: scale(0),
    },
    taskCardDescription: {
        fontFamily: fonts.body.light,
        fontSize: scale(19),
        lineHeight: scale(23),
        color: colors.text,
    },
    theoryIconContainer: {
        width: scale(42),
        height: scale(42),
        backgroundColor: colors.weeklyPlan.iconBg,
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    practiceIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: colors.weeklyPlan.iconBg,
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: colors.weeklyPlan.addTaskBg,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
    },
});

export default WeeklyPlanTab;
