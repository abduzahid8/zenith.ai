import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';

interface AppUsage {
    name: string;
    icon: string;
    changePercent: number;
}

const mockAppUsage: AppUsage[] = [
    { name: 'Instagram', icon: 'logo-instagram', changePercent: -21 },
    { name: 'Chess.com', icon: 'game-controller', changePercent: 34 },
    { name: 'Telegram', icon: 'paper-plane', changePercent: -10 },
];

export const ScreenTimeScreen: React.FC = () => {
    const router = useRouter();
    const [totalChange] = useState(-24);
    const [period] = useState('неделю');

    const handleBack = () => {
        router.back();
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Экранное время</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Total change card */}
                <View style={styles.totalCard}>
                    <Text
                        style={[
                            styles.totalChange,
                            { color: totalChange < 0 ? colors.success : colors.error },
                        ]}
                    >
                        {totalChange > 0 ? '+' : ''}{totalChange}%
                    </Text>
                    <Text style={styles.totalPeriod}>
                        за последнюю{'\n'}{period}
                    </Text>
                </View>

                {/* Explanation */}
                <Text style={styles.explanation}>
                    Ты проводишь меньше времени в приложениях, отвлекающих от развития. Продолжай в том же духе! 🎯
                </Text>

                {/* App breakdown */}
                <Text style={styles.sectionTitle}>По приложениям</Text>

                {mockAppUsage.map((app, index) => (
                    <View key={index} style={styles.appRow}>
                        <View style={styles.appInfo}>
                            <View style={styles.appIconContainer}>
                                <Ionicons
                                    name={app.icon as keyof typeof Ionicons.glyphMap}
                                    size={24}
                                    color={colors.text}
                                />
                            </View>
                            <Text style={styles.appName}>{app.name}</Text>
                        </View>
                        <Text
                            style={[
                                styles.appChange,
                                { color: app.changePercent < 0 ? colors.success : colors.error },
                            ]}
                        >
                            {app.changePercent > 0 ? '+' : ''}{app.changePercent}%
                        </Text>
                    </View>
                ))}

                {/* Info note */}
                <View style={styles.infoNote}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                    <Text style={styles.infoText}>
                        Данные обновляются автоматически на основе использования устройства
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.md),
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceLight,
    },
    backButton: {
        padding: scaleWidth(8),
    },
    headerTitle: {
        fontFamily: typography.h3.fontFamily,
        fontSize: scaleFont(18),
        color: colors.text,
    },
    placeholder: {
        width: scaleWidth(40),
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.lg),
    },
    totalCard: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        padding: scaleWidth(spacing.xl),
        alignItems: 'center',
        marginBottom: scaleHeight(spacing.lg),
    },
    totalChange: {
        fontFamily: typography.h1.fontFamily,
        fontSize: scaleFont(56),
        marginBottom: scaleHeight(spacing.sm),
    },
    totalPeriod: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.textSecondary,
        textAlign: 'center',
    },
    explanation: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.text,
        lineHeight: scaleHeight(24),
        marginBottom: scaleHeight(spacing.xl),
    },
    sectionTitle: {
        fontFamily: typography.h3.fontFamily,
        fontSize: scaleFont(18),
        color: colors.text,
        marginBottom: scaleHeight(spacing.md),
    },
    appRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        padding: scaleWidth(spacing.md),
        marginBottom: scaleHeight(spacing.sm),
    },
    appInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    appIconContainer: {
        width: scaleWidth(40),
        height: scaleWidth(40),
        borderRadius: scaleWidth(10),
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scaleWidth(spacing.md),
    },
    appName: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.text,
    },
    appChange: {
        fontFamily: typography.h3.fontFamily,
        fontSize: scaleFont(18),
    },
    infoNote: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: scaleHeight(spacing.xl),
        gap: scaleWidth(8),
    },
    infoText: {
        flex: 1,
        fontFamily: typography.bodySmall.fontFamily,
        fontSize: scaleFont(13),
        color: colors.textSecondary,
        lineHeight: scaleHeight(18),
    },
});

export default ScreenTimeScreen;
