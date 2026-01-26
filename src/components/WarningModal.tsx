import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

interface WarningModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'warning' | 'danger' | 'info';
}

export const WarningModal: React.FC<WarningModalProps> = ({
    visible,
    title,
    message,
    confirmText = 'Подтвердить',
    cancelText = 'Отмена',
    onConfirm,
    onCancel,
    type = 'warning',
}) => {
    const getIconColor = () => {
        switch (type) {
            case 'danger':
                return '#FF3B30';
            case 'info':
                return '#007AFF';
            default:
                return '#FF9500';
        }
    };

    const getIconName = (): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case 'danger':
                return 'alert-circle';
            case 'info':
                return 'information-circle';
            default:
                return 'warning';
        }
    };

    const getConfirmButtonStyle = () => {
        switch (type) {
            case 'danger':
                return styles.confirmButtonDanger;
            default:
                return styles.confirmButtonDefault;
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
            statusBarTranslucent
        >
            <TouchableWithoutFeedback onPress={onCancel}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={styles.modal}>
                            {/* Icon */}
                            <View style={[styles.iconContainer, { backgroundColor: `${getIconColor()}20` }]}>
                                <Ionicons
                                    name={getIconName()}
                                    size={scale(40)}
                                    color={getIconColor()}
                                />
                            </View>

                            {/* Title */}
                            <Text style={styles.title}>{title}</Text>

                            {/* Message */}
                            <Text style={styles.message}>{message}</Text>

                            {/* Buttons */}
                            <View style={styles.buttonRow}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={onCancel}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.cancelButtonText}>{cancelText}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.confirmButton, getConfirmButtonStyle()]}
                                    onPress={onConfirm}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.confirmButtonText}>{confirmText}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(24),
    },
    modal: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: scale(20),
        padding: scale(24),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10,
    },
    iconContainer: {
        width: scale(72),
        height: scale(72),
        borderRadius: scale(36),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(16),
    },
    title: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(22),
        color: '#000',
        textAlign: 'center',
        marginBottom: scale(12),
    },
    message: {
        fontFamily: 'Gramatika-Regular',
        fontSize: scale(16),
        color: '#666',
        textAlign: 'center',
        lineHeight: scale(24),
        marginBottom: scale(24),
    },
    buttonRow: {
        flexDirection: 'row',
        gap: scale(12),
        width: '100%',
    },
    cancelButton: {
        flex: 1,
        height: scale(52),
        borderRadius: scale(26),
        backgroundColor: '#F5F5F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: scale(16),
        color: '#000',
    },
    confirmButton: {
        flex: 1,
        height: scale(52),
        borderRadius: scale(26),
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonDefault: {
        backgroundColor: '#E8E4DF',
    },
    confirmButtonDanger: {
        backgroundColor: '#FF3B30',
    },
    confirmButtonText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        color: '#000',
    },
});

export default WarningModal;
