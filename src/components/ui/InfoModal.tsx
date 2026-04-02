import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Animated,
    Image,
    Share,
    Clipboard,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

interface InfoModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    content?: string;
    type?: 'info' | 'share';
    shareLink?: string;
}

export const InfoModal: React.FC<InfoModalProps> = ({
    visible,
    onClose,
    title,
    content,
    type = 'info',
    shareLink,
}) => {
    const { colors } = useAppTheme();
    const [copied, setCopied] = React.useState(false);

    const handleShare = async () => {
        if (!shareLink) return;
        try {
            await Share.share({
                message: `Присоединяйся к Zenyth AI! 🚀\n${shareLink}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    const handleCopyToClipboard = () => {
        if (!shareLink) return;
        Clipboard.setString(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                                    <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.content}>
                                {type === 'info' ? (
                                    <Text style={[styles.contentText, { color: colors.textSecondary }]}>
                                        {content}
                                    </Text>
                                ) : (
                                    <View style={styles.shareContainer}>
                                        <Text style={[styles.shareLabel, { color: colors.textSecondary }]}>
                                            Поделись ссылкой с друзьями:
                                        </Text>
                                        <TouchableOpacity 
                                            style={[styles.linkContainer, { backgroundColor: colors.background }]}
                                            onPress={handleCopyToClipboard}
                                        >
                                            <Text style={[styles.linkText, { color: colors.text }]} numberOfLines={1}>
                                                {shareLink}
                                            </Text>
                                            <Text style={[styles.copyText, { color: colors.sessionTimer.primary }]}>
                                                {copied ? 'Скопировано!' : 'Копировать'}
                                            </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            style={[styles.shareButton, { backgroundColor: colors.buttonPrimary }]}
                                            onPress={handleShare}
                                        >
                                            <Text style={[styles.shareButtonText, { color: colors.white }]}>
                                                Отправить друзьям
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity 
                                style={[styles.doneButton, { backgroundColor: colors.sessionTimer.primaryFaded }]} 
                                onPress={onClose}
                            >
                                <Text style={[styles.doneButtonText, { color: colors.sessionTimer.primary }]}>
                                    Понятно
                                </Text>
                            </TouchableOpacity>
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
        marginBottom: scale(20),
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
    },
    closeIcon: {
        fontSize: scale(20),
        fontWeight: '500',
    },
    content: {
        marginBottom: scale(24),
    },
    contentText: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
    },
    shareContainer: {
        gap: scale(16),
    },
    shareLabel: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(14),
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: scale(12),
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    linkText: {
        flex: 1,
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        marginRight: scale(10),
    },
    copyText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(12),
    },
    shareButton: {
        height: scale(48),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    shareButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
    doneButton: {
        height: scale(48),
        borderRadius: scale(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    doneButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
});

export default InfoModal;
