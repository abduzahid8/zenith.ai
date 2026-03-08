import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors, fonts, spacing } from '../theme';
import { scale } from '../constants';
import { ROUTES } from '../config/routes';
import { useUserProfileStore } from '../store/userProfileStore';

interface PlanFeature {
    text: string;
}

const FREE_FEATURES: PlanFeature[] = [
    { text: 'Подбор хобби по характеру (анкета + AI)' },
    { text: 'Выбор 1 хобби' },
    { text: 'Ежедневная цель по хобби' },
    { text: 'Трекер экранного времени (базовый)' },
    { text: 'Прогресс в процентах' },
    { text: 'AI-наставник — 2 диалога в день' },
];

const PREMIUM_FEATURES: PlanFeature[] = [
    { text: 'Всё из Free' },
    { text: 'Глубокий AI-наставник (без ограничений)' },
    { text: 'Персональный план развития' },
    { text: 'План на неделю' },
    { text: 'Анализ прогресса и объяснения' },
    { text: 'Объяснение прогресса' },
    { text: 'Недельный AI-отчёт' },
];

export const SubscriptionScreen: React.FC = () => {
    const router = useRouter();
    const { setPremium, completeOnboarding } = useUserProfileStore();
    const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium'>('premium');

    const handleSelectPremium = () => {
        setPremium(true);
        completeOnboarding();
        router.replace(ROUTES.APP as any);
    };

    const handleSelectFree = () => {
        setPremium(false);
        completeOnboarding();
        router.replace(ROUTES.APP as any);
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(177)} height={scale(40)} variant="full" />
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
                        styles.freeCard,
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
                <Button
                    title="Оформить Premium"
                    onPress={handleSelectPremium}
                    variant="primary"
                    size="large"
                    style={styles.continueButton}
                />
                <TouchableOpacity
                    style={styles.freeLink}
                    onPress={handleSelectFree}
                    activeOpacity={0.7}
                >
                    <Text style={styles.freeLinkText}>Продолжить с Free</Text>
                </TouchableOpacity>
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
        borderWidth: 2,
        borderColor: 'transparent',
    },
    planCardSelected: {
        borderColor: colors.primary,
    },
    freeCard: {
        backgroundColor: colors.subscription.freeCardBg,
    },
    premiumCard: {
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
    premiumTitle: {
        color: colors.white,
    },
    planPrice: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
    },
    premiumPrice: {
        color: colors.subscription.premiumAccent,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPeriod: {
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
    premiumBullet: {
        color: colors.subscription.premiumAccent,
    },
    featureText: {
        flex: 1,
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        color: colors.text,
        lineHeight: scale(17),
    },
    premiumFeatureText: {
        color: colors.white,
    },
    buttonContainer: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(10),
        paddingTop: scale(20),
    },
    continueButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(30),
    },
    freeLink: {
        marginTop: scale(16),
        alignItems: 'center',
        paddingVertical: scale(5),
    },
    freeLinkText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.text,
    },
});

export default SubscriptionScreen;
