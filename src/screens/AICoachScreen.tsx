import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../theme';
import { scaleWidth, scaleHeight, scaleFont } from '../theme/responsive';
import { useUserProfileStore } from '../store/userProfileStore';
import { aiService, ChatMessage } from '../services/ai';
import { BottomNavigation } from '../components/BottomNavigation';

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const AICoachScreen: React.FC = () => {
    const router = useRouter();
    const { selectedHobby } = useUserProfileStore();
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Initial greeting
    useEffect(() => {
        const hobbyName = selectedHobby === 'chess' ? 'шахматами' :
            selectedHobby === 'video_editing' ? 'видео монтажом' :
                selectedHobby === 'drawing' ? 'рисованием' : 'хобби';

        setMessages([
            {
                id: '1',
                role: 'assistant',
                content: `Привет! Я твой ИИ-наставник по ${hobbyName}. Можешь задать любой вопрос или поделиться своим прогрессом 🎯`,
                timestamp: new Date(),
            },
        ]);
    }, [selectedHobby]);

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: DisplayMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        // Scroll to bottom
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            // Prepare messages for API
            const chatMessages: ChatMessage[] = messages
                .map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }))
                .concat([{ role: 'user', content: userMessage.content }]);

            const response = await aiService.sendMessage(chatMessages, selectedHobby || undefined);

            const assistantMessage: DisplayMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: DisplayMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Извините, произошла ошибка. Попробуйте еще раз.',
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const renderMessage = ({ item }: { item: DisplayMessage }) => (
        <View
            style={[
                styles.messageContainer,
                item.role === 'user' ? styles.userMessage : styles.assistantMessage,
            ]}
        >
            <Text
                style={[
                    styles.messageText,
                    item.role === 'user' ? styles.userMessageText : styles.assistantMessageText,
                ]}
            >
                {item.content}
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Image source={require('../../icons/back.png')} style={{ width: scaleWidth(24), height: scaleWidth(24), tintColor: colors.text }} resizeMode="contain" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>ИИ-тренер</Text>
                <View style={styles.placeholder} />
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.messagesContainer}
                showsVerticalScrollIndicator={false}
            />

            {/* Loading indicator */}
            {isLoading && (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>Думаю...</Text>
                </View>
            )}

            {/* Input */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Напиши сообщение..."
                        placeholderTextColor={colors.textLight}
                        multiline
                        maxLength={500}
                    />
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                        ]}
                        onPress={handleSend}
                        disabled={!inputText.trim() || isLoading}
                    >
                        <Ionicons
                            name="send"
                            size={20}
                            color={inputText.trim() && !isLoading ? colors.text : colors.textLight}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <BottomNavigation activeTab="ai-coach" />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.md),
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceLight,
    },
    backButton: {
        padding: scaleWidth(8),
    },
    headerTitle: {
        fontFamily: typography.h3.fontFamily,
        fontSize: scaleFont(18),
        color: colors.text,
    },
    placeholder: {
        width: scaleWidth(40),
    },
    messagesContainer: {
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.md),
    },
    messageContainer: {
        maxWidth: '80%',
        marginBottom: scaleHeight(spacing.md),
        padding: scaleWidth(spacing.md),
        borderRadius: borderRadius.md,
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: colors.text,
    },
    assistantMessage: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceLight,
    },
    messageText: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(15),
        lineHeight: scaleHeight(22),
    },
    userMessageText: {
        color: colors.background,
    },
    assistantMessageText: {
        color: colors.text,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scaleHeight(spacing.sm),
        gap: scaleWidth(8),
    },
    loadingText: {
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(14),
        color: colors.textSecondary,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: scaleWidth(spacing.lg),
        paddingVertical: scaleHeight(spacing.md),
        borderTopWidth: 1,
        borderTopColor: colors.surfaceLight,
        backgroundColor: colors.background,
    },
    input: {
        flex: 1,
        minHeight: scaleHeight(44),
        maxHeight: scaleHeight(120),
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.lg,
        paddingHorizontal: scaleWidth(spacing.md),
        paddingVertical: scaleHeight(12),
        fontFamily: typography.body.fontFamily,
        fontSize: scaleFont(16),
        color: colors.text,
        marginRight: scaleWidth(spacing.sm),
    },
    sendButton: {
        width: scaleWidth(44),
        height: scaleWidth(44),
        borderRadius: scaleWidth(22),
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: colors.surfaceLight,
    },
});

export default AICoachScreen;
