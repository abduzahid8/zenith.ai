import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

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
    { day: 'Ср', value: 3 },
    { day: 'Чт', value: 1 },
    { day: 'Пт', value: 2 },
    { day: 'Сб', value: 4 },
    { day: 'Вс', value: 2 },
];

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
    data = defaultData,
    changePercent = -24,
    periodLabel = 'за последнюю\nнеделю',
}) => {
    const maxValue = 7;
    const yAxisLabels = ['7+', '6', '5', '4', '3', '2', '1'];
    const isNegative = changePercent < 0;

    return (
        <View style={styles.container}>
            {/* Main chart container with border */}
            <View style={styles.chartContainer}>
                {/* Stats badge in top right */}
                <View style={styles.statsBadge}>
                    <View style={styles.statsBadgeRow}>
                        <Text style={styles.statsPercent}>
                            {changePercent > 0 ? '+' : ''}{changePercent}%
                        </Text>
                        <Text style={styles.statsArrow}> 📈</Text>
                    </View>
                    <Text style={styles.statsPeriod}>{periodLabel}</Text>
                </View>

                {/* Y-axis - smaller font */}
                <View style={styles.yAxis}>
                    {yAxisLabels.map((label, index) => (
                        <Text key={index} style={styles.yAxisLabel}>{label}</Text>
                    ))}
                </View>

                {/* Chart area with bars */}
                <View style={styles.chartArea}>
                    {/* Grid Lines (Horizontal & Vertical) */}
                    <View style={styles.gridContainer}>
                        {/* Horizontal Lines */}
                        <View style={styles.horizontalLines}>
                            {yAxisLabels.map((_, index) => (
                                <View key={`h-${index}`} style={styles.gridLineRow}>
                                    <View style={styles.gridLine} />
                                </View>
                            ))}
                        </View>
                        {/* Vertical Lines - one for each day + 1 for end */}
                        <View style={styles.verticalLines}>
                            {Array.from({ length: 8 }).map((_, index) => (
                                <View key={`v-${index}`} style={styles.verticalLineColumn}>
                                    <View style={styles.verticalLine} />
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* Bars */}
                    <View style={styles.barsContainer}>
                        {data.map((item, index) => {
                            const heightPercent = Math.min((item.value / maxValue) * 100, 100);
                            return (
                                <View key={index} style={styles.barWrapper}>
                                    <View style={styles.barColumn}>
                                        <View style={{ flex: (100 - heightPercent) / 100 }} />
                                        <View
                                            style={[
                                                styles.bar,
                                                { flex: heightPercent / 100 }
                                            ]}
                                        />
                                    </View>
                                    <Text style={styles.dayLabel}>{item.day}</Text>
                                </View>
                            );
                        })}
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
    chartContainer: {
        backgroundColor: '#E0E0E0', // Figma exact
        borderRadius: scale(30),
        padding: scale(10),
        paddingTop: scale(20),
        paddingLeft: scale(10),
        paddingRight: scale(10),
        flexDirection: 'row',
        height: scale(304), // Figma: 304px
        alignSelf: 'center',
        width: scale(362), // Figma: 362px
        overflow: 'hidden',
    },
    statsBadge: {
        position: 'absolute',
        top: scale(12),
        right: scale(14),
        alignItems: 'flex-end',
    },
    statsBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // Figma: fontSize: 20, fontWeight: 700, color: black
    statsPercent: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        lineHeight: scale(40),
        color: '#000', // Figma: black
    },
    statsArrow: {
        fontSize: scale(16),
    },
    // Figma: fontSize: 14, fontWeight: 300, lineHeight: 13
    statsPeriod: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(14),
        color: '#000',
        textAlign: 'right',
        lineHeight: scale(13),
    },
    yAxis: {
        width: scale(20),
        paddingTop: scale(35),
        paddingBottom: scale(28),
        justifyContent: 'space-between',
    },
    // Figma: font-size: 14px, font-weight: 300, line-height: 22px
    yAxisLabel: {
        fontFamily: 'Gramatika-Light', // Geometria 300 fallback
        fontSize: scale(14),
        color: '#000',
        textAlign: 'right',
        lineHeight: scale(22),
    },
    chartArea: {
        flex: 1,
        position: 'relative',
        marginTop: scale(35),
        marginBottom: scale(6),
        marginLeft: scale(8),
    },
    gridContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: scale(22),
    },
    horizontalLines: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'space-between',
    },
    verticalLines: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    verticalLineColumn: {
        height: '100%',
        alignItems: 'center',
        width: 1, // Minimize width impact
    },
    gridLineRow: {
        width: '100%',
    },
    gridLine: {
        width: '100%',
        height: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.10)', // Figma exact
    },
    verticalLine: {
        width: 1,
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.10)', // Figma exact
    },
    barsContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingBottom: scale(25),
        gap: scale(10), // Figma: gap: 10
        height: '100%',
    },
    barWrapper: {
        alignItems: 'center',
        flex: 1,
        height: '100%',
    },
    barColumn: {
        width: scale(35), // Figma: 35px
        flexDirection: 'column',
        alignItems: 'center',
        height: '100%', // CRITICAL: needed for flex bars to work
    },
    // Figma: border-radius: 8px 8px 0 0, width: 35px
    bar: {
        width: scale(35),
        backgroundColor: '#9C9C9C',
        borderTopLeftRadius: scale(8),
        borderTopRightRadius: scale(8),
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        minHeight: scale(8),
    },
    dayLabel: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(10),
        color: '#666',
        position: 'absolute',
        bottom: scale(-18),
    },
});

export default WeeklyBarChart;
