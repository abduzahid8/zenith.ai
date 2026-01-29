import React, { useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    TouchableWithoutFeedback,
} from 'react-native';
import {
    Ionicons
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

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
    const slideAnim = useRef(new Animated.Value(SIDEBAR_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // Animation values for spring animation on click
    const scaleAnims = useRef({
        основное: new Animated.Value(1),
        развитие: new Animated.Value(1),
        управление: new Animated.Value(1),
        'о продукте': new Animated.Value(1),
    }).current;

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
    }, [visible]);

    const handleLogout = () => {
        onClose();
        signOut();
        setTimeout(() => {
            router.replace('/');
        }, 300);
    };

    const handleNavItemPress = (item: 'основное' | 'развитие' | 'управление' | 'о продукте') => {
        // Spring animation with mass: 1, stiffness: 45, damping: 15
        Animated.sequence([
            Animated.spring(scaleAnims[item], {
                toValue: 0.95,
                useNativeDriver: true,
                speed: 45,
                bounciness: 15,
            }),
            Animated.spring(scaleAnims[item], {
                toValue: 1,
                useNativeDriver: true,
                speed: 45,
                bounciness: 15,
            }),
        ]).start();

        // Navigation logic - can be extended based on routes
        onClose();
        setTimeout(() => {
            switch (item) {
                case 'основное':
                    router.push('/home' as any);
                    break;
                case 'развитие':
                    // Add route when available
                    break;
                case 'управление':
                    // Add route when available
                    break;
                case 'о продукте':
                    // Add route when available
                    break;
            }
        }, 300);
    };

    const navigationItems = [
        { key: 'основное' as const, label: 'Основное' },
        { key: 'развитие' as const, label: 'Развитие' },
        { key: 'управление' as const, label: 'Управление' },
        { key: 'о продукте' as const, label: 'О продукте' },
    ];

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
                {/* Overlay */}
                <TouchableWithoutFeedback onPress={onClose}>
                    <Animated.View
                        style={[
                            styles.overlay,
                            { opacity: fadeAnim },
                        ]}
                    />
                </TouchableWithoutFeedback>

                {/* Sidebar */}
                <Animated.View
                    style={[
                        styles.sidebar,
                        {
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                >
                    {/* User Profile Section */}
                    <View style={styles.profileSection}>
                        <View style={styles.profileHeader}>
                            <View style={styles.userIconContainer}>
                                <Ionicons name="person" size={22} color="#FFFFFF" />
                            </View>
                            <View style={styles.userInfo}>
                                <Text style={styles.userName}>User Name</Text>
                                <Text style={styles.subscriptionLevel}>Level of Subscription</Text>
                                <TouchableOpacity
                                    style={styles.logoutButton}
                                    onPress={handleLogout}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="log-out-outline" size={scale(12)} color="#000" />
                                    <Text style={styles.logoutText}>Выйти</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Navigation Items */}
                    <View style={styles.navigationSection}>
                        {navigationItems.map((item) => (
                            <Animated.View
                                key={item.key}
                                style={[
                                    styles.navItemContainer,
                                    { transform: [{ scale: scaleAnims[item.key] }] },
                                ]}
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.navItem,
                                        activeItem === item.key && styles.navItemActive,
                                    ]}
                                    onPress={() => handleNavItemPress(item.key)}
                                    activeOpacity={0.7}
                                >
                                    <Text
                                        style={[
                                            styles.navItemText,
                                            activeItem === item.key && styles.navItemTextActive,
                                        ]}
                                    >
                                        {item.label}
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        ))}
                    </View>

                    {/* Footer Section */}
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

const styles = StyleSheet.create({
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
        backgroundColor: '#FFFFFF',
        paddingTop: scale(24),
        paddingHorizontal: scale(16),
        paddingBottom: scale(20),
        justifyContent: 'space-between',
        borderTopLeftRadius: scale(20),
        borderBottomLeftRadius: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 10,
    },

    // Profile Section
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
        backgroundColor: '#000000',
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
        color: '#000',
        fontFamily: 'Gramatika-Bold',
        fontSize: 14,
        fontWeight: '700',
        lineHeight: 16,
    },
    subscriptionLevel: {
        color: '#000',
        fontFamily: 'Geometria-Light',
        fontSize: 8,
        fontWeight: '300',
        lineHeight: 12,
        marginTop: 2,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    logoutText: {
        color: '#000',
        fontFamily: 'Gramatika-Bold',
        fontSize: 10,
        fontWeight: '700',
        lineHeight: 22,
        marginLeft: scale(4),
    },

    // Navigation Section
    navigationSection: {
        flex: 1,
        marginTop: scale(40),
    },
    navItemContainer: {
        marginBottom: scale(8),
    },
    navItem: {
        paddingVertical: scale(4),
    },
    navItemActive: {
        // Active state styling if needed
    },
    navItemText: {
        color: '#000',
        fontFamily: 'Gramatika-Bold',
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 22,
    },
    navItemTextActive: {
        // Could add underline or different styling for active state
    },

    // Footer Section
    footerSection: {
        marginTop: 'auto',
    },
    footerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    faqText: {
        color: '#000',
        fontFamily: 'Gramatika-Regular',
        fontSize: 10,
        lineHeight: 14,
    },
    footerDivider: {
        width: 1,
        height: scale(24),
        backgroundColor: '#000',
        marginHorizontal: scale(8),
    },
    privacyText: {
        color: '#000',
        fontFamily: 'Gramatika-Regular',
        fontSize: 10,
        lineHeight: 14,
    },
});

// Keep backward compatibility with MenuDrawer name
export const MenuDrawer = NavigationSidebar;

export default NavigationSidebar;
