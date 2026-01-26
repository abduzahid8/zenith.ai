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
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors } from '../theme';
import { useAuthStore } from '../store/authStore';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

const DRAWER_WIDTH = scale(280);

interface MenuDrawerProps {
    visible: boolean;
    onClose: () => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({ visible, onClose }) => {
    const router = useRouter();
    const { isPremium, signOut, selectedHobby } = useAuthStore();
    const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
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
                    toValue: DRAWER_WIDTH,
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

    const getHobbyIcon = () => {
        switch (selectedHobby) {
            case 'chess':
                return '♞';
            case 'video_editing':
                return '🎬';
            case 'drawing':
                return '🎨';
            default:
                return '🎯';
        }
    };

    const getHobbyName = () => {
        switch (selectedHobby) {
            case 'chess':
                return 'Шахматы';
            case 'video_editing':
                return 'Видеомонтаж';
            case 'drawing':
                return 'Рисование';
            default:
                return 'Хобби';
        }
    };

    const handleNavigate = (route: string) => {
        onClose();
        setTimeout(() => {
            router.push(route as any);
        }, 300);
    };

    const handleLogout = () => {
        onClose();
        signOut();
        setTimeout(() => {
            router.replace('/');
        }, 300);
    };

    const menuItems = [
        {
            icon: 'person-outline' as const,
            label: 'Профиль',
            onPress: () => handleNavigate('/profile-complete'),
        },
        {
            icon: 'star-outline' as const,
            label: isPremium ? 'Premium активен' : 'Получить Premium',
            onPress: () => handleNavigate('/subscription'),
            highlight: !isPremium,
        },
        {
            icon: 'notifications-outline' as const,
            label: 'Уведомления',
            onPress: () => { },
        },
        {
            icon: 'settings-outline' as const,
            label: 'Настройки',
            onPress: () => { },
        },
        {
            icon: 'help-circle-outline' as const,
            label: 'Помощь',
            onPress: () => { },
        },
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

                {/* Drawer */}
                <Animated.View
                    style={[
                        styles.drawer,
                        {
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                >
                    {/* Close button */}
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Feather name="x" size={scale(24)} color="#000" />
                    </TouchableOpacity>

                    {/* Profile Section */}
                    <View style={styles.profileSection}>
                        <View style={styles.avatarContainer}>
                            <Text style={styles.avatarEmoji}>{getHobbyIcon()}</Text>
                        </View>
                        <Text style={styles.hobbyName}>{getHobbyName()}</Text>
                        {isPremium && (
                            <View style={styles.premiumBadge}>
                                <Text style={styles.premiumText}>Premium</Text>
                            </View>
                        )}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Menu Items */}
                    <View style={styles.menuItems}>
                        {menuItems.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[
                                    styles.menuItem,
                                    item.highlight && styles.menuItemHighlight,
                                ]}
                                onPress={item.onPress}
                                activeOpacity={0.7}
                            >
                                <Ionicons
                                    name={item.icon}
                                    size={scale(24)}
                                    color={item.highlight ? '#1AFFD5' : '#000'}
                                />
                                <Text
                                    style={[
                                        styles.menuItemText,
                                        item.highlight && styles.menuItemTextHighlight,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Logout at bottom */}
                    <View style={styles.bottomSection}>
                        <View style={styles.divider} />
                        <TouchableOpacity
                            style={styles.logoutButton}
                            onPress={handleLogout}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="log-out-outline" size={scale(24)} color="#FF3B30" />
                            <Text style={styles.logoutText}>Выйти</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    drawer: {
        width: DRAWER_WIDTH,
        height: '100%',
        backgroundColor: '#FFFFFF',
        paddingTop: scale(60),
        paddingHorizontal: scale(20),
        shadowColor: '#000',
        shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    closeButton: {
        position: 'absolute',
        top: scale(50),
        right: scale(20),
        width: scale(40),
        height: scale(40),
        borderRadius: scale(20),
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    profileSection: {
        alignItems: 'center',
        marginTop: scale(20),
        marginBottom: scale(24),
    },
    avatarContainer: {
        width: scale(80),
        height: scale(80),
        borderRadius: scale(40),
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    avatarEmoji: {
        fontSize: scale(40),
    },
    hobbyName: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(20),
        color: '#000',
        marginBottom: scale(8),
    },
    premiumBadge: {
        backgroundColor: '#1AFFD5',
        paddingHorizontal: scale(12),
        paddingVertical: scale(4),
        borderRadius: scale(12),
    },
    premiumText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: scale(12),
        color: '#000',
    },
    divider: {
        height: 1,
        backgroundColor: '#E0E0E0',
        marginVertical: scale(16),
    },
    menuItems: {
        flex: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(14),
        paddingHorizontal: scale(12),
        borderRadius: scale(12),
        marginBottom: scale(4),
    },
    menuItemHighlight: {
        backgroundColor: 'rgba(26, 255, 213, 0.1)',
    },
    menuItemText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(16),
        color: '#000',
        marginLeft: scale(16),
    },
    menuItemTextHighlight: {
        color: '#15211F',
        fontFamily: 'Gramatika-Medium',
    },
    bottomSection: {
        marginBottom: scale(40),
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: scale(14),
        paddingHorizontal: scale(12),
    },
    logoutText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: scale(16),
        color: '#FF3B30',
        marginLeft: scale(16),
    },
});

export default MenuDrawer;
