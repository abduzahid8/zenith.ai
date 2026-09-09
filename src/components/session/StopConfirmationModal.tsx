import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

export interface StopConfirmationModalProps {
    visible: boolean;
    dontShowAgainChecked: boolean;
    onToggleDontShowAgain: () => void;
    onCancel: () => void;
    onConfirm: () => void;
    titleOverride?: string;
    messageOverride?: string;
    confirmLabelOverride?: string;
    cancelLabelOverride?: string;
    hideDontShowAgain?: boolean;
}

const StopConfirmationModal: React.FC<StopConfirmationModalProps> = ({
    visible,
    dontShowAgainChecked,
    onToggleDontShowAgain,
    onCancel,
    onConfirm,
    titleOverride,
    messageOverride,
    confirmLabelOverride,
    cancelLabelOverride,
    hideDontShowAgain,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (!visible) return null;

    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                {/* Red Hand Icon */}
                <View style={styles.iconWrapper}>
                    <Image
                        source={require('../../../icons/stop 1.png')}
                        style={{ width: scale(80), height: scale(80) }}
                        resizeMode="contain"
                    />
                </View>

                <Text style={styles.modalTitle}>{titleOverride ?? 'Вы действительно хотите завершить занятие?'}</Text>

                {messageOverride ? (
                    <Text style={styles.modalMessage}>{messageOverride}</Text>
                ) : null}

                {/* Checkbox */}
                {!hideDontShowAgain && (
                    <TouchableOpacity
                        style={styles.checkboxContainer}
                        activeOpacity={0.8}
                        onPress={() => {
                            console.log('[StopConfirmationModal] Toggle dont show again - current:', dontShowAgainChecked, 'new:', !dontShowAgainChecked);
                            onToggleDontShowAgain();
                        }}
                    >
                        <Image
                            source={dontShowAgainChecked ? require('../../../icons/Vector.png') : require('../../../icons/checkbox-empty.png')}
                            style={{ width: scale(20), height: scale(20), marginRight: scale(10), tintColor: '#FFFFFF' }}
                            resizeMode="contain"
                        />
                        <Text style={styles.checkboxLabel}>Больше не показывать</Text>
                    </TouchableOpacity>
                )}

                {/* Buttons */}
                <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalButtonGray} onPress={() => {
                        console.log('[StopConfirmationModal] Cancel pressed');
                        onCancel();
                    }}>
                        <Text style={styles.modalButtonText}>{cancelLabelOverride ?? 'Назад'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalButtonGray} onPress={() => {
                        console.log('[StopConfirmationModal] Confirm stop pressed');
                        onConfirm();
                    }}>
                        <Text style={styles.modalButtonTextBold}>{confirmLabelOverride ?? 'Завершить'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFill,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
    },
    modalContainer: {
        width: '85%',
        backgroundColor: colors.surfaceLight || 'white',
        borderRadius: scale(24),
        padding: scale(24),
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 10,
    },
    iconWrapper: {
        marginBottom: scale(20),
        alignItems: 'center',
        justifyContent: 'center',
        width: scale(80),
        height: scale(80),
    },
    modalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: colors.text,
        textAlign: 'center',
        marginBottom: scale(12),
        lineHeight: scale(26),
    },
    modalMessage: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: scale(24),
        lineHeight: scale(20),
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: scale(32),
    },
    checkboxLabel: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
    },
    modalButtonsRow: {
        flexDirection: 'row',
        gap: scale(12),
        width: '100%',
    },
    modalButtonGray: {
        flex: 1,
        backgroundColor: colors.buttonSecondary || colors.sessionTimer.checkboxOff,
        borderRadius: scale(14),
        paddingVertical: scale(16),
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalButtonText: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(16),
        color: colors.text,
    },
    modalButtonTextBold: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
    },
});

export default StopConfirmationModal;
