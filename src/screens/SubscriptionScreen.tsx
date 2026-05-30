import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Platform,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { PRIVACY_POLICY_URL, scale, TERMS_OF_USE_URL } from '../constants';
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

async function openExternalUrl(url: string) {
    try {
        await Linking.openURL(url);
    } catch (error) {
        console.error('[SubscriptionScreen] Failed to open URL:', url, error);
    }
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
    const { completeOnboarding, subscriptionLevel } = useUserProfileStore();
    // Set to true only when the user explicitly taps Buy or Restore.
    // Prevents background checkStatus() from mistakenly navigating to the main app.
    const hasPurchaseIntent = useRef(false);
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

    const platformMonthlyId = Platform.OS === 'ios' ? PRODUCT_IDS.IOS.MONTHLY : PRODUCT_IDS.ANDROID.MONTHLY;
    const platformAnnualId = Platform.OS === 'ios' ? PRODUCT_IDS.IOS.ANNUAL : PRODUCT_IDS.ANDROID.ANNUAL;
    const [selectedSku, setSelectedSku] = useState<string>(platformMonthlyId);

    // Ensure products are loaded
    useEffect(() => {
        if (products.length === 0) {
            console.log('[SubscriptionScreen] Initializing IAP products');
            initialize();
        }
    }, []);

    // Look up products by `id` (expo-iap Product field)
    const monthlyProduct = products.find((p) => p.id === platformMonthlyId);
    const annualProduct = products.find((p) => p.id === platformAnnualId);

    const handlePurchase = async () => {
        console.log('[SubscriptionScreen] handlePurchase pressed - selectedSku:', selectedSku);
        hasPurchaseIntent.current = true;
        await purchase(selectedSku);

        // Read final state directly (same pattern as handleRestore / handleSelectFree)
        let { isActive: nowActive, error: nowError } = useSubscriptionStore.getState();

        // Fallback: if purchase() resolved but isActive is still false and no error,
        // do one final native subscription check (covers slow StoreKit propagation).
        if (!nowActive && !nowError) {
            console.log('[SubscriptionScreen] isActive still false after purchase — running fallback checkStatus');
            try {
                await useSubscriptionStore.getState().checkStatus();
                const updated = useSubscriptionStore.getState();
                nowActive = updated.isActive;
                nowError = updated.error;
            } catch {}
        }

        if (nowActive && !nowError) {
            console.log('[SubscriptionScreen] Purchase succeeded — navigating to app');
            completeOnboarding();
            router.replace(ROUTES.APP as any);
        }
    };

    const handleSelectFree = () => {
        console.log('[SubscriptionScreen] handleSelectFree pressed - selecting free plan');
        useUserProfileStore.getState().setPremium(false);
        completeOnboarding();
        router.replace(ROUTES.APP as any);
    };

    const handleRestore = async () => {
        console.log('[SubscriptionScreen] handleRestore pressed');
        hasPurchaseIntent.current = true;
        await restore();

        if (useSubscriptionStore.getState().isActive) {
            console.log('[SubscriptionScreen] Restore succeeded — navigating to app');
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
                        selectedSku === platformMonthlyId && styles.monthlyCardSelected,
                    ]}
                    onPress={() => setSelectedSku(platformMonthlyId)}
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
                        selectedSku === platformAnnualId && styles.annualCardSelected,
                    ]}
                    onPress={() => setSelectedSku(platformAnnualId)}
                    activeOpacity={0.9}
                    disabled={isBusy}
                >
                    <View style={styles.planHeader}>
                        <Text style={[styles.planTitle, styles.premiumTitle]}>Annual</Text>
                        <View>
                            <View style={styles.priceContainer}>
                                <Text style={[styles.planPrice, styles.premiumPrice]}>
                                    {annualProduct ? getDisplayPrice(annualProduct) : '—'}
                                </Text>
                                <Text style={styles.planPeriodLight}>/yr</Text>
                            </View>
                            <Text style={styles.discountBadge}>-20%</Text>
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
                        through your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account. Manage your subscription and disable
                        auto-renewal in your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account settings after purchase.
                    </Text>
                    <Text style={styles.disclosureHint}>
                        By continuing, you agree to the Terms of Use and Privacy Policy.
                    </Text>
                    <View style={styles.disclosureLinksRow}>
                        <TouchableOpacity onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}>
                            <Text style={styles.disclosureLink}>Privacy Policy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => openExternalUrl(TERMS_OF_USE_URL)}>
                            <Text style={styles.disclosureLink}>Terms of Use</Text>
                        </TouchableOpacity>
                    </View>
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
                                : products.length === 0
                                    ? 'Retry Loading'
                                    : 'Get Premium'
                    }
                    onPress={products.length === 0 && !isLoading ? () => initialize() : handlePurchase}
                    variant="primary"
                    size="large"
                    style={styles.continueButton}
                    disabled={isBusy || isLoading}
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
        marginTop: scale(30),
    },
    titleContainer: {
        alignItems: 'center',
        marginTop: scale(25),
        marginBottom: scale(20),
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
        minHeight: scale(220),
        borderWidth: 2,
        borderColor: 'transparent',
    },
    monthlyCardSelected: {
        borderColor: '#0D2A6B',
    },
    monthlyCard: {
        backgroundColor: colors.subscription?.freeCardBg || colors.surfaceLight,
    },
    annualCard: {
        backgroundColor: colors.buttonPrimary,
    },
    annualCardSelected: {
        borderColor: '#37A0EF',
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
        color: '#FFFFFF',
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
    disclosureHint: {
        fontFamily: fonts.body.regular,
        fontSize: scale(11),
        lineHeight: scale(16),
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: scale(8),
    },
    disclosureLinksRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(16),
        flexWrap: 'wrap',
    },
    buttonContainer: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(10),
        paddingTop: scale(8),
    },
    continueButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: 9999,
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
    discountBadge: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(12),
        color: '#FFFFFF',
        textAlign: 'right',
        marginTop: scale(2),
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: scale(20),
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.surfaceLight || '#FFFFFF',
        borderRadius: scale(24),
        padding: scale(24),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    modalIconContainer: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(20),
    },
    modalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(24),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scale(12),
    },
    modalText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: scale(22),
        marginBottom: scale(30),
    },
    modalButton: {
        width: '100%',
        borderRadius: scale(30),
    },
});

export default SubscriptionScreen;
