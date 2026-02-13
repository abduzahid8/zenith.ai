import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

interface DayData {
    day: string;
    value: number; // 0-7 scale
}

interface WeeklyBarChartProps {
    data?: DayData[];
    changePercent?: number;
    periodLabel?: string;
}

const defaultData: DayData[] = [
    { day: 'Пн', value: 3 },
    { day: 'Вт', value: 5 },
    { day: 'Ср', value: 4 },
    { day: 'Чт', value: 1.5 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 5 },
    { day: 'Вс', value: 3 },
];

// Color palette for bars - matching Figma goal design
// Moved outside component to prevent recreation on every render
const BAR_COLORS = [
    '#5ECFCF', // Пн - teal/cyan
    '#37A0EF', // Вт - dark blue
    '#7EC8FF', // Ср - medium/light blue  
    '#37A0EF', // Чт - dark blue
    '#5ECFCF', // Пт - teal/cyan
    '#37A0EF', // Сб - dark blue
    '#7EC8FF', // Вс - medium/light blue
] as const;



// Grid image for chart background
const gridImage = require('../../assets/images/grid_pattern.png');

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
    data = defaultData,
}) => {
    const maxValue = 7;
    const yAxisLabels = ['7+', '6', '5', '4', '3', '2', '1'];
    const chartHeight = scale(160); // Height for actual chart bars area

    return (
        <View style={styles.container}>
            {/* Main chart container - Figma: 362x304, border-radius: 30, background: #D6DEF8 */}
            <View style={styles.chartContainer}>
                {/* Grid Background Image - at container level for 100% coverage */}
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
                        {/* Bars container */}
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
    // Figma: width: 362px, height: 304px, border-radius: 30px, background: #D6DEF8
    chartContainer: {
        backgroundColor: '#D6DEF8',
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
    // Y-axis on the left - absolute positioned
    yAxis: {
        position: 'absolute',
        left: scale(10),
        top: scale(50),
        bottom: scale(20),
        width: scale(25),
        justifyContent: 'space-between',
    },
    // Wrappers to enforce the exact layout position (10px wide)
    yAxisLabelWrapper: {
        width: scale(10),
        height: scale(15),
        overflow: 'visible', // Allow absolute text to go outside
        justifyContent: 'center',
    },
    yAxisLabelWideWrapper: {
        width: scale(20),
        height: scale(15),
        overflow: 'visible',
        justifyContent: 'center',
    },
    // Text anchored to the right - width is large to fit any content
    yAxisLabel: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(14),
        color: '#2E2E43',
        textAlign: 'right',
        lineHeight: scale(22),
        position: 'absolute',
        right: 0, // Anchored to right edge
        width: scale(100), // Much wider than needed
        height: scale(22), // Proper line height
        top: scale(-3), // Slight adjustment for line-height centering if needed, or 0
    },
    // 7+ label - same style
    yAxisLabelWide: {
        fontFamily: 'Geometria-Light',
        fontSize: scale(14),
        color: '#2E2E43',
        textAlign: 'right',
        lineHeight: scale(22),
        position: 'absolute',
        right: 0,
        width: scale(100),
        height: scale(22),
        top: scale(-3),
    },
    // Bars area - takes remaining space, bars at bottom
    barsArea: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    // Bars container with gap
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
    // Figma: width: 35px, border-radius: 8px 8px 0 0, background: #37A0EF
    bar: {
        width: scale(35),
        borderTopLeftRadius: scale(8),
        borderTopRightRadius: scale(8),
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        backgroundColor: '#37A0EF',
        minHeight: scale(8),
    },
    dayLabel: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(10),
        color: '#2E2E43',
        position: 'absolute',
        bottom: scale(5),
    },
});

export default WeeklyBarChart;
