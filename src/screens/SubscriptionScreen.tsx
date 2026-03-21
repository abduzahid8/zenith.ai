import React, { useState, useMemo, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { ROUTES } from '../config/routes';
import { useUserProfileStore } from '../store/userProfileStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { PRODUCT_IDS } from '../services/iapService';
import { useAppTheme } from '../theme/useAppTheme';

// ── Helpers ─────────────────────────────────────────────

/** Extract localized price string from an expo-iap Product object */
function getDisplayPrice(product: any): string {
    // expo-iap Product returns displayPrice on iOS (e.g. "$2.99")
    return product?.displayPrice ?? '—';
}

// ── Free plan features ──────────────────────────────────

const FREE_FEATURES = [
    'Hobby matching by personality (quiz + AI)',
    'Choose 1 hobby',
    'Daily hobby goal',
    'Basic screen time tracker',
    'Progress in percentages',
    'AI Coach — 2 chats per day',
];

const PREMIUM_FEATURES = [
    'Everything in Free',
    'Deep AI Coach (unlimited)',
    'Personalized growth plan',
    'Weekly plan',
    'Progress analysis & explanations',
    'Progress breakdown',
    'Weekly AI report',
];

// ── Component ───────────────────────────────────────────

export const SubscriptionScreen: React.FC = () => {
    const router = useRouter();
    const { completeOnboarding } = useUserProfileStore();
    const {
        products,
        isLoading,
        isPurchasing,
        isRestoring,
        error,
        purchase,
        restore,
        initialize,
    } = useSubscriptionStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [selectedSku, setSelectedSku] = useState<string>(PRODUCT_IDS.MONTHLY);

    // Ensure products are loaded
    useEffect(() => {
        if (products.length === 0 && Platform.OS === 'ios') {
            initialize();
        }
    }, []);

    // Look up products by `id` (expo-iap Product field)
    const monthlyProduct = products.find((p) => p.id === PRODUCT_IDS.MONTHLY);
    const annualProduct = products.find((p) => p.id === PRODUCT_IDS.ANNUAL);

    const handlePurchase = async () => {
        await purchase(selectedSku);
        // If purchase succeeds, the listener in subscriptionStore sets isActive=true
        // and syncs to userProfileStore, so we can proceed:
        const { isActive } = useSubscriptionStore.getState();
        if (isActive) {
            completeOnboarding();
            router.replace(ROUTES.APP as any);
        }
    };

    const handleSelectFree = () => {
        useUserProfileStore.getState().setPremium(false);
        completeOnboarding();
        router.replace(ROUTES.APP as any);
    };

    const handleRestore = async () => {
        await restore();
        const { isActive } = useSubscriptionStore.getState();
        if (isActive) {
            completeOnboarding();
            router.replace(ROUTES.APP as any);
        }
    };

    const isBusy = isPurchasing || isRestoring;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(177)} height={scale(40)} variant="full" color={colors.text} />
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.titleText}>
                    Choose the plan that works for you
                </Text>
            </View>

            <ScrollView
                style={styles.plansContainer}
                contentContainerStyle={styles.plansContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Monthly Plan */}
                <TouchableOpacity
                    style={[
                        styles.planCard,
                        styles.monthlyCard,
                        selectedSku === PRODUCT_IDS.MONTHLY && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedSku(PRODUCT_IDS.MONTHLY)}
                    activeOpacity={0.9}
                    disabled={isBusy}
                >
                    <View style={styles.planHeader}>
                        <Text style={[styles.planTitle, styles.planTitleDark]}>Monthly</Text>
                        <View style={styles.priceContainer}>
                            <Text style={[styles.planPrice, styles.planPriceDark]}>
                                {monthlyProduct ? getDisplayPrice(monthlyProduct) : '—'}
                            </Text>
                            <Text style={styles.planPeriod}>/mo</Text>
                        </View>
                    </View>
                    <View style={styles.featuresContainer}>
                        {PREMIUM_FEATURES.map((text, i) => (
                            <View key={i} style={styles.featureRow}>
                                <Text style={[styles.featureBullet, styles.featureBulletDark]}>•</Text>
                                <Text style={[styles.featureText, styles.featureTextDark]}>{text}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* Annual Plan */}
                <TouchableOpacity
                    style={[
                        styles.planCard,
                        styles.annualCard,
                        selectedSku === PRODUCT_IDS.ANNUAL && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedSku(PRODUCT_IDS.ANNUAL)}
                    activeOpacity={0.9}
                    disabled={isBusy}
                >
                    <View style={styles.planHeader}>
                        <Text style={[styles.planTitle, styles.premiumTitle]}>Annual</Text>
                        <View style={styles.priceContainer}>
                            <Text style={[styles.planPrice, styles.premiumPrice]}>
                                {annualProduct ? getDisplayPrice(annualProduct) : '—'}
                            </Text>
                            <Text style={styles.planPeriodLight}>/yr</Text>
                        </View>
                    </View>
                    <View style={styles.featuresContainer}>
                        {PREMIUM_FEATURES.map((text, i) => (
                            <View key={i} style={styles.featureRow}>
                                <Text style={[styles.featureBullet, styles.premiumBullet]}>•</Text>
                                <Text style={[styles.featureText, styles.premiumFeatureText]}>{text}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* Subscription Disclosure (Guideline 3.1.2) */}
                <View style={styles.disclosureContainer}>
                    <Text style={styles.disclosureText}>
                        Subscription renews automatically unless auto-renewal is disabled
                        at least 24 hours before the end of the current period. Payment is charged
                        through your App Store account. Manage your subscription and disable
                        auto-renewal in your App Store account settings after purchase.
                    </Text>
                    <TouchableOpacity onPress={() => router.push('/privacy' as any)}>
                        <Text style={styles.disclosureLink}>Privacy Policy</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Bottom buttons */}
            <View style={styles.buttonContainer}>
                {/* Error message */}
                {error && (
                    <Text style={styles.errorText}>{error}</Text>
                )}

                {/* Purchase button */}
                <Button
                    title={
                        isPurchasing
                            ? 'Processing...'
                            : isLoading
                                ? 'Loading...'
                                : 'Get Premium'
                    }
                    onPress={handlePurchase}
                    variant="primary"
                    size="large"
                    style={styles.continueButton}
                    disabled={isBusy || isLoading || products.length === 0}
                />

                {/* Restore button */}
                <TouchableOpacity
                    style={styles.restoreLink}
                    onPress={handleRestore}
                    activeOpacity={0.7}
                    disabled={isBusy}
                >
                    {isRestoring ? (
                        <ActivityIndicator size="small" color={colors.textSecondary} />
                    ) : (
                        <Text style={styles.restoreLinkText}>Restore purchases</Text>
                    )}
                </TouchableOpacity>

                {/* Free link */}
                <TouchableOpacity
                    style={styles.freeLink}
                    onPress={handleSelectFree}
                    activeOpacity={0.7}
                    disabled={isBusy}
                >
                    <Text style={styles.freeLinkText}>Continue with Free</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

// ── Styles ──────────────────────────────────────────────

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: scale(40),
    },
    titleContainer: {
        alignItems: 'center',
        marginTop: scale(40),
        marginBottom: scale(30),
    },
    titleText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        lineHeight: scale(30),
        color: colors.text,
        textAlign: 'center',
        width: scale(271),
    },
    plansContainer: {
        flex: 1,
    },
    plansContent: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(10),
    },
    planCard: {
        borderRadius: scale(25),
        paddingVertical: scale(14),
        paddingHorizontal: scale(18),
        marginBottom: scale(12),
    },
    planCardSelected: {
        borderWidth: 2,
        borderColor: colors.buttonPrimary,
    },
    monthlyCard: {
        backgroundColor: colors.subscription?.freeCardBg || colors.surfaceLight,
    },
    annualCard: {
        backgroundColor: colors.buttonPrimary,
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(6),
    },
    planTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
    },
    planTitleDark: {
        color: colors.text,
    },
    premiumTitle: {
        color: '#FFFFFF',
    },
    planPrice: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
    },
    planPriceDark: {
        color: colors.text,
    },
    premiumPrice: {
        color: colors.subscription?.premiumAccent || '#FFD700',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPeriod: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        marginLeft: scale(4),
    },
    planPeriodLight: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        color: 'rgba(255,255,255,0.7)',
        marginLeft: scale(4),
    },
    featuresContainer: {
        gap: scale(3),
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureBullet: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        color: colors.text,
        marginRight: scale(8),
        lineHeight: scale(18),
    },
    featureBulletDark: {
        color: colors.text,
    },
    premiumBullet: {
        color: colors.subscription?.premiumAccent || '#FFD700',
    },
    featureText: {
        flex: 1,
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        color: colors.text,
        lineHeight: scale(17),
    },
    featureTextDark: {
        color: colors.text,
    },
    premiumFeatureText: {
        color: '#FFFFFF',
    },
    disclosureContainer: {
        marginTop: scale(16),
        paddingHorizontal: scale(4),
    },
    disclosureText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(11),
        lineHeight: scale(16),
        color: colors.textSecondary,
        textAlign: 'center',
    },
    disclosureLink: {
        fontFamily: fonts.body.medium,
        fontSize: scale(11),
        color: colors.link || colors.buttonPrimary,
        textAlign: 'center',
        marginTop: scale(6),
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(10),
        paddingTop: scale(12),
    },
    continueButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(30),
    },
    restoreLink: {
        marginTop: scale(12),
        alignItems: 'center',
        paddingVertical: scale(5),
    },
    restoreLinkText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(14),
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    freeLink: {
        marginTop: scale(8),
        alignItems: 'center',
        paddingVertical: scale(5),
    },
    freeLinkText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.text,
    },
    errorText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.error || '#FF3B30',
        textAlign: 'center',
        marginBottom: scale(8),
    },
});

export default SubscriptionScreen;
