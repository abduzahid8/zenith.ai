import React, { useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    Animated,
    Easing,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { fonts } from '../../src/theme';
import { useAppTheme } from '../../src/theme/useAppTheme';
import { LogoNew } from '../../src/components/Logo';


export default function RegistrationSuccessScreen() {
    const router = useRouter();
    const { colors, isDark } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);

    // Animations
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 12,
                bounciness: 15,
            }),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                    easing: Easing.out(Easing.cubic),
                }),
            ]),
        ]).start();
    }, []);

    const handleContinue = () => {
        router.replace('/(auth)/login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <LogoNew variant="icon" width={36} height={36} color={colors.text} />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                {/* Animated Checkmark */}
                <Animated.View style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}>
                    <Image source={require('../../icons/Vector.png')} style={{ width: 64, height: 64, tintColor: colors.buttonPrimary }} resizeMode="contain" />
                </Animated.View>

                <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                    <Text style={styles.title}>Congratulations!</Text>
                    <Text style={styles.subtitle}>
                        Your account has been created.{'\n'}
                        Check your email for confirmation,{'\n'}
                        then sign in to the app.
                    </Text>
                </Animated.View>
            </View>

            {/* Action */}
            <View style={styles.actionsContainer}>
                <Button
                    title="Go to Sign In"
                    onPress={handleContinue}
                    variant="primary"
                    size="large"
                />
            </View>
        </SafeAreaView>
    );
}

const createStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 28,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 20,
        gap: 10,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(16, 40, 82, 0.06)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: 28,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
    },
    subtitle: {
        fontFamily: fonts.body.light,
        fontSize: 17,
        lineHeight: 26,
        color: '#808B9B',
        textAlign: 'center',
    },
    actionsContainer: {
        paddingBottom: 48,
        alignItems: 'center',
    },
});
