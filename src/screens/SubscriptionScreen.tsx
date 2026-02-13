import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors, spacing } from '../theme';
import { useUserProfileStore } from '../store/userProfileStore';

// Scale helper
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

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
    const [selectedPlan, setSelectedPlan] = useState<'free' | 'premium'>('premium'); // Default to premium usually converts better, or stick to free if simpler. Let's default to free as per image order or premium as per business goal. User selected Free in image, let's default to Free to match screenshot state? No, normally apps default to Premium. I'll stick to 'premium' as default or 'free' if that was previous behavior. Previous was 'free'.

    const handleContinue = async () => {
        if (selectedPlan === 'premium') {
            // TODO: Implement in-app purchase
            setPremium(true);
        } else {
            setPremium(false);
        }
        completeOnboarding();
        router.replace('/(app)/' as any);
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
                    onPress={() => {
                        setPremium(true);
                        completeOnboarding();
                        router.replace('/(app)/' as any);
                    }}
                    variant="primary"
                    size="large"
                    style={styles.continueButton}
                />
                <TouchableOpacity
                    style={styles.freeLink}
                    onPress={() => {
                        setPremium(false);
                        completeOnboarding();
                        router.replace('/(app)/' as any);
                    }}
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
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(30),
        color: '#08132A',
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
    freeCard: {
        backgroundColor: '#C4DCFB',
    },
    premiumCard: {
        backgroundColor: '#102852',
    },
    planHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(6),
    },
    planTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(22),
        color: '#08132A',
    },
    premiumTitle: {
        color: '#FFFFFF',
    },
    planPrice: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(22),
        color: '#08132A',
    },
    premiumPrice: {
        color: '#00FFC2',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPeriod: {
        fontFamily: 'Gramatika-Regular',
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
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(13),
        color: '#08132A',
        marginRight: scale(8),
        lineHeight: scale(18),
    },
    premiumBullet: {
        color: '#00FFC2',
    },
    featureText: {
        flex: 1,
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(13),
        color: '#08132A',
        lineHeight: scale(17),
    },
    premiumFeatureText: {
        color: '#FFFFFF',
    },
    buttonContainer: {
        paddingHorizontal: scale(24),
        paddingBottom: scale(10),
        paddingTop: scale(20),
    },
    continueButton: {
        backgroundColor: '#102852',
        borderRadius: scale(30),
    },
    freeLink: {
        marginTop: scale(16),
        alignItems: 'center',
        paddingVertical: scale(5),
    },
    freeLinkText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: scale(16),
        color: '#08132A',
    },
});

export default SubscriptionScreen;
