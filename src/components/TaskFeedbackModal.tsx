import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Image } from 'react-native';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';

interface TaskFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (feedback: { difficulty_rating: number; engagement_rating: number; user_notes: string }) => void;
    taskTitle: string;
}

const StarRating = ({ rating, onRate, maxStars = 5, label, colors }: { rating: number, onRate: (r: number) => void, maxStars?: number, label: string, colors: any }) => {
    return (
        <View style={styles.ratingContainer}>
            <Text style={[styles.ratingLabel, { color: colors.dark }]}>{label}</Text>
            <View style={styles.starsRow}>
                {[...Array(maxStars)].map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => onRate(i + 1)}>
                        <Image
                            source={require('../../icons/star.png')}
                            style={[
                                styles.starIcon,
                                { tintColor: i < rating ? '#FFD700' : colors.surface }
                            ]}
                        />
                    </TouchableOpacity>
                ))}
            </View>
            <Text style={styles.ratingText}>
                {rating === 1 ? 'Очень легко' :
                    rating === 2 ? 'Легко' :
                        rating === 3 ? 'Нормально' :
                            rating === 4 ? 'Сложно' :
                                rating === 5 ? 'Очень сложно' : ' '}
            </Text>
        </View>
    );
};

const EmojiRating = ({ rating, onRate, label, colors }: { rating: number, onRate: (r: number) => void, label: string, colors: any }) => {
    return (
        <View style={styles.ratingContainer}>
            <Text style={[styles.ratingLabel, { color: colors.dark }]}>{label}</Text>
            <View style={styles.emojisRow}>
                {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity key={r} onPress={() => onRate(r)} style={[styles.emojiBtn, { backgroundColor: colors.surfaceLight }, rating === r && styles.emojiSelected]}>
                        <Text style={styles.emojiText}>
                            {r === 1 ? '😫' : r === 2 ? '😕' : r === 3 ? '😐' : r === 4 ? '🙂' : '🤩'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};


export const TaskFeedbackModal = ({ visible, onClose, onSubmit, taskTitle }: TaskFeedbackModalProps) => {
    const [difficulty, setDifficulty] = useState(3);
    const [engagement, setEngagement] = useState(3);
    const [notes, setNotes] = useState('');
    const { colors } = useAppTheme();
    const dynamicStyles = useMemo(() => createStyles(colors), [colors]);

    const handleSubmit = () => {
        onSubmit({
            difficulty_rating: difficulty,
            engagement_rating: engagement,
            user_notes: notes
        });
        setNotes('');
        setDifficulty(3);
        setEngagement(3);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={dynamicStyles.overlay}>
                <View style={dynamicStyles.container}>
                    <Text style={dynamicStyles.title}>Задача выполнена!</Text>
                    <Text style={dynamicStyles.subtitle}>{taskTitle}</Text>

                    <StarRating
                        label="Как сложно было?"
                        rating={difficulty}
                        onRate={setDifficulty}
                        colors={colors}
                    />

                    <EmojiRating
                        label="Как тебе задача?"
                        rating={engagement}
                        onRate={setEngagement}
                        colors={colors}
                    />

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: colors.textSecondary }]}>Заметки (необязательно)</Text>
                        <TextInput
                            style={[dynamicStyles.input, { color: colors.text }]}
                            placeholder="Что можно улучшить?"
                            placeholderTextColor={colors.textLight}
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </View>

                    <View style={styles.buttonsRow}>
                        <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                            <Text style={styles.skipText}>Пропустить</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={dynamicStyles.submitButton} onPress={handleSubmit}>
                            <Text style={dynamicStyles.submitText}>Готово</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    ratingContainer: {
        marginBottom: scale(20),
        width: '100%',
        alignItems: 'center',
    },
    ratingLabel: {
        fontFamily: fonts.body.medium,
        fontSize: scale(16),
        marginBottom: scale(8),
    },
    starsRow: {
        flexDirection: 'row',
        gap: scale(8),
    },
    starIcon: {
        width: scale(32),
        height: scale(32),
    },
    ratingText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: '#888',
        marginTop: scale(4),
        height: scale(20),
    },
    emojisRow: {
        flexDirection: 'row',
        gap: scale(12),
    },
    emojiBtn: {
        padding: scale(8),
        borderRadius: scale(12),
    },
    emojiSelected: {
        backgroundColor: '#E0F7FA', // TODO test in dark mode 
        borderWidth: 1,
        borderColor: '#4DD0E1',
    },
    emojiText: {
        fontSize: scale(24),
    },
    inputContainer: {
        width: '100%',
        marginBottom: scale(24),
    },
    label: {
        fontFamily: fonts.body.medium,
        fontSize: scale(14),
        marginBottom: scale(8),
    },
    buttonsRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    skipButton: {
        padding: scale(12),
    },
    skipText: {
        fontFamily: fonts.body.medium,
        fontSize: scale(16),
        color: '#888',
    },
});

const createStyles = (colors: any) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    container: {
        backgroundColor: colors.background,
        borderRadius: scale(20),
        padding: scale(24),
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.text,
        marginBottom: scale(8),
    },
    subtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.textSecondary,
        marginBottom: scale(24),
        textAlign: 'center',
    },
    input: {
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(12),
        padding: scale(12),
        height: scale(80),
        textAlignVertical: 'top',
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
    },
    submitButton: {
        backgroundColor: colors.buttonPrimary,
        paddingVertical: scale(12),
        paddingHorizontal: scale(32),
        borderRadius: scale(16),
    },
    submitText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: colors.buttonTextPrimary,
    },
});

export default TaskFeedbackModal;
