import React, { useState, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { aiService, ChatMessage } from '../../services/ai';
import { useUserProfileStore } from '../../store/userProfileStore';
import { useAppTheme } from '../../theme/useAppTheme';

interface DisplayMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

const SendIcon = ({ color = "white" }) => (
    <Svg width={scale(15)} height={scale(15)} viewBox="0 0 25 25" fill="none">
        <Path
            d="M1.7207 24.4697C1.93894 24.5358 2.28825 24.5079 2.95801 24.2549C3.61366 24.0072 4.46761 23.5888 5.64941 23.0088L20.751 15.5977C21.9079 15.0299 22.7428 14.619 23.3359 14.2549C23.9356 13.8868 24.2008 13.6166 24.3135 13.3682C24.5622 12.8197 24.5621 12.1725 24.3135 11.624C24.2008 11.3755 23.9356 11.1044 23.3359 10.7363C22.7428 10.3723 21.9077 9.96223 20.751 9.39453L5.67578 1.99512C4.49043 1.41344 3.63313 0.994551 2.97559 0.746094C2.3035 0.492175 1.95364 0.464832 1.73535 0.53125C1.22288 0.687411 0.788236 1.10412 0.582031 1.68066C0.485874 1.94949 0.484274 2.3675 0.649414 3.12402C0.811859 3.86815 1.11147 4.84445 1.52344 6.18652L3.01758 11.0557C3.14237 11.4622 3.22438 11.7304 3.26367 11.9961H11.8428C12.1189 11.9961 12.3428 12.22 12.3428 12.4961C12.3427 12.7721 12.1188 12.9961 11.8428 12.9961H3.24414C3.19983 13.2234 3.12483 13.4678 3.02051 13.8105L1.49414 18.8262C1.08662 20.1652 0.791068 21.1394 0.630859 21.8818C0.468108 22.6362 0.470007 23.0538 0.566406 23.3223C0.773359 23.8977 1.20872 24.3144 1.7207 24.4697Z"
            fill={color}
        />
    </Svg>
);

const AICoachTab: React.FC = () => {
    const [messages, setMessages] = useState<DisplayMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const chatListRef = useRef<FlatList>(null);
    const { selectedHobby } = useUserProfileStore();

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleSend = async () => {
        if (!inputText.trim() || isLoading) return;

        const userMessage: DisplayMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: inputText.trim(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);

        setTimeout(() => {
            chatListRef.current?.scrollToEnd({ animated: true });
        }, 100);

        try {
            const chatMessages: ChatMessage[] = messages
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
                .concat([{ role: 'user', content: userMessage.content }]);

            const response = await aiService.sendMessage(chatMessages, selectedHobby || undefined);

            const assistantMessage: DisplayMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response,
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            const errorMessage: DisplayMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Извините, произошла ошибка. Попробуйте еще раз.',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            setTimeout(() => {
                chatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    };

    const handleSuggestionPress = (suggestion: string) => {
        setInputText(suggestion);
    };

    return (
        <KeyboardAvoidingView
            style={styles.aiContent}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
            {messages.length === 0 && (
                <>
                    <View style={styles.aiTitleContainer}>
                        <Text style={styles.aiTitle}>Достигни{'\n'}своего зенита!</Text>
                    </View>
                    <View style={styles.suggestionsContainer}>
                        <View style={styles.suggestionRowLeft}>
                            <TouchableOpacity
                                style={styles.suggestionButton}
                                activeOpacity={0.8}
                                onPress={() => handleSuggestionPress('Как быстрее прогрессировать?')}
                            >
                                <BlurView intensity={80} tint={'light'} style={styles.glassBackground} />
                                <Text style={styles.suggestionText}>Как быстрее прогрессировать?</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={styles.suggestionRowLeft}>
                            <TouchableOpacity
                                style={styles.suggestionButton}
                                activeOpacity={0.8}
                                onPress={() => handleSuggestionPress('Объясни мой прогресс')}
                            >
                                <BlurView intensity={80} tint={'light'} style={styles.glassBackground} />
                                <Text style={styles.suggestionText}>Объясни мой прогресс</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.suggestionButton, { marginLeft: scale(10) }]}
                                activeOpacity={0.8}
                                onPress={() => handleSuggestionPress('Что сделать сегодня?')}
                            >
                                <BlurView intensity={80} tint={'light'} style={styles.glassBackground} />
                                <Text style={styles.suggestionText}>Что сделать сегодня?</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </>
            )}

            {messages.length > 0 && (
                <FlatList
                    ref={chatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    style={styles.aiChatList}
                    contentContainerStyle={styles.aiChatContent}
                    renderItem={({ item }) => (
                        <View style={[
                            styles.aiMessageBubble,
                            item.role === 'user' ? styles.aiUserMessage : styles.aiAssistantMessage
                        ]}>
                            <Text style={[
                                styles.aiMessageText,
                                item.role === 'user' ? styles.aiUserMessageText : styles.aiAssistantMessageText
                            ]}>
                                {item.content}
                            </Text>
                        </View>
                    )}
                />
            )}

            {isLoading && (
                <View style={styles.aiLoadingContainer}>
                    <ActivityIndicator size="small" color={colors.aiCoach.darkText} />
                    <Text style={styles.aiLoadingText}>Думаю...</Text>
                </View>
            )}

            <View style={styles.aiInputContainer}>
                <View style={styles.inputButton}>
                    <BlurView intensity={80} tint={'light'} style={styles.glassBackground} />
                    <TextInput
                        style={styles.aiInput}
                        placeholder="Чем я могу помочь?"
                        placeholderTextColor={colors.aiCoach.text}
                        value={inputText}
                        onChangeText={setInputText}
                        onSubmitEditing={handleSend}
                        returnKeyType="send"
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        editable={!isLoading}
                        multiline={false}
                    />
                    <TouchableOpacity
                        onPress={handleSend}
                        activeOpacity={0.8}
                        style={[styles.sendButton, isLoading && { opacity: 0.5 }]}
                        disabled={isLoading || !inputText.trim()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SendIcon color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const createStyles = (colors: any) => StyleSheet.create({
    aiContent: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    aiTitleContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingBottom: scale(100),
    },
    aiTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(36),
        lineHeight: scale(36),
        color: colors.aiCoach.darkText,
        width: scale(276),
    },
    suggestionsContainer: {
        gap: scale(10),
        marginBottom: scale(20),
    },
    suggestionRowLeft: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    suggestionButton: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(14),
        borderRadius: scale(30),
        justifyContent: 'center',
        alignItems: 'center',
        gap: scale(10),
    },
    glassBackground: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: scale(30),
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderTopColor: 'rgba(255, 255, 255, 1)',
        borderLeftColor: 'rgba(255, 255, 255, 0.9)',
    },
    suggestionText: {
        fontFamily: fonts.body.light,
        fontSize: scale(13),
        lineHeight: scale(22),
        color: colors.text,
        textAlign: 'right',
    },
    aiChatList: {
        flex: 1,
        marginBottom: scale(10),
    },
    aiChatContent: {
        paddingBottom: scale(10),
    },
    aiMessageBubble: {
        maxWidth: '80%',
        padding: scale(12),
        borderRadius: scale(20),
        marginBottom: scale(8),
    },
    aiUserMessage: {
        alignSelf: 'flex-end',
        backgroundColor: colors.aiCoach.bubble,
        borderBottomRightRadius: scale(5),
    },
    aiAssistantMessage: {
        alignSelf: 'flex-start',
        backgroundColor: colors.aiCoach.bubbleFaded,
        borderBottomLeftRadius: scale(5),
    },
    aiMessageText: {
        fontFamily: fonts.body.light,
        fontSize: scale(15),
        lineHeight: scale(20),
    },
    aiUserMessageText: {
        color: colors.black,
    },
    aiAssistantMessageText: {
        color: colors.black,
    },
    aiLoadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: scale(10),
        marginLeft: scale(4),
        marginBottom: scale(10),
    },
    aiLoadingText: {
        marginLeft: scale(8),
        fontFamily: fonts.body.light,
        fontSize: scale(14),
        color: colors.aiCoach.text,
    },
    aiInputContainer: {
        paddingBottom: scale(90),
    },
    inputButton: {
        width: '100%',
        paddingVertical: scale(5),
        paddingLeft: scale(22),
        paddingRight: scale(5),
        borderRadius: scale(30),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    aiInput: {
        flex: 1,
        fontFamily: fonts.body.light,
        fontSize: scale(18),
        color: colors.text,
        paddingVertical: scale(8),
    },
    sendButton: {
        width: scale(35),
        height: scale(35),
        borderRadius: scale(17.5),
        backgroundColor: '#2E2E43',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default AICoachTab;
