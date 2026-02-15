import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

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
                return colors.error;
            case 'info':
                return colors.link;
            default:
                return colors.warning;
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
        backgroundColor: colors.warningModal.surface,
        borderRadius: scale(20),
        padding: scale(24),
        alignItems: 'center',
        shadowColor: colors.warningModal.shadow,
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
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.black,
        textAlign: 'center',
        marginBottom: scale(12),
    },
    message: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
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
        backgroundColor: colors.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.black,
    },
    confirmButton: {
        flex: 1,
        height: scale(52),
        borderRadius: scale(26),
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmButtonDefault: {
        backgroundColor: colors.warningModal.confirmDefault,
    },
    confirmButtonDanger: {
        backgroundColor: colors.error,
    },
    confirmButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.black,
    },
});

export default WarningModal;
