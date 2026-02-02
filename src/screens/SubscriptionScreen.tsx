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
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LogoSimple } from '../components/Logo';
import { Button } from '../components/Button';
import { colors, typography, spacing, borderRadius } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';
import { useAuthStore } from '../store/authStore';

interface PlanFeature {
    text: string;
    included: boolean;
}

const FREE_FEATURES: PlanFeature[] = [
    { text: 'Подбор хобби по характеру (анкета + AI)', included: true },
    { text: 'Выбор 1 хобби', included: true },
    { text: 'Ежедневная цель по хобби', included: true },
    { text: 'Трекер экранного времени', included: true },
];

const PREMIUM_FEATURES: PlanFeature[] = [
    { text: 'Всё из Free', included: true },
    { text: 'Глубокий AI-наставник (без ограничений)', included: true },
    { text: 'Персональный план развития', included: true },
    { text: 'План на неделю', included: true },
    { text: 'Детальная аналитика прогресса', included: true },
];

export const SubscriptionScreen: React.FC = () => {
    const router = useRouter();
    const { setPremium, completeOnboarding } = useAuthStore();
    const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium'>('free');

    // const navigation = useNavigation();

    const handleContinue = async () => {
        if (selectedPlan === 'premium') {
            // TODO: Implement in-app purchase
            setPremium(true);
        }
        completeOnboarding();

        // Navigate to the main app layout
        router.replace('/(app)/');
    };

    const handleSkip = () => {
        setPremium(false);
        completeOnboarding();

        // Navigate to the main app layout
        router.replace('/(app)/');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoSimple size="large" />
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
                <Text style={styles.titleText}>
                    Выбери формат, который подходит тебе
                </Text>
            </View>

            {/* Plans */}
            <ScrollView
                style={styles.plansContainer}
                contentContainerStyle={styles.plansContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Free Plan */}
                <TouchableOpacity
                    style={[
                        styles.planCard,
                        selectedPlan === 'free' && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedPlan('free')}
                    activeOpacity={0.9}
                >
                    <View style={styles.planHeader}>
                        <Text style={styles.planTitle}>Free</Text>
                        <Text style={styles.planPrice}>0 $</Text>
                    </View>
                    <View style={styles.featuresContainer}>
                        {FREE_FEATURES.map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <Text style={styles.featureBullet}>•</Text>
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>

                {/* Premium Plan */}
                <TouchableOpacity
                    style={[
                        styles.planCard,
                        styles.premiumCard,
                        selectedPlan === 'premium' && styles.planCardSelected,
                    ]}
                    onPress={() => setSelectedPlan('premium')}
                    activeOpacity={0.9}
                >
                    <View style={styles.premiumBadge}>
                        <Text style={styles.premiumBadgeText}>Рекомендуем</Text>
                    </View>
                    <View style={styles.planHeader}>
                        <Text style={[styles.planTitle, styles.premiumTitle]}>Premium</Text>
                        <View style={styles.priceContainer}>
                            <Text style={[styles.planPrice, styles.premiumPrice]}>2,99 $</Text>
                            <Text style={styles.planPeriod}>/месяц</Text>
                        </View>
                    </View>
                    <View style={styles.featuresContainer}>
                        {PREMIUM_FEATURES.map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <Text style={[styles.featureBullet, styles.premiumBullet]}>•</Text>
                                <Text style={[styles.featureText, styles.premiumFeatureText]}>
                                    {feature.text}
                                </Text>
                            </View>
                        ))}
                    </View>
                </TouchableOpacity>
            </ScrollView>

            {/* Bottom buttons */}
            <View style={styles.buttonContainer}>
                {selectedPlan === 'premium' ? (
                    <>
                        <Button
                            title="Оформить Premium"
                            onPress={handleContinue}
                            variant="gradient"
                            size="large"
                        />
                        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                            <Text style={styles.skipText}>Продолжить бесплатно</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <Button
                        title="Продолжить"
                        onPress={handleContinue}
                        variant="primary"
                        size="large"
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: scaleHeight(60),
    },
    titleContainer: {
        paddingHorizontal: scaleWidth(spacing.lg),
        marginTop: scaleHeight(spacing.lg),
        marginBottom: scaleHeight(spacing.md),
    },
    titleText: {
        fontFamily: typography.h2.fontFamily,
        fontSize: scaleFont(20),
        lineHeight: scaleHeight(28),
        color: colors.text,
        textAlign: 'center',
    },
    plansContainer: {
        flex: 1,
    },
    plansContent: {
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingBottom: scaleHeight(spacing.lg),
    },
    planCard: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.md,
        padding: scaleWidth(spacing.lg),
        marginBottom: scaleHeight(spacing.md),
        borderWidth: 2,
        borderColor: 'transparent',
    },
    planCardSelected: {
        borderColor: colors.primary,
    },
    premiumCard: {
        backgroundColor: colors.dark,
    },
    premiumBadge: {
        position: 'absolute',
        top: scaleHeight(-10),
        right: scaleWidth(spacing.md),
        backgroundColor: colors.primary,
        paddingHorizontal: scaleWidth(12),
        paddingVertical: scaleHeight(4),
        borderRadius: borderRadius.sm,
    },
    premiumBadgeText: {
        fontFamily: typography.label.fontFamily,
        fontSize: scaleFont(12),
        color: colors.text,
        fontWeight: '600',
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scaleHeight(spacing.md),
    },
    planTitle: {
        fontFamily: typography.h2.fontFamily,
        fontSize: scaleFont(22),
        color: colors.text,
    },
    premiumTitle: {
        color: colors.background,
    },
    planPrice: {
        fontFamily: typography.h2.fontFamily,
        fontSize: scaleFont(24),
        color: colors.text,
    },
    premiumPrice: {
        color: colors.primary,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPeriod: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.textLight,
        marginLeft: scaleWidth(4),
    },
    featuresContainer: {
        gap: scaleHeight(8),
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    featureBullet: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.textSecondary,
        marginRight: scaleWidth(8),
        lineHeight: scaleHeight(20),
    },
    premiumBullet: {
        color: colors.primary,
    },
    featureText: {
        flex: 1,
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.textSecondary,
        lineHeight: scaleHeight(20),
    },
    premiumFeatureText: {
        color: 'rgba(255,255,255,0.8)',
    },
    buttonContainer: {
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingBottom: scaleHeight(spacing.xxl),
    },
    skipButton: {
        alignItems: 'center',
        marginTop: scaleHeight(spacing.md),
    },
    skipText: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
});

export default SubscriptionScreen;
