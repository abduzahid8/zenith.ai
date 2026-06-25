import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import { fonts } from '../theme';
import { useUserProfileStore } from '../store/userProfileStore';
import { aiService, ChatMessage } from '../services/ai';
import { BottomNavigation } from '../components/BottomNavigation';
import { useAppTheme } from '../theme/useAppTheme';
import { scale } from '../constants';
import { HOBBY_META, HobbyId } from '../data/lessonContent';

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export const AICoachScreen: React.FC = () => {
    const router = useRouter();
    const { selectedHobby } = useUserProfileStore();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Initial greeting
    useEffect(() => {
        const meta = HOBBY_META[selectedHobby as HobbyId];
        const hobbyName = meta?.label?.toLowerCase() || 'хобби';

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
        const trimmedInput = inputText.trim();
        console.log('[AICoachScreen] handleSend pressed - input:', trimmedInput.substring(0, 50));
        if (!trimmedInput || isLoading) {
            console.log('[AICoachScreen] Cannot send - empty input or already loading');
            return;
        }

        const userMessage: DisplayMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: trimmedInput,
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
            console.log('[AICoachScreen] Sending message to AI service');
            // Prepare messages for API
            const chatMessages: ChatMessage[] = messages
                .map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }))
                .concat([{ role: 'user', content: userMessage.content }]);

            const response = await aiService.sendMessage(chatMessages, selectedHobby || undefined);
            console.log('[AICoachScreen] AI response received');

            const assistantMessage: DisplayMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
        } catch (error) {
            console.log('[AICoachScreen] Error sending message:', error);
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
        console.log('[AICoachScreen] handleBack pressed - navigating back');
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
                    <Image source={require('../../icons/back.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.text }} resizeMode="contain" />
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
                keyboardVerticalOffset={0}
            >
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Напиши сообщение..."
                        placeholderTextColor={colors.textSecondary}
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
                            color="#FFFFFF"
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <BottomNavigation activeTab="ai-coach" />
        </SafeAreaView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        padding: scale(8),
    },
    headerTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(18),
        color: colors.text,
    },
    placeholder: {
        width: scale(40),
    },
    messagesContainer: {
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
    },
    messageContainer: {
        maxWidth: '80%',
        marginBottom: scale(16),
        padding: scale(12),
        borderRadius: scale(16),
    },
    userMessage: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary,
    },
    assistantMessage: {
        alignSelf: 'flex-start',
        backgroundColor: colors.surfaceLight,
    },
    messageText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(15),
        lineHeight: scale(22),
    },
    userMessageText: {
        color: '#FFFFFF',
    },
    assistantMessageText: {
        color: colors.text,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: scale(8),
        gap: scale(8),
    },
    loadingText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        color: colors.textSecondary,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.background,
    },
    input: {
        flex: 1,
        minHeight: scale(44),
        maxHeight: scale(120),
        backgroundColor: colors.surfaceLight,
        borderRadius: scale(22),
        paddingHorizontal: scale(16),
        paddingVertical: scale(10),
        fontFamily: fonts.body.regular,
        fontSize: scale(16),
        color: colors.text,
        marginRight: scale(12),
    },
    sendButton: {
        width: scale(44),
        height: scale(44),
        borderRadius: scale(22),
        backgroundColor: colors.buttonPrimary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});

export default AICoachScreen;
