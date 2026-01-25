import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Fire emoji component
const FireIcon = () => (
    <Text style={{ fontSize: scale(24) }}>🔥</Text>
);

// Send message icon
const SendIcon = () => (
    <Svg width={scale(25)} height={scale(25)} viewBox="0 0 25 25" fill="none">
        <Path
            d="M1.7207 24.4697C1.93894 24.5358 2.28825 24.5079 2.95801 24.2549C3.61366 24.0072 4.46761 23.5888 5.64941 23.0088L20.751 15.5977C21.9079 15.0299 22.7428 14.619 23.3359 14.2549C23.9356 13.8868 24.2008 13.6166 24.3135 13.3682C24.5622 12.8197 24.5621 12.1725 24.3135 11.624C24.2008 11.3755 23.9356 11.1044 23.3359 10.7363C22.7428 10.3723 21.9077 9.96223 20.751 9.39453L5.67578 1.99512C4.49043 1.41344 3.63313 0.994551 2.97559 0.746094C2.3035 0.492175 1.95364 0.464832 1.73535 0.53125C1.22288 0.687411 0.788236 1.10412 0.582031 1.68066C0.485874 1.94949 0.484274 2.3675 0.649414 3.12402C0.811859 3.86815 1.11147 4.84445 1.52344 6.18652L3.01758 11.0557C3.14237 11.4622 3.22438 11.7304 3.26367 11.9961H11.8428C12.1189 11.9961 12.3428 12.22 12.3428 12.4961C12.3427 12.7721 12.1188 12.9961 11.8428 12.9961H3.24414C3.19983 13.2234 3.12483 13.4678 3.02051 13.8105L1.49414 18.8262C1.08662 20.1652 0.791068 21.1394 0.630859 21.8818C0.468108 22.6362 0.470007 23.0538 0.566406 23.3223C0.773359 23.8977 1.20872 24.3144 1.7207 24.4697Z"
            fill="black"
            stroke="black"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

export const AICoachChatScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = React.useState(4);

    const handleNavigateHome = () => {
        router.replace('/home');
    };

    const handleNavigateStatistics = () => {
        router.push('/statistics');
    };

    const handleSuggestionPress = (suggestion: string) => {
        // Handle suggestion button press - navigate to chat or handle query
        console.log('Suggestion pressed:', suggestion);
    };

    const handleSendPress = () => {
        // Handle send button press
        router.push('/ai-coach');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerRight}>
                    <View style={styles.streakContainer}>
                        <Text style={styles.streakNumber}>{streakDays}</Text>
                        <FireIcon />
                    </View>
                    <TouchableOpacity style={styles.menuButton}>
                        <Feather name="menu" size={scale(24)} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Main Content Area */}
            <View style={styles.content}>
                {/* Title Section - Centered in available space */}
                <View style={styles.titleContainer}>
                    <Text style={styles.title}>Достигни{'\n'}своего зенита!</Text>
                </View>

                {/* Suggestions & Input Section - Pushed to bottom */}
                <View style={styles.bottomSection}>
                    {/* Suggestion Buttons */}
                    <View style={styles.suggestionsContainer}>
                        {/* First row - Right Aligned */}
                        <View style={styles.suggestionRowRight}>
                            <TouchableOpacity
                                style={styles.suggestionButton}
                                onPress={() => handleSuggestionPress('progress')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.suggestionText}>Как быстрее прогрессировать?</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Second row - Space Between */}
                        <View style={styles.suggestionRowSpaceBetween}>
                            <TouchableOpacity
                                style={styles.suggestionButton}
                                onPress={() => handleSuggestionPress('explain')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.suggestionText}>Объясни мой прогресс</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.suggestionButton}
                                onPress={() => handleSuggestionPress('today')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.suggestionText}>Что сделать сегодня?</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Chat Input */}
                    <View style={styles.inputContainer}>
                        <TouchableOpacity
                            style={styles.inputButton}
                            onPress={handleSendPress}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.inputPlaceholder}>С чего начнем?</Text>
                            <SendIcon />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateHome}>
                    <Ionicons name="home-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateStatistics}>
                    <Ionicons name="bar-chart-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <MaterialCommunityIcons name="lightbulb" size={scale(28)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/weekly-plan')}>
                    <MaterialCommunityIcons name="calendar-text-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingHorizontal: scale(24),
        paddingTop: scale(16),
        paddingBottom: scale(24),
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    streakContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    streakNumber: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(24),
        lineHeight: scale(21),
        color: '#000',
    },
    menuButton: {
        padding: scale(4),
    },
    // Content Layout
    content: {
        flex: 1,
        paddingHorizontal: scale(20),
        justifyContent: 'space-between',
    },
    titleContainer: {
        flex: 1,
        justifyContent: 'center',
        // Slight visual adjustment upwards to match design feel
        paddingBottom: scale(100),
    },
    title: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(36),
        lineHeight: scale(36),
        color: '#000',
        width: scale(276),
    },
    bottomSection: {
        gap: scale(20),
        paddingBottom: scale(20),
    },
    // Suggestion buttons
    suggestionsContainer: {
        gap: scale(10),
    },
    suggestionRowRight: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
    },
    suggestionRowSpaceBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    suggestionButton: {
        paddingVertical: scale(8),
        paddingHorizontal: scale(23),
        borderRadius: scale(30),
        backgroundColor: '#D7D7D7',
    },
    suggestionText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(13),
        lineHeight: scale(16), // Adjusted line height
        color: '#000',
    },
    // Input
    inputContainer: {
        // No extra padding needed here as it is handled by parent gap
    },
    inputButton: {
        width: '100%',
        height: scale(55),
        paddingHorizontal: scale(22),
        borderRadius: scale(25),
        borderWidth: 2,
        borderColor: '#000000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    inputPlaceholder: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        color: '#4E4E4E',
    },
    // Bottom Navigation
    bottomNav: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: scale(60),
        marginHorizontal: scale(16),
        marginBottom: scale(16),
        borderRadius: scale(47),
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
    },
    navItem: {
        padding: scale(12),
    },
});

export default AICoachChatScreen;
