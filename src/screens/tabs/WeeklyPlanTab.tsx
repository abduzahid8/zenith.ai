import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import { scale, SCREEN_WIDTH } from '../../constants';

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
                    <View style={styles.theoryIconContainer}>
                        <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 19.5C4 18.837 4.26339 18.2011 4.73223 17.7322C5.20107 17.2634 5.83696 17 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M6.5 2H20V22H6.5C5.83696 22 5.20107 21.7366 4.73223 21.2678C4.26339 20.7989 4 20.163 4 19.5V4.5C4 3.83696 4.26339 3.20107 4.73223 2.73223C5.20107 2.26339 5.83696 2 6.5 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
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
                    <View style={styles.practiceIconContainer}>
                        <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                            <Path d="M12 2L14.5 9H9.5L12 2Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M5 22H19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M6 18H18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M8 22V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M16 22V18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M5 14H19L18 18H6L5 14Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M7 14L8 9H16L17 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
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
                        <View style={styles.analysisIconContainer}>
                            <Svg width={scale(24)} height={scale(24)} viewBox="0 0 24 24" fill="none">
                                <Path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <Path d="M21 21L16.65 16.65" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
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
                        <View style={styles.tasksIconContainer}>
                            <Svg width={scale(28)} height={scale(28)} viewBox="0 0 24 24" fill="none">
                                <Path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.611a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.611a2.404 2.404 0 0 1 1.705-.707c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
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
                    <Feather name="plus" size={scale(32)} color="#A0A0A0" />
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    yourDayPage: {
        width: SCREEN_WIDTH,
        flex: 1,
        backgroundColor: '#EAF0F8',
        paddingHorizontal: scale(20),
    },
    yourDayTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(32),
        lineHeight: scale(34),
        color: '#2E2E43',
        marginBottom: scale(80),
        paddingHorizontal: scale(0),
    },
    theoryCard: {
        height: scale(119),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#8CDEFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    practiceCard: {
        height: scale(100),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#78BAFF',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisCard: {
        height: scale(101),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F4C0FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    analysisTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    analysisDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(22),
        color: '#000',
        alignSelf: 'stretch',
    },
    analysisIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    tasksCard: {
        height: scale(123),
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#F9A9FD',
        paddingLeft: scale(28),
        paddingRight: scale(20),
        paddingVertical: scale(18),
        marginBottom: scale(10),
    },
    tasksTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#000',
        marginBottom: scale(6),
    },
    tasksDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(20),
        lineHeight: scale(22),
        color: '#2E2E43',
        width: scale(322),
    },
    tasksIconContainer: {
        width: scale(40),
        height: scale(100),
        backgroundColor: '#08132A',
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
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(26),
        color: '#08132A',
        marginBottom: scale(6),
        paddingHorizontal: scale(0),
    },
    taskCardDescription: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(19),
        lineHeight: scale(23),
        color: '#08132A',
    },
    theoryIconContainer: {
        width: scale(42),
        height: scale(42),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    practiceIconContainer: {
        width: scale(40),
        height: scale(40),
        backgroundColor: '#08132A',
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
    },
    addTaskCard: {
        alignSelf: 'stretch',
        borderRadius: scale(25),
        backgroundColor: '#D3DEEE',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: scale(25),
    },
});

export default WeeklyPlanTab;
