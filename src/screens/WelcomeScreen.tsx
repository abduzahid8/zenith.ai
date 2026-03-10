import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogoNew } from '../components/Logo';
import { Button } from '../components/Button';
import { fonts } from '../theme';
import { scale } from '../constants';
import { useAppTheme } from '../theme/useAppTheme';

export default function WelcomeScreen() {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    const handleStart = () => {
        router.push('/auth');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <LogoNew width={scale(177)} height={scale(40)} variant="full" color={colors.text} />
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

const createStyles = (colors: any) => StyleSheet.create({
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
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        lineHeight: 38,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitleText: {
        fontFamily: fonts.body.light,
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
