import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Logo } from '../components/Logo';
import { Button } from '../components/Button';
import { colors } from '../theme';

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
                <Logo size="large" />
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
        fontFamily: 'Gramatika-Light',
        fontSize: 20,
        lineHeight: 28,
        color: colors.text,
        textAlign: 'center',
    },
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
