import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

export default function WelcomeScreen() {
    const router = useRouter();

    const handleStart = () => {
        router.push('/auth');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(177)} height={scale(40)} variant="full" />
            </View>

            {/* Center content */}
            <View style={styles.contentContainer}>
                <Text style={styles.welcomeText}>Добро пожаловать !</Text>
                <Text style={styles.subtitleText}>
                    Достигни своего{'\n'}зенита
                </Text>
            </View>

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <Button
                    title="Начать"
                    onPress={handleStart}
                />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    logoContainer: {
        alignItems: 'center',
        marginTop: 80,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    welcomeText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 28,
        lineHeight: 38,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitleText: {
        fontFamily: 'Geometria-Light', // Font change only
        fontSize: 20,
        lineHeight: 28, // Kept original line height
        color: colors.text,
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
