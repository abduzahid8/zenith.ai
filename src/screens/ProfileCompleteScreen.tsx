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

export default function ProfileCompleteScreen() {
    const router = useRouter();

    const handleViewAnswers = () => {
        // Navigate to hobby selection after showing answers
        router.push('/hobby-selection');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <Logo size="large" />
            </View>

            {/* Content - left aligned */}
            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>
                    Твой профиль{'\n'}сформирован
                </Text>
                <Text style={styles.subtitleText}>
                    На их основе мы подобрали{'\n'}
                    хобби, которые помогут тебе{'\n'}
                    использовать время{'\n'}
                    осознаннее.
                </Text>
            </View>

            {/* Spacer */}
            <View style={styles.spacer} />

            {/* Bottom button */}
            <View style={styles.buttonContainer}>
                <Button
                    title="Показать ответы"
                    onPress={handleViewAnswers}
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
        marginTop: 60,
    },
    contentContainer: {
        paddingHorizontal: 24,
        marginTop: 100, // Lower position
    },
    titleText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 26,
        lineHeight: 34,
        color: colors.text,
        marginBottom: 28,
    },
    subtitleText: {
        fontFamily: 'Gramatika-Light',
        fontSize: 18, // Bigger
        lineHeight: 28, // More spacing
        color: colors.textSecondary,
    },
    spacer: {
        flex: 1,
    },
    buttonContainer: {
        paddingHorizontal: 48,
        paddingBottom: 48,
    },
});
