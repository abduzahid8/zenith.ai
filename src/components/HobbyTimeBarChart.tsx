import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

interface DayData {
    day: string;
    value: number; // 0-7 scale
}

interface HobbyTimeBarChartProps {
    data?: DayData[];
}

const defaultData: DayData[] = [
    { day: 'Пн', value: 3 },
    { day: 'Вт', value: 5 },
    { day: 'Ср', value: 3.5 },
    { day: 'Чт', value: 1 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 4.5 },
    { day: 'Вс', value: 2.5 },
];

// Purple/Magenta color palette for hobby time bars
const BAR_COLORS = [
    '#A855F7', // Пн
    '#C76EED', // Вт
    '#8B5CF6', // Ср
    '#6366F1', // Чт
    '#D946EF', // Пт
    '#9333EA', // Сб
    '#E0AAFF', // Вс
] as const;

// Grid image for chart background (same as WeeklyBarChart)
const gridImage = require('../../assets/images/grid_pattern.png');

export const HobbyTimeBarChart: React.FC<HobbyTimeBarChartProps> = ({
    data = defaultData,
}) => {
    const maxValue = 7;
    const yAxisLabels = ['7+', '6', '5', '4', '3', '2', '1'];
    const chartHeight = scale(160);

    return (
        <View style={styles.container}>
            <View style={styles.chartContainer}>
                {/* Grid Background Image */}
                <Image
                    source={gridImage}
                    style={styles.gridImage}
                    resizeMode="cover"
                />

                {/* Chart content wrapper */}
                <View style={styles.chartContent}>
                    {/* Y-axis labels */}
                    <View style={styles.yAxis}>
                        {yAxisLabels.map((label, index) => (
                            <View key={index} style={label === '7+' ? styles.yAxisLabelWideWrapper : styles.yAxisLabelWrapper}>
                                <Text
                                    style={label === '7+' ? styles.yAxisLabelWide : styles.yAxisLabel}
                                >
                                    {label}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Bars area */}
                    <View style={styles.barsArea}>
                        <View style={styles.barsContainer}>
                            {data.map((item, index) => {
                                const barHeight = (item.value / maxValue) * chartHeight;
                                return (
                                    <View key={index} style={styles.barWrapper}>
                                        <View
                                            style={[
                                                styles.bar,
                                                {
                                                    height: barHeight,
                                                    backgroundColor: BAR_COLORS[index % BAR_COLORS.length],
                                                }
                                            ]}
                                        />
                                        <Text style={styles.dayLabel}>{item.day}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: scale(20),
    },
    // Pink/Purple tinted background container
    chartContainer: {
        backgroundColor: '#EFD6F8', // Light purple tint
        borderRadius: scale(30),
        height: scale(258),
        alignSelf: 'center',
        width: scale(362),
        overflow: 'hidden',
        position: 'relative',
    },
    gridImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        borderRadius: scale(30),
    },
    chartContent: {
        flex: 1,
        flexDirection: 'row',
        paddingTop: scale(50),
        paddingLeft: scale(10),
        paddingRight: scale(10),
        paddingBottom: 0,
    },
    yAxis: {
        position: 'absolute',
        left: scale(10),
        top: scale(50),
        bottom: scale(20),
        width: scale(25),
        justifyContent: 'space-between',
    },
    yAxisLabelWrapper: {
        width: scale(10),
        height: scale(15),
        overflow: 'visible',
        justifyContent: 'center',
    },
    yAxisLabelWideWrapper: {
        width: scale(20),
        height: scale(15),
        overflow: 'visible',
        justifyContent: 'center',
    },
    yAxisLabel: {
        fontFamily: fonts.body.light,
        fontSize: scale(14),
        color: colors.statistics.darkText,
        textAlign: 'right',
        lineHeight: scale(22),
        position: 'absolute',
        right: 0,
        width: scale(100),
        height: scale(22),
        top: scale(-3),
    },
    yAxisLabelWide: {
        fontFamily: fonts.body.light,
        fontSize: scale(14),
        color: colors.statistics.darkText,
        textAlign: 'right',
        lineHeight: scale(22),
        position: 'absolute',
        right: 0,
        width: scale(100),
        height: scale(22),
        top: scale(-3),
    },
    barsArea: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    barsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
        gap: scale(10),
        marginLeft: scale(10),
    },
    barWrapper: {
        alignItems: 'center',
        position: 'relative',
    },
    bar: {
        width: scale(35),
        borderTopLeftRadius: scale(8),
        borderTopRightRadius: scale(8),
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        minHeight: scale(8),
    },
    dayLabel: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(10),
        color: colors.statistics.darkText,
        position: 'absolute',
        bottom: scale(5),
    },
});

export default HobbyTimeBarChart;
