import React, { useMemo, useRef } from 'react';
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
    Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Svg, { Path } from 'react-native-svg';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { ChatMessage } from '../../services/ai';
import { useAppTheme } from '../../theme/useAppTheme';

export interface SessionChatProps {
    messages: ChatMessage[];
    chatInput: string;
    isAiLoading: boolean;
    onChangeText: (text: string) => void;
    onSendMessage: () => void;
    onOpenTaskList: () => void;
}

const SendIcon = ({ color = "white" }) => (
    <Svg width={scale(15)} height={scale(15)} viewBox="0 0 25 25" fill="none">
        <Path
            d="M1.7207 24.4697C1.93894 24.5358 2.28825 24.5079 2.95801 24.2549C3.61366 24.0072 4.46761 23.5888 5.64941 23.0088L20.751 15.5977C21.9079 15.0299 22.7428 14.619 23.3359 14.2549C23.9356 13.8868 24.2008 13.6166 24.3135 13.3682C24.5622 12.8197 24.5621 12.1725 24.3135 11.624C24.2008 11.3755 23.9356 11.1044 23.3359 10.7363C22.7428 10.3723 21.9077 9.96223 20.751 9.39453L5.67578 1.99512C4.49043 1.41344 3.63313 0.994551 2.97559 0.746094C2.3035 0.492175 1.95364 0.464832 1.73535 0.53125C1.22288 0.687411 0.788236 1.10412 0.582031 1.68066C0.485874 1.94949 0.484274 2.3675 0.649414 3.12402C0.811859 3.86815 1.11147 4.84445 1.52344 6.18652L3.01758 11.0557C3.14237 11.4622 3.22438 11.7304 3.26367 11.9961H11.8428C12.1189 11.9961 12.3428 12.22 12.3428 12.4961C12.3427 12.7721 12.1188 12.9961 11.8428 12.9961H3.24414C3.19983 13.2234 3.12483 13.4678 3.02051 13.8105L1.49414 18.8262C1.08662 20.1652 0.791068 21.1394 0.630859 21.8818C0.468108 22.6362 0.470007 23.0538 0.566406 23.3223C0.773359 23.8977 1.20872 24.3144 1.7207 24.4697Z"
            fill={color}
        />
    </Svg>
);

const SessionChat: React.FC<SessionChatProps> = ({
    messages,
    chatInput,
    isAiLoading,
    onChangeText,
    onSendMessage,
    onOpenTaskList,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const scrollRef = useRef<ScrollView>(null);

    const scrollToBottom = () => {
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? scale(50) : 20}
        >
            <View style={styles.chatPage}>
                {/* Header */}
                <View style={styles.chatHeader}>
                    <TouchableOpacity
                        style={styles.chatMenuButton}
                        activeOpacity={0.7}
                        onPress={onOpenTaskList}
                    >
                        <BlurView intensity={80} tint="light" style={styles.chatMenuGlass} />
                        <Image source={require('../../../icons/tasks.png')} style={{ width: scale(24), height: scale(24), tintColor: colors.home.darkText, zIndex: 1 }} resizeMode="contain" />
                    </TouchableOpacity>
                </View>

                {/* Chat Area */}
                <ScrollView
                    ref={scrollRef}
                    style={styles.chatArea}
                    contentContainerStyle={styles.chatContent}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={scrollToBottom}
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
                    <BlurView intensity={80} tint={'light'} style={styles.glassBackground} />
                    <TextInput
                        style={styles.chatInput}
                        placeholder="Чем я могу помочь?"
                        placeholderTextColor={colors.sessionTimer.chatPlaceholder || colors.text}
                        value={chatInput}
                        onChangeText={onChangeText}
                        onSubmitEditing={onSendMessage}
                        onFocus={scrollToBottom}
                        returnKeyType="send"
                        autoCapitalize="sentences"
                        autoCorrect={false}
                        editable={!isAiLoading}
                        multiline={false}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, isAiLoading && { opacity: 0.5 }]}
                        activeOpacity={0.8}
                        onPress={onSendMessage}
                        disabled={isAiLoading || !chatInput.trim()}
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
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    chatMenuGlass: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: scale(24),
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        borderTopColor: 'rgba(255, 255, 255, 1)',
        borderLeftColor: 'rgba(255, 255, 255, 0.9)',
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
        justifyContent: 'space-between',
        borderRadius: scale(30),
        marginHorizontal: scale(20),
        marginBottom: scale(16),
        paddingVertical: scale(5),
        paddingLeft: scale(22),
        paddingRight: scale(5),
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
        fontFamily: fonts.body.light,
        fontSize: scale(18),
        color: colors.home.darkText,
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

export default SessionChat;
