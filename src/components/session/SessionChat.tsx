import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Image,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { scale } from '../../constants';
import { colors, fonts } from '../../theme';
import { ChatMessage } from '../../services/ai';

export interface SessionChatProps {
    messages: ChatMessage[];
    chatInput: string;
    isAiLoading: boolean;
    onChangeText: (text: string) => void;
    onSendMessage: () => void;
    onOpenTaskList: () => void;
}

const SessionChat: React.FC<SessionChatProps> = ({
    messages,
    chatInput,
    isAiLoading,
    onChangeText,
    onSendMessage,
    onOpenTaskList,
}) => {
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
            <View style={styles.chatPage}>
                {/* Header */}
                <View style={styles.chatHeader}>
                    <TouchableOpacity
                        style={styles.chatMenuButton}
                        activeOpacity={0.7}
                        onPress={onOpenTaskList}
                    >
                        <Image source={require('../../../icons/tasks.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.home.darkText }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>

                {/* Chat Area */}
                <ScrollView
                    style={styles.chatArea}
                    contentContainerStyle={styles.chatContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {messages.map((msg, index) => (
                        <View
                            key={index}
                            style={[
                                styles.messageBubble,
                                msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.messageText,
                                    msg.role === 'user' ? styles.userText : styles.assistantText,
                                ]}
                            >
                                {msg.content}
                            </Text>
                        </View>
                    ))}
                    {isAiLoading && (
                        <View style={[styles.messageBubble, styles.assistantBubble]}>
                            <Text style={[styles.messageText, styles.assistantText]}>...</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Input Area */}
                <View style={styles.chatInputContainer}>
                    <TextInput
                        style={styles.chatInput}
                        placeholder="Чем я могу помочь?"
                        placeholderTextColor={colors.sessionTimer.chatPlaceholder}
                        value={chatInput}
                        onChangeText={onChangeText}
                        onSubmitEditing={onSendMessage}
                        returnKeyType="send"
                    />
                    <TouchableOpacity
                        style={styles.sendButton}
                        activeOpacity={0.8}
                        onPress={onSendMessage}
                        disabled={isAiLoading}
                    >
                        <Ionicons name="send" size={scale(20)} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    chatPage: {
        flex: 1,
        backgroundColor: colors.sessionTimer.background,
        paddingTop: Platform.OS === 'android' ? scale(60) : scale(60),
    },
    chatHeader: {
        position: 'absolute',
        top: scale(20),
        left: scale(24),
        zIndex: 10,
    },
    chatMenuButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: colors.sessionTimer.chatInput,
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatArea: {
        flex: 1,
        paddingHorizontal: scale(20),
    },
    chatContent: {
        paddingBottom: scale(100),
    },
    chatInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.sessionTimer.chatInput,
        borderRadius: scale(30),
        marginHorizontal: scale(20),
        marginBottom: scale(30),
        paddingHorizontal: scale(6),
        paddingVertical: scale(6),
        height: scale(60),
    },
    messageBubble: {
        maxWidth: '80%',
        padding: scale(12),
        borderRadius: scale(16),
        marginBottom: scale(10),
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: colors.sessionTimer.chatUser,
        borderBottomRightRadius: scale(4),
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: colors.sessionTimer.chatAssistant,
        borderBottomLeftRadius: scale(4),
    },
    messageText: {
        fontSize: scale(16),
        fontFamily: fonts.body.light,
        lineHeight: scale(22),
    },
    userText: {
        color: colors.sessionTimer.chatUserText,
    },
    assistantText: {
        color: colors.sessionTimer.chatAssistantText,
    },
    chatInput: {
        flex: 1,
        height: '100%',
        paddingHorizontal: scale(16),
        fontFamily: fonts.body.light,
        fontSize: scale(16),
        color: colors.home.darkText,
    },
    sendButton: {
        width: scale(48),
        height: scale(48),
        borderRadius: scale(24),
        backgroundColor: colors.sessionTimer.chatUser,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default SessionChat;
