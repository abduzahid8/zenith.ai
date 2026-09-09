import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { ANIMATIONS } from '../../utils/animations';
import { IssuedCredential } from '../../domain/credentials/types';

interface Props {
    visible: boolean;
    credential: IssuedCredential | null;
    onVerify: () => void;
    onShare: () => void;
    onClose: () => void;
}

/**
 * Issuance celebration in the session badge-modal language:
 * dark card, gold border + glow, big emoji, uppercase gold kicker,
 * Haptics success on appearance.
 */
export const CredentialCelebration: React.FC<Props> = ({ visible, credential, onVerify, onShare, onClose }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    useEffect(() => {
        if (visible && Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onClose}>
            <BlurView intensity={80} tint="dark" style={styles.backdrop}>
                <Animated.View entering={ANIMATIONS.ModalEntrance} style={styles.card}>
                    <Text style={styles.emoji}>🏆</Text>
                    <Text style={styles.kicker}>New achievement!</Text>
                    <Text style={styles.title}>{credential?.programTitle ?? 'Credential earned'}</Text>
                    <Text style={styles.meta}>
                        {credential ? `${credential.credentialId} · ${Math.round(credential.finalScore)}% (${credential.grade})` : ''}
                    </Text>
                    <TouchableOpacity style={styles.goldBtn} onPress={onVerify} activeOpacity={0.85}>
                        <Text style={styles.goldBtnText}>Open verification</Text>
                    </TouchableOpacity>
                    <View style={styles.row}>
                        <TouchableOpacity style={styles.ghostBtn} onPress={onShare} activeOpacity={0.8}>
                            <Text style={styles.ghostText}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.ghostBtn} onPress={onClose} activeOpacity={0.8}>
                            <Text style={styles.ghostText}>Keep learning</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </BlurView>
        </Modal>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        backdrop: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: scale(32),
        },
        card: {
            backgroundColor: '#1E1E2E',
            borderWidth: 1.5,
            borderColor: '#FFE082',
            borderRadius: scale(24),
            paddingHorizontal: scale(24),
            paddingVertical: scale(28),
            width: '100%',
            alignItems: 'center',
            shadowColor: '#FFE082',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 8,
        },
        emoji: {
            fontSize: scale(72),
            marginBottom: scale(8),
        },
        kicker: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#FFE082',
            marginBottom: scale(10),
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            lineHeight: scale(26),
            color: '#FFFFFF',
            textAlign: 'center',
            marginBottom: scale(6),
        },
        meta: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            marginBottom: scale(20),
        },
        goldBtn: {
            backgroundColor: '#FFE082',
            borderRadius: scale(50),
            paddingVertical: scale(14),
            paddingHorizontal: scale(32),
            width: '100%',
            alignItems: 'center',
            marginBottom: scale(10),
        },
        goldBtnText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#1E1E2E',
        },
        row: {
            flexDirection: 'row',
            gap: scale(10),
        },
        ghostBtn: {
            flex: 1,
            borderRadius: scale(50),
            paddingVertical: scale(12),
            alignItems: 'center',
            backgroundColor: 'rgba(255,255,255,0.12)',
        },
        ghostText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#FFFFFF',
        },
    });

export default CredentialCelebration;
