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
} from 'react-native';
import {
    Ionicons
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore, getSubscriptionDisplayText } from '../store/userProfileStore';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';

const SIDEBAR_WIDTH = scale(180);

interface NavigationSidebarProps {
    visible: boolean;
    onClose: () => void;
    activeItem?: 'основное' | 'развитие' | 'управление' | 'о продукте';
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
    visible,
    onClose,
    activeItem = 'основное',
}) => {
    const router = useRouter();
    const { signOut } = useAuthStore();
    const { userName, subscriptionLevel } = useUserProfileStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Get display values
    const displayName = userName || 'Пользователь';
    const displaySubscription = getSubscriptionDisplayText(subscriptionLevel);
    const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.spring(slideAnim, {
                    toValue: 0,
                    useNativeDriver: true,
                    speed: 45,
                    bounciness: 15,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: SIDEBAR_WIDTH,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 250,
                    useNativeDriver: true,
                }),
            ]).start();
        }
        return () => {
            slideAnim.stopAnimation();
            fadeAnim.stopAnimation();
        };
    }, [visible, slideAnim, fadeAnim]);

    const [expandedSection, setExpandedSection] = React.useState<string | null>('основное');

    const handleLogout = () => {
        onClose();
        signOut();
        setTimeout(() => {
            router.replace('/');
        }, 300);
    };

    const handleNavItemPress = (item: string) => {
        if (expandedSection === item) {
            setExpandedSection(null);
        } else {
            setExpandedSection(item);
        }
    };

    const handleSubItemPress = (route?: string) => {
        if (route) {
            onClose();
            setTimeout(() => {
                router.replace(route as any);
            }, 300);
        }
    };

    const navigationItems = [
        {
            key: 'основное',
            label: 'Основное',
            subItems: [
                { label: 'Главная', route: '/(app)/' },
                { label: 'Прогресс', route: '/(app)/screen-time' },
                { label: 'Хобби и план', route: '/(app)/weekly-plan' },
                { label: 'AI-наставник', route: '/(app)/ai-coach' },
            ],
        },
        {
            key: 'развитие',
            label: 'Развитие',
            subItems: [
                { label: 'Подборка контента' },
                { label: 'Недельный отчёт', route: '/(app)/screen-time' },
                { label: 'Достижения и бейджи' },
            ],
        },
        {
            key: 'управление',
            label: 'Управление',
            subItems: [
                { label: 'Настройки' },
                { label: 'Уведомления' },
                { label: 'Экранное время', route: '/(app)/screen-time' },
            ],
        },
        {
            key: 'о продукте',
            label: 'О продукте',
            subItems: [
                { label: 'Как это работает' },
                { label: 'Обратная связь' },
                { label: 'Поделиться с другом' },
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
                                <Text style={styles.userName}>{displayName}</Text>
                                <Text style={styles.subscriptionLevel}>{displaySubscription}</Text>
                                <TouchableOpacity
                                    style={styles.logoutButton}
                                    onPress={handleLogout}
                                    activeOpacity={0.7}
                                >
                                    <Image source={require('../../icons/back.png')} style={{ width: scale(12), height: scale(12), tintColor: colors.text }} resizeMode="contain" />
                                    <Text style={styles.logoutText}>Выйти</Text>
                                </TouchableOpacity>
                            </View>
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
                                                onPress={() => handleSubItemPress(subItem.route)}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.subItemText}>{subItem.label}</Text>
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
                            <TouchableOpacity activeOpacity={0.7}>
                                <Text style={styles.faqText}>FAQ</Text>
                            </TouchableOpacity>
                            <View style={styles.footerDivider} />
                            <TouchableOpacity activeOpacity={0.7}>
                                <Text style={styles.privacyText}>
                                    Политика{'\n'}Конфиденциальности
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    sidebar: {
        position: 'absolute',
        right: 0,
        top: scale(80),
        bottom: scale(60),
        width: SIDEBAR_WIDTH,
        backgroundColor: colors.surfaceLight,
        paddingTop: scale(24),
        paddingHorizontal: scale(16),
        paddingBottom: scale(20),
        justifyContent: 'space-between',
        borderTopLeftRadius: scale(20),
        borderBottomLeftRadius: scale(20),
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
    },
    userName: {
        color: colors.text,
        fontFamily: fonts.heading.bold,
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 16,
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
