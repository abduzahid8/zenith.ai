import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUserProfileStore } from '../store/userProfileStore';
import { useSubscriptionStore, openManageSubscriptions } from '../store/subscriptionStore';
import { PRODUCT_IDS, IOS_SKUS, ANDROID_SKUS } from '../services/iapService';
import { useAppTheme } from '../theme/useAppTheme';
import { fonts } from '../theme';
import { scale, IS_TABLET, TABLET_SIDE_PADDING } from '../constants';
import { useT } from '../store/languageStore';

// ── Premium features ─────────────────────────────────────

const PREMIUM_FEATURES = [
    { icon: 'chatbubble-ellipses-outline', text: 'Unlimited AI Coach conversations' },
    { icon: 'analytics-outline', text: 'Personalized growth plan' },
    { icon: 'calendar-outline', text: 'Weekly activity plan' },
    { icon: 'bar-chart-outline', text: 'Progress analysis & explanations' },
    { icon: 'stats-chart-outline', text: 'Detailed progress breakdown' },
    { icon: 'document-text-outline', text: 'Weekly AI performance report' },
    { icon: 'phone-portrait-outline', text: 'Advanced screen time insights' },
];

// ── Component ────────────────────────────────────────────

export const ManageSubscriptionScreen: React.FC = () => {
    const router = useRouter();
    const t = useT();
    const { userName, streakDays } = useUserProfileStore();
    const { activeProductId, isRestoring, restore } = useSubscriptionStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const platformAnnualId = Platform.OS === 'ios' ? PRODUCT_IDS.IOS.ANNUAL : PRODUCT_IDS.ANDROID.ANNUAL;
    const isAnnual = activeProductId === platformAnnualId;
    const planName = isAnnual ? 'Annual Plan' : 'Monthly Plan';
    const planBadge = isAnnual ? 'BEST VALUE' : null;

    const handleBack = () => {
        if (router.canGoBack()) {
            router.back();
        } else {
            router.replace('/(app)/' as any);
        }
    };

    const handleManageInAppStore = async () => {
        console.log('[ManageSubscriptionScreen] Opening subscription management');
        try {
            await openManageSubscriptions();
        } catch (err) {
            console.error('[ManageSubscriptionScreen] openManageSubscriptions failed:', err);
        }
    };

    const handleRestore = async () => {
        console.log('[ManageSubscriptionScreen] Restoring purchases');
        await restore();
    };

    const handlePrivacy = () => {
        Linking.openURL('https://zenyth-ai-privacy.vercel.app/').catch((err) =>
            console.error('[ManageSubscriptionScreen] Privacy URL failed:', err)
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    activeOpacity={0.7}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="chevron-back" size={scale(22)} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('Управление подпиской')}</Text>
                <View style={styles.headerRight} />
            </View>

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Premium Hero Card */}
                <View style={styles.heroCard}>
                    <View style={styles.crownRow}>
                        <View style={styles.crownBadge}>
                            <Ionicons name="star" size={scale(20)} color="#FFD700" />
                        </View>
                        <Text style={styles.premiumLabel}>Premium Member</Text>
                    </View>
                    <Text style={styles.greetingText}>
                        {userName ? `Welcome back, ${userName}!` : 'Welcome back!'}
                    </Text>
                    <Text style={styles.heroSubtext}>
                        You have full access to all Zenyth AI features.
                    </Text>

                    {/* Streak badge */}
                    <View style={styles.streakRow}>
                        <Ionicons name="flame" size={scale(16)} color="#FF6B35" />
                        <Text style={styles.streakText}>
                            {streakDays > 0
                                ? `${streakDays}-day streak — keep it going!`
                                : 'Start your streak today!'}
                        </Text>
                    </View>
                </View>

                {/* Active Plan Card */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>{t('Текущий план')}</Text>
                    <View style={styles.planCard}>
                        <View style={styles.planCardLeft}>
                            <View style={styles.planIconCircle}>
                                <Ionicons
                                    name={isAnnual ? 'calendar' : 'refresh-circle'}
                                    size={scale(22)}
                                    color={colors.buttonTextPrimary}
                                />
                            </View>
                            <View style={styles.planInfo}>
                                <Text style={styles.planName}>{planName}</Text>
                                <Text style={styles.planStatus}>Active · Auto-renews</Text>
                            </View>
                        </View>
                        {planBadge && (
                            <View style={styles.bestValueBadge}>
                                <Text style={styles.bestValueText}>{planBadge}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Included Features */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>{t('Что включено')}</Text>
                    <View style={styles.featuresCard}>
                        {PREMIUM_FEATURES.map((feature, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.featureRow,
                                    index < PREMIUM_FEATURES.length - 1 && styles.featureRowBorder,
                                ]}
                            >
                                <View style={styles.featureIconWrap}>
                                    <Ionicons
                                        name={feature.icon as any}
                                        size={scale(16)}
                                        color={colors.buttonPrimary}
                                    />
                                </View>
                                <Text style={styles.featureText}>{feature.text}</Text>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={scale(16)}
                                    color="#4CAF50"
                                />
                            </View>
                        ))}
                    </View>
                </View>

                {/* Manage Actions */}
                <View style={styles.sectionContainer}>
                    <Text style={styles.sectionTitle}>{t('Действия')}</Text>
                    <View style={styles.actionsCard}>
                        {/* Manage in App Store / Google Play */}
                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={handleManageInAppStore}
                            activeOpacity={0.7}
                        >
                            <View style={styles.actionLeft}>
                                <View style={[styles.actionIconWrap, { backgroundColor: colors.buttonPrimary + '18' }]}>
                                    <Ionicons
                                        name="storefront-outline"
                                        size={scale(18)}
                                        color={colors.buttonPrimary}
                                    />
                                </View>
                                <View style={styles.actionInfo}>
                                    <Text style={styles.actionTitle}>{t(Platform.OS === 'ios' ? 'Управление в App Store' : 'Управление в Google Play')}</Text>
                                    <Text style={styles.actionSubtitle}>
                                        Change plan or cancel renewal
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={scale(16)} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.actionDivider} />

                        {/* Restore Purchases */}
                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={handleRestore}
                            activeOpacity={0.7}
                            disabled={isRestoring}
                        >
                            <View style={styles.actionLeft}>
                                <View style={[styles.actionIconWrap, { backgroundColor: '#34C759' + '18' }]}>
                                    <Ionicons
                                        name="arrow-down-circle-outline"
                                        size={scale(18)}
                                        color="#34C759"
                                    />
                                </View>
                                <View style={styles.actionInfo}>
                                    <Text style={styles.actionTitle}>{t('Восстановить покупки')}</Text>
                                    <Text style={styles.actionSubtitle}>
                                        Sync purchases across devices
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={scale(16)} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <View style={styles.actionDivider} />

                        {/* Privacy Policy */}
                        <TouchableOpacity
                            style={styles.actionRow}
                            onPress={handlePrivacy}
                            activeOpacity={0.7}
                        >
                            <View style={styles.actionLeft}>
                                <View style={[styles.actionIconWrap, { backgroundColor: '#8E8E93' + '18' }]}>
                                    <Ionicons
                                        name="shield-checkmark-outline"
                                        size={scale(18)}
                                        color="#8E8E93"
                                    />
                                </View>
                                <View style={styles.actionInfo}>
                                    <Text style={styles.actionTitle}>{t('Политика конфиденциальности')}</Text>
                                    <Text style={styles.actionSubtitle}>
                                        View our privacy policy
                                    </Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={scale(16)} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Cancellation note */}
                <View style={styles.noteContainer}>
                    <Ionicons name="information-circle-outline" size={scale(14)} color={colors.textSecondary} />
                    <Text style={styles.noteText}>
                        To cancel, open {Platform.OS === 'ios' ? 'App Store → Account → Subscriptions' : 'Google Play → Profile → Payments & subscriptions → Subscriptions'} → Zenyth AI, and turn off auto-renewal at least 24 hours before your renewal date.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

// ── Styles ───────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: IS_TABLET ? TABLET_SIDE_PADDING + scale(16) : scale(16),
        paddingVertical: scale(12),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        width: scale(36),
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: IS_TABLET ? TABLET_SIDE_PADDING + scale(16) : scale(16),
        paddingTop: scale(20),
        paddingBottom: scale(40),
    },
    // Hero card
    heroCard: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(20),
        paddingVertical: scale(22),
        paddingHorizontal: scale(20),
        marginBottom: scale(20),
    },
    crownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(10),
    },
    crownBadge: {
        width: scale(34),
        height: scale(34),
        borderRadius: scale(17),
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(10),
    },
    premiumLabel: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: 'rgba(255,255,255,0.85)',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    greetingText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: '#FFFFFF',
        marginBottom: scale(6),
    },
    heroSubtext: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: 'rgba(255,255,255,0.75)',
        lineHeight: scale(18),
        marginBottom: scale(14),
    },
    streakRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: scale(20),
        paddingVertical: scale(7),
        paddingHorizontal: scale(12),
        alignSelf: 'flex-start',
    },
    streakText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(12),
        color: '#FFFFFF',
        marginLeft: scale(6),
    },
    // Section
    sectionContainer: {
        marginBottom: scale(20),
    },
    sectionTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(13),
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: scale(10),
        marginLeft: scale(4),
    },
    // Plan card
    planCard: {
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(16),
        paddingVertical: scale(16),
        paddingHorizontal: scale(16),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1.5,
        borderColor: colors.buttonPrimary + '40',
    },
    planCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    planIconCircle: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: colors.buttonPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
    },
    planInfo: {
        flex: 1,
    },
    planName: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
        marginBottom: scale(3),
    },
    planStatus: {
        fontFamily: fonts.body.regular,
        fontSize: scale(12),
        color: '#4CAF50',
    },
    bestValueBadge: {
        backgroundColor: '#FFD700',
        borderRadius: scale(8),
        paddingVertical: scale(4),
        paddingHorizontal: scale(8),
        marginLeft: scale(8),
    },
    bestValueText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(10),
        color: '#1A1A1A',
        letterSpacing: 0.3,
    },
    // Features card
    featuresCard: {
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(16),
        overflow: 'hidden',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(13),
        paddingHorizontal: scale(16),
    },
    featureRowBorder: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    featureIconWrap: {
        width: scale(28),
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    featureText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.text,
        flex: 1,
        lineHeight: scale(18),
    },
    // Actions card
    actionsCard: {
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(16),
        overflow: 'hidden',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: scale(14),
        paddingHorizontal: scale(16),
    },
    actionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    actionIconWrap: {
        width: scale(36),
        height: scale(36),
        borderRadius: scale(10),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: scale(12),
    },
    actionInfo: {
        flex: 1,
    },
    actionTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: colors.text,
        marginBottom: scale(2),
    },
    actionSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(11),
        color: colors.textSecondary,
    },
    actionDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.border,
        marginLeft: scale(64),
    },
    // Note
    noteContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(12),
        padding: scale(14),
        marginBottom: scale(8),
        gap: scale(8),
    },
    noteText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(11),
        color: colors.textSecondary,
        lineHeight: scale(16),
        flex: 1,
    },
});

export default ManageSubscriptionScreen;
