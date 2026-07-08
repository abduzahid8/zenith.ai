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
import { useGamificationStore } from '../store/gamificationStore';
import { aiService, ChatMessage } from '../services/ai';
import { BottomNavigation } from '../components/BottomNavigation';
import { useAppTheme } from '../theme/useAppTheme';
import { scale } from '../constants';
import { HOBBY_META, HobbyId } from '../data/lessonContent';
import { useGoalStore } from '../store/goalStore';
import { GoalSnapshot } from '../types/goals';
import GoalProgressBar from '../components/goal/GoalProgressBar';

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
    const [goalSnapshot, setGoalSnapshot] = useState<GoalSnapshot | null>(null);
    const [todaysMove, setTodaysMove] = useState<string>('');
    const flatListRef = useRef<FlatList>(null);

    const buildUserContext = (): string => {
        const g = useGamificationStore.getState();
        const p = useUserProfileStore.getState();
        const hobby = (selectedHobby || p.selectedHobby) as HobbyId | null;
        const list: string[] = [];
        if (p.userName) list.push(`Name: ${p.userName}`);
        list.push(`Streak: ${g.currentStreak} days`);
        list.push(`Sessions today: ${g.sessionsCompletedToday}`);
        list.push(`Artifacts saved: ${g.artifacts.length}`);
        list.push(`Badges earned: ${g.unlockedBadges.length}`);
        list.push(`Code runs: ${g.codeRunCount}`);
        if (g.chessTaskSolved) list.push(`Chess puzzles solved: yes`);
        if (g.dailyChecklist.learn) list.push(`Today: learn done`);
        if (g.dailyChecklist.do) list.push(`Today: main task done`);
        if (g.dailyChecklist.deepen1) list.push(`Today: deepen done`);

        // Include goal context
        const goalState = useGoalStore.getState();
        const snapshot = hobby ? goalState.getSnapshot(hobby) : null;
        if (snapshot) {
            list.push(`Goal: ${snapshot.definition.description}`);
            list.push(`Progress: ${snapshot.percentComplete}% (${snapshot.progress.currentValue}/${snapshot.definition.target})`);
            list.push(`Days remaining: ${snapshot.daysRemaining}`);
            list.push(`Status: ${snapshot.projectedCompletion}`);
        }

        if (hobby) {
            const meta = HOBBY_META[hobby];
            const day = g.currentDay[hobby] || 1;
            const week = Math.ceil(day / 7);
            list.push(`Current hobby: ${meta?.label || hobby} (day ${day}, week ${week})`);
        } else {
            const lines = (Object.keys(g.currentDay) as HobbyId[])
                .filter(h => h !== 'coding')
                .map(h => `${HOBBY_META[h]?.label || h} (day ${g.currentDay[h] || 1})`);
            if (lines.length) list.push(`Hobbies: ${lines.join(', ')}`);
        }
        return list.map(s => `- ${s}`).join('\n');
    };

    // Load goal + today's move on mount
    useEffect(() => {
        const hobby = selectedHobby as HobbyId;
        if (!hobby) return;

        const snapshot = useGoalStore.getState().getSnapshot(hobby);
        setGoalSnapshot(snapshot);

        const meta = HOBBY_META[hobby];
        const hobbyName = meta?.label?.toLowerCase() || 'hobby';

        if (snapshot) {
            const move = `Today's move: complete today's ${hobbyName} lesson — ${snapshot.unitsRemaining} ${snapshot.definition.type === 'reading_books' ? 'books' : 'units'} remain toward "${snapshot.definition.description}"`;
            setTodaysMove(move);

            // Call AI for a decomposed daily action
            const gamification = useGamificationStore.getState();
            const day = gamification.currentDay[hobby] || 1;
            aiService.decomposeDailyAction({
                hobby: hobby,
                goalDescription: snapshot.definition.description,
                percentComplete: snapshot.percentComplete,
                daysRemaining: snapshot.daysRemaining,
                projectedCompletion: snapshot.projectedCompletion,
                unitsRemaining: snapshot.unitsRemaining,
                dailyRateNeeded: snapshot.dailyRateNeeded,
                currentDay: day,
                category: snapshot.definition.category,
            }).then((aiMove) => {
                setTodaysMove(aiMove || move);
                setMessages(prev => {
                    if (prev.length > 0 && prev[0].role === 'assistant') {
                        const updated = [...prev];
                        updated[0] = {
                            ...updated[0],
                            content: `You're ${snapshot.percentComplete}% toward "${snapshot.definition.description}". ${snapshot.progress.streak > 0 ? `${snapshot.progress.streak}-day streak — keep going!` : 'Complete today\'s lesson to start building your streak.'} ${aiMove || move}`,
                        };
                        return updated;
                    }
                    return prev;
                });
            }).catch(() => {
                // Fallback — static message already set
            });

            setMessages([
                {
                    id: '1',
                    role: 'assistant',
                    content: `You're ${snapshot.percentComplete}% toward "${snapshot.definition.description}". ${snapshot.progress.streak > 0 ? `${snapshot.progress.streak}-day streak — keep going!` : 'Complete today\'s lesson to start building your streak.'} ${move}`,
                    timestamp: new Date(),
                },
            ]);
        } else {
            setMessages([
                {
                    id: '1',
                    role: 'assistant',
                    content: `Hi! I'm your AI coach for ${hobbyName}. Set a goal to get personalized daily actions toward your finish line.`,
                    timestamp: new Date(),
                },
            ]);
        }
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

            const userContext = buildUserContext();
            const response = await aiService.sendMessage(chatMessages, selectedHobby || undefined, userContext);
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

            {/* Goal Progress */}
            {goalSnapshot ? (
                <>
                    <GoalProgressBar snapshot={goalSnapshot} />
                    {todaysMove ? (
                        <View style={styles.todaysMoveCard}>
                            <Text style={styles.todaysMoveLabel}>Today's move</Text>
                            <Text style={styles.todaysMoveText}>{todaysMove}</Text>
                        </View>
                    ) : null}
                </>
            ) : (
                <TouchableOpacity style={styles.setGoalCard} onPress={() => router.push(`/goal-setup${selectedHobby ? `?hobbyId=${selectedHobby}` : ''}` as any)} activeOpacity={0.8}>
                    <Text style={styles.setGoalTitle}>Set a goal to track progress</Text>
                    <Text style={styles.setGoalSubtitle}>Define what you want to achieve and get a daily plan toward your finish line</Text>
                    <View style={styles.setGoalButton}>
                        <Text style={styles.setGoalButtonText}>Set your goal</Text>
                    </View>
                </TouchableOpacity>
            )}

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
    todaysMoveCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(14),
        borderRadius: scale(12),
        backgroundColor: colors.buttonPrimary + '15',
        borderLeftWidth: 3,
        borderLeftColor: colors.buttonPrimary,
    },
    todaysMoveLabel: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(11),
        color: colors.buttonPrimary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: scale(4),
    },
    todaysMoveText: {
        fontFamily: fonts.body.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        color: colors.text,
    },
    setGoalCard: {
        marginHorizontal: scale(20),
        marginBottom: scale(12),
        padding: scale(20),
        borderRadius: scale(16),
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
        alignItems: 'center',
    },
    setGoalTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
        color: colors.text,
        marginBottom: scale(6),
        textAlign: 'center',
    },
    setGoalSubtitle: {
        fontFamily: fonts.body.regular,
        fontSize: scale(13),
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: scale(18),
        marginBottom: scale(16),
    },
    setGoalButton: {
        backgroundColor: colors.buttonPrimary,
        borderRadius: scale(20),
        paddingHorizontal: scale(24),
        paddingVertical: scale(10),
    },
    setGoalButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#FFFFFF',
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
