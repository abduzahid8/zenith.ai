import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';

export interface StopConfirmationModalProps {
    visible: boolean;
    dontShowAgainChecked: boolean;
    onToggleDontShowAgain: () => void;
    onCancel: () => void;
    onConfirm: () => void;
}

const StopConfirmationModal: React.FC<StopConfirmationModalProps> = ({
    visible,
    dontShowAgainChecked,
    onToggleDontShowAgain,
    onCancel,
    onConfirm,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    if (!visible) return null;

    return (
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                {/* Red Hand Icon */}
                <View style={styles.iconWrapper}>
                    <Svg width={scale(80)} height={scale(80)} viewBox="0 0 100 100" fill="none" style={{ position: 'absolute' }}>
                        <Circle cx="50" cy="50" r="50" fill={colors.sessionTimer.stopRed} />
                    </Svg>
                    <Image source={require('../../../icons/stop.png')} style={{ width: scale(40), height: scale(40), tintColor: 'white' }} resizeMode="contain" />
                </View>

                <Text style={styles.modalTitle}>Вы действительно хотите завершить занятие?</Text>

                {/* Checkbox */}
                <TouchableOpacity
                    style={styles.checkboxContainer}
                    activeOpacity={0.8}
                    onPress={onToggleDontShowAgain}
                >
                    <Image
                        source={dontShowAgainChecked ? require('../../../icons/checkbox-checked.png') : require('../../../icons/checkbox-empty.png')}
                        style={{ width: scale(20), height: scale(20), marginRight: scale(10), tintColor: undefined }}
                        resizeMode="contain"
                    />
                    <Text style={styles.checkboxLabel}>Больше не показывать</Text>
                </TouchableOpacity>

                {/* Buttons */}
                <View style={styles.modalButtonsRow}>
                    <TouchableOpacity style={styles.modalButtonGray} onPress={onCancel}>
                        <Text style={styles.modalButtonText}>Назад</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalButtonGray} onPress={onConfirm}>
                        <Text style={styles.modalButtonTextBold}>Завершить</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    modalOverlay: {
        ...StyleSheet.absoluteFillObject,
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
        marginBottom: scale(24),
        lineHeight: scale(26),
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
