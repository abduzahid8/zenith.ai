import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

interface ConfirmModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    content: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    visible,
    onClose,
    onConfirm,
    title,
    content,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isDestructive = false,
}) => {
    const { colors } = useAppTheme();

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableWithoutFeedback>
                        <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                            <View style={styles.header}>
                                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Image source={require('../../../icons/back.png')} style={[styles.closeIcon, { tintColor: colors.text, transform: [{ rotate: '180deg' }] }]} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                <Text style={[styles.contentText, { color: colors.textSecondary }]}>
                                    {content}
                                </Text>
                            </View>

                            <View style={styles.footer}>
                                <TouchableOpacity 
                                    style={[styles.button, styles.cancelButton, { backgroundColor: colors.background }]} 
                                    onPress={onClose}
                                >
                                    <Text style={[styles.buttonText, { color: colors.text }]}>
                                        {cancelText}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={[styles.button, styles.confirmButton, { backgroundColor: isDestructive ? colors.error : colors.buttonPrimary }]} 
                                    onPress={() => {
                                        onClose();
                                        onConfirm();
                                    }}
                                >
                                    <Text style={[styles.buttonText, { color: colors.white }]}>
                                        {confirmText}
                                    </Text>
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
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    container: {
        width: '100%',
        maxWidth: scale(320),
        borderRadius: scale(24),
        padding: scale(24),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(16),
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
    },
    closeIcon: {
        width: scale(20),
        height: scale(20),
    },
    content: {
        marginBottom: scale(24),
    },
    contentText: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
    },
    footer: {
        flexDirection: 'row',
        gap: scale(12),
    },
    button: {
        flex: 1,
        height: scale(48),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    confirmButton: {
    },
    buttonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
});

export default ConfirmModal;
