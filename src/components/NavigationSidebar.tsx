import React, { useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    TouchableWithoutFeedback,
    Image,
    Alert,
    Easing,
    Dimensions,
    Platform,
} from 'react-native';
import {
    Ionicons
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore, getSubscriptionDisplayText } from '../store/userProfileStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { InfoModal } from './ui/InfoModal';
import { ConfirmModal } from './ui/ConfirmModal';
import * as Linking from 'expo-linking';
import { useLanguageStore, useT } from '../store/languageStore';
import { openManageSubscriptions } from '../store/subscriptionStore';

const SIDEBAR_WIDTH = scale(180);

interface NavigationSidebarProps {
    visible: boolean;
    onClose: () => void;
    activeItem?: 'main' | 'growth' | 'settings' | 'about';
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
    visible,
    onClose,
    activeItem = 'main',
}) => {
    const router = useRouter();
    const { signOut, deleteAccount } = useAuthStore();
    const { userName, subscriptionLevel } = useUserProfileStore();
    const { isActive } = useSubscriptionStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Get display values
    const displayName = userName || 'User';
    const displaySubscription = getSubscriptionDisplayText(subscriptionLevel);
    const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [howItWorksVisible, setHowItWorksVisible] = React.useState(false);
    const [shareVisible, setShareVisible] = React.useState(false);
    const [feedbackVisible, setFeedbackVisible] = React.useState(false);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = React.useState(false);

    const { language, setLanguage } = useLanguageStore();
    const t = useT();
    const insightsLabel = Platform.OS === 'ios' ? t('Время Хобби') : t('Экранное время');

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 350,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.exp),
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.quad),
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SIDEBAR_WIDTH,
                    duration: 300,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.exp),
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                    easing: Easing.in(Easing.quad),
                }),
            ]).start();
        }
        return () => {
            slideAnim.stopAnimation();
            fadeAnim.stopAnimation();
        };
    }, [visible, slideAnim, fadeAnim]);

    const [expandedSection, setExpandedSection] = React.useState<string | null>('main');

    const handleLogout = async () => {
        console.log('[NavigationSidebar] handleLogout pressed');
        onClose();
        await signOut();
    };

    const handleDeleteAccount = () => {
        console.log('[NavigationSidebar] handleDeleteAccount pressed');
        setDeleteConfirmVisible(true);
    };

    const confirmDeleteAccount = async () => {
        setDeleteConfirmVisible(false);
        console.log('[Sidebar] Handling delete account button press...');
        try {
            onClose();
            console.log('[Sidebar] Calling deleteAccount() from authStore...');
            await deleteAccount();
            console.log('[Sidebar] deleteAccount() succeeded, redirecting to /...');
            router.replace('/');
        } catch (error) {
            console.error('[Sidebar] Error from deleteAccount():', error);
            Alert.alert(t('Ошибка'), t('Не удалось удалить аккаунт'));
        }
    };

    const handleNavItemPress = (item: string) => {
        console.log('[NavigationSidebar] handleNavItemPress - item:', item, 'expanded:', expandedSection === item ? 'collapsing' : 'expanding');
        if (expandedSection === item) {
            setExpandedSection(null);
        } else {
            setExpandedSection(item);
        }
    };

    const handleSubItemPress = (item: { key?: string; label: string; route?: string }) => {
        console.log('[NavigationSidebar] handleSubItemPress - label:', item.label, 'key:', item.key, 'route:', item.route);
        if (item.route) {
            onClose();
            setTimeout(() => {
                router.push(item.route as any);
            }, 300);
            return;
        }

        switch (item.key) {
            case 'how-it-works':
                console.log('[NavigationSidebar] Opening How It Works modal');
                setHowItWorksVisible(true);
                break;
            case 'feedback':
                console.log('[NavigationSidebar] Opening Feedback modal');
                setFeedbackVisible(true);
                break;
            case 'share':
                console.log('[NavigationSidebar] Opening Share modal');
                setShareVisible(true);
                break;
            case 'manage-subscription':
                console.log('[NavigationSidebar] Opening Manage Subscriptions');
                openManageSubscriptions();
                break;
            case 'privacy':
                console.log('[NavigationSidebar] Opening Privacy Policy');
                Linking.openURL('https://zenyth-ai-privacy.vercel.app/').catch((err) =>
                    console.error('[NavigationSidebar] Privacy URL failed:', err)
                );
                break;
            case 'delete-account':
                console.log('[NavigationSidebar] Opening Delete Account confirmation');
                handleDeleteAccount();
                break;
            default:
                console.log('[NavigationSidebar] Feature not implemented:', item.key);
                Alert.alert(t('Скоро'), t('Этот раздел находится в разработке и скоро будет доступен.'));
        }
    };

    type SubItem = { key?: string; label: string; route?: string };
    type NavigationItem = { key: string; label: string; subItems: SubItem[] };

    const navigationItems: NavigationItem[] = [
        {
            key: 'main',
            label: t('Основное'),
            subItems: [
                { label: t('Главная'), route: '/(app)/' },
                { label: t('Хобби и план'), route: '/(app)/weekly-plan' },
                { label: t('AI-наставник'), route: '/(app)/ai-coach' },
                { label: insightsLabel, route: '/(app)/screen-time' },
            ],
        },
        {
            key: 'growth',
            label: t('Развитие'),
            subItems: [
                { label: t('Подборка контента') },
                { label: t('Достижения и бейджи') },
            ],
        },
        {
            key: 'settings',
            label: t('Управление'),
            subItems: [
                {
                    key: 'manage-subscription',
                    label: t('Управление подпиской'),
                    route: (subscriptionLevel === 'premium' || isActive) ? '/manage-subscription' : '/subscription',
                },
                { label: t('Настройки') },
                { label: t('Уведомления') },
                { key: 'delete-account', label: t('Удалить аккаунт') },
            ],
        },
        {
            key: 'about',
            label: t('О продукте'),
            subItems: [
                { key: 'how-it-works', label: t('Как это работает') },
                { key: 'feedback', label: t('Обратная связь') },
                { key: 'share', label: t('Поделиться с другом') },
            ],
        },
    ];

    const renderThemeSwitcher = () => null;

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={onClose}
            statusBarTranslucent
        >
            <View style={styles.container}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={[
                            styles.overlay,
                            { opacity: fadeAnim },
                        ]}
                    />
                </TouchableWithoutFeedback>

                <Animated.View
                    style={[
                        styles.sidebar,
                        {
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.profileSection}>
                        <View style={styles.profileHeader}>
                            <View style={styles.userIconContainer}>
                                <Ionicons name="person" size={22} color={colors.buttonTextPrimary} />
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={[
                                    styles.userName,
                                    displayName.length > 18
                                        ? { fontSize: 9 }
                                        : displayName.length > 12
                                        ? { fontSize: 11 }
                                        : null,
                                ]} numberOfLines={2}>{displayName}</Text>
                                <Text style={styles.subscriptionLevel}>{displaySubscription}</Text>
                                <TouchableOpacity
                                    style={styles.logoutButton}
                                    onPress={handleLogout}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="arrow-back-outline" size={scale(16)} color={colors.text} />
                                    <Text style={styles.logoutText}>{t('Выйти')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteAccountButton}
                                    onPress={handleDeleteAccount}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={scale(14)} color={colors.error} />
                                    <Text style={styles.deleteAccountText}>{t('Удалить аккаунт')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Language Toggle - Moved up */}
                    <View style={styles.languageSection}>
                        <Text style={styles.languageSectionTitle}>
                            {t('Язык')}
                        </Text>
                        <View style={styles.languageButtons}>
                            <TouchableOpacity
                                style={[styles.langButton, language === 'ru' && styles.langButtonActive]}
                                onPress={() => {
                                    console.log('[NavigationSidebar] Language switched to RU');
                                    setLanguage('ru');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.langButtonText, language === 'ru' && styles.langButtonTextActive]}>RU</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.langButton, language === 'en' && styles.langButtonActive]}
                                onPress={() => {
                                    console.log('[NavigationSidebar] Language switched to EN');
                                    setLanguage('en');
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>EN</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.navigationSection}>
                        {navigationItems.map((item) => (
                            <View key={item.key} style={styles.navItemContainer}>
                                <TouchableOpacity
                                    style={styles.navItem}
                                    onPress={() => handleNavItemPress(item.key)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.navItemText}>{item.label}</Text>
                                </TouchableOpacity>

                                {expandedSection === item.key && (
                                    <View style={styles.subItemsContainer}>
                                        {item.subItems.map((subItem, index) => (
                                            <TouchableOpacity
                                                key={index}
                                                style={styles.subItem}
                                                onPress={() => handleSubItemPress(subItem)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[
                                                    styles.subItemText,
                                                    subItem.label === t('Удалить аккаунт') && { color: colors.error }
                                                ]}>
                                                    {subItem.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>

                    {renderThemeSwitcher()}


                    <View style={styles.footerSection}>
                        <View style={styles.footerContent}>
                            <TouchableOpacity activeOpacity={0.7} onPress={() => {
                                console.log('[NavigationSidebar] FAQ pressed');
                                handleSubItemPress({ key: 'faq', label: 'FAQ' });
                            }}>
                                <Text style={styles.faqText}>{t('FAQ')}</Text>
                            </TouchableOpacity>
                            <View style={styles.footerDivider} />
                            <TouchableOpacity activeOpacity={0.7} onPress={() => {
                                console.log('[NavigationSidebar] Privacy Policy pressed');
                                handleSubItemPress({ key: 'privacy', label: t('Политика\nКонфиденциальности') });
                            }}>
                                <Text style={styles.privacyText}>
                                    {t('Политика\nКонфиденциальности')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>

            <InfoModal
                visible={howItWorksVisible}
                onClose={() => setHowItWorksVisible(false)}
                title={t('Как это работает')}
                content={t('Zenyth AI — ваш персональный помощник в развитии хобби. Мы помогаем планировать занятия, отслеживать прогресс и общаться с умным AI-наставником, который всегда готов дать совет или мотивацию.')}
            />

            <InfoModal
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                title={t('Поделиться с другом')}
                type="share"
                shareLink="https://zenyth.ai/download"
            />

            <InfoModal
                visible={feedbackVisible}
                onClose={() => setFeedbackVisible(false)}
                title={t('Обратная связь')}
                content={t('Мы всегда рады вашим вопросам и предложениям! Напишите нам на info@zenyth.ink')}
            />

            <ConfirmModal
                visible={deleteConfirmVisible}
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={confirmDeleteAccount}
                title={t('Вы уверены?')}
                content={t('Это действие необратимо. Все ваши данные будут удалены.')}
                confirmText={t('Удалить')}
                cancelText={t('Отмена')}
                isDestructive={true}
            />
        </Modal>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sidebar: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: SIDEBAR_WIDTH,
        backgroundColor: colors.surfaceLight,
        paddingTop: scale(80),
        paddingHorizontal: scale(16),
        paddingBottom: scale(20),
        justifyContent: 'space-between',
        shadowColor: colors.shadow,
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
    },
    profileSection: {
        alignItems: 'flex-start',
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    userIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.buttonPrimary,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
        marginTop: 10,
    },
    userInfo: {
        marginLeft: scale(10),
        marginTop: 10,
        flex: 1,
        maxWidth: SIDEBAR_WIDTH - scale(70),
    },
    userName: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 16,
        maxWidth: SIDEBAR_WIDTH - scale(80),
    },
    subscriptionLevel: {
        alignSelf: 'stretch',
        color: colors.textSecondary,
        fontFamily: fonts.body.light,
        fontSize: scale(8),
        fontStyle: 'normal',
        fontWeight: '300',
        lineHeight: scale(10),
        marginTop: 0,
        marginBottom: scale(3),
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -2,
    },
    logoutText: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 22,
        marginLeft: scale(4),
    },
    deleteAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: scale(6),
    },
    deleteAccountText: {
        color: colors.error,
        fontFamily: fonts.heading.bold,
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 18,
        marginLeft: scale(4),
    },
    navigationSection: {
        flex: 1,
        marginTop: scale(40),
    },
    navItemContainer: {
        marginBottom: scale(16),
    },
    navItem: {
        paddingVertical: scale(4),
    },
    navItemText: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 22,
    },
    subItemsContainer: {
        marginTop: scale(8),
        marginLeft: scale(0),
    },
    subItem: {
        paddingVertical: scale(6),
    },
    subItemText: {
        color: colors.statistics.darkText,
        fontFamily: fonts.heading.light,
        fontSize: 16,
        lineHeight: 20,
    },
    themeSwitcherContainer: {
        marginTop: scale(20),
        paddingTop: scale(20),
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    themeSwitcherLabel: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 14,
        marginBottom: scale(12),
    },
    themeButtonsRow: {
        flexDirection: 'row',
        gap: scale(12),
    },
    themeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.background,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    themeButtonActive: {
        backgroundColor: colors.buttonPrimary,
        borderColor: colors.buttonPrimary,
    },
    languageSection: {
        marginTop: scale(16),
        paddingTop: scale(16),
        borderTopWidth: 1,
        borderTopColor: colors.border,

    },
    languageSectionTitle: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 14,
        marginBottom: scale(10),
    },
    languageButtons: {
        flexDirection: 'row',
        gap: scale(10),
    },
    langButton: {
        paddingHorizontal: scale(16),
        paddingVertical: scale(8),
        borderRadius: scale(20),
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    langButtonActive: {
        backgroundColor: colors.buttonPrimary,
        borderColor: colors.buttonPrimary,
    },
    langButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: 13,
        color: colors.text,
    },
    langButtonTextActive: {
        color: colors.buttonTextPrimary,
    },
    footerSection: {
        marginTop: 'auto',
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    faqText: {
        color: colors.text,
        fontFamily: fonts.heading.regular,
        fontSize: 10,
        lineHeight: 14,
    },
    footerDivider: {
        width: 1,
        height: scale(24),
        backgroundColor: colors.text,
        marginHorizontal: scale(8),
    },
    privacyText: {
        color: colors.text,
        fontFamily: fonts.heading.regular,
        fontSize: 10,
        lineHeight: 14,
    },
});

export const MenuDrawer = NavigationSidebar;

export default NavigationSidebar;
