import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Image } from 'react-native';
import { colors, fonts } from '../theme';
import { scale } from '../constants';

interface TaskFeedbackModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (feedback: { difficulty_rating: number; engagement_rating: number; user_notes: string }) => void;
    taskTitle: string;
}

const StarRating = ({ rating, onRate, maxStars = 5, label }: { rating: number, onRate: (r: number) => void, maxStars?: number, label: string }) => {
    return (
        <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>{label}</Text>
            <View style={styles.starsRow}>
                {[...Array(maxStars)].map((_, i) => (
                    <TouchableOpacity key={i} onPress={() => onRate(i + 1)}>
                        <Image
                            source={require('../../icons/star.png')} // Assuming star icon exists, or use a placeholder/vector icon if needed
                            style={[
                                styles.starIcon,
                                { tintColor: i < rating ? '#FFD700' : '#E0E0E0' }
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

const EmojiRating = ({ rating, onRate, label }: { rating: number, onRate: (r: number) => void, label: string }) => {
    return (
        <View style={styles.ratingContainer}>
            <Text style={styles.ratingLabel}>{label}</Text>
            <View style={styles.emojisRow}>
                {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity key={r} onPress={() => onRate(r)} style={[styles.emojiBtn, rating === r && styles.emojiSelected]}>
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
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <Text style={styles.title}>Задача выполнена!</Text>
                    <Text style={styles.subtitle}>{taskTitle}</Text>

                    <StarRating
                        label="Как сложно было?"
                        rating={difficulty}
                        onRate={setDifficulty}
                    />

                    <EmojiRating
                        label="Как тебе задача?"
                        rating={engagement}
                        onRate={setEngagement}
                    />

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Заметки (необязательно)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Что можно улучшить?"
                            placeholderTextColor="#999"
                            multiline
                            value={notes}
                            onChangeText={setNotes}
                        />
                    </View>

                    <View style={styles.buttonsRow}>
                        <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                            <Text style={styles.skipText}>Пропустить</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                            <Text style={styles.submitText}>Готово</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
    },
    container: {
        backgroundColor: 'white',
        borderRadius: scale(20),
        padding: scale(24),
        width: '100%',
        alignItems: 'center',
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        color: colors.dark,
        marginBottom: scale(8),
    },
    subtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: '#666',
        marginBottom: scale(24),
        textAlign: 'center',
    },
    ratingContainer: {
        marginBottom: scale(20),
        width: '100%',
        alignItems: 'center',
    },
    ratingLabel: {
        fontFamily: fonts.body.medium,
        fontSize: scale(16),
        color: colors.dark,
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
        backgroundColor: '#F5F5F5',
    },
    emojiSelected: {
        backgroundColor: '#E0F7FA',
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
        color: '#666',
        marginBottom: scale(8),
    },
    input: {
        backgroundColor: '#F5F5F5',
        borderRadius: scale(12),
        padding: scale(12),
        height: scale(80),
        textAlignVertical: 'top',
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
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
    submitButton: {
        backgroundColor: colors.dark,
        paddingVertical: scale(12),
        paddingHorizontal: scale(32),
        borderRadius: scale(16),
    },
    submitText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(16),
        color: 'white',
    },
});
