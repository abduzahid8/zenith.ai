import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { TIMER_PICKER_PRESETS } from '../../domain/sessions/sessionDurations';

export interface TimePickerModalProps {
    visible: boolean;
    currentDuration: number;
    onSelect: (durationMinutes: number) => void;
    onClose: () => void;
}

const PRESETS = [...TIMER_PICKER_PRESETS];

const TimePickerModal: React.FC<TimePickerModalProps> = ({
    visible,
    currentDuration,
    onSelect,
    onClose,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const currentMinutes = Math.floor(currentDuration / 60);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.container}>
                    <Text style={styles.title}>Выберите длительность</Text>
                    <View style={styles.optionsGrid}>
                        {PRESETS.map((mins) => (
                            <TouchableOpacity
                                key={mins}
                                style={[
                                    styles.optionButton,
                                    currentMinutes === mins && styles.selectedOption
                                ]}
                                onPress={() => {
                                    console.log('[TimePickerModal] Duration selected:', mins, 'minutes');
                                    onSelect(mins);
                                    onClose();
                                }}
                            >
                                <Text style={[
                                    styles.optionText,
                                    currentMinutes === mins && styles.selectedOptionText
                                ]}>
                                    {mins} мин
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <TouchableOpacity style={styles.closeButton} onPress={() => {
                        console.log('[TimePickerModal] Cancel pressed');
                        onClose();
                    }}>
                        <Text style={styles.closeButtonText}>Отмена</Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    container: {
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
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
        color: colors.text,
        marginBottom: scale(20),
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: scale(12),
        marginBottom: scale(24),
    },
    optionButton: {
        paddingVertical: scale(12),
        paddingHorizontal: scale(20),
        borderRadius: scale(16),
        backgroundColor: colors.sessionTimer.primaryFaded,
        minWidth: scale(100),
        alignItems: 'center',
    },
    selectedOption: {
        backgroundColor: colors.sessionTimer.primary,
    },
    optionText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.sessionTimer.primary,
    },
    selectedOptionText: {
        color: 'white',
    },
    closeButton: {
        width: '100%',
        paddingVertical: scale(14),
        borderRadius: scale(14),
        backgroundColor: colors.buttonSecondary || '#F1F1F1',
        alignItems: 'center',
    },
    closeButtonText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.textSecondary,
    },
});

export default TimePickerModal;
