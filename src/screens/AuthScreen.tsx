import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { FontAwesome } from '@expo/vector-icons';
import { colors } from '../theme';
import { Button } from '../components/Button';



import { LogoNew } from '../components/Logo';

export default function AuthScreen() {
    const router = useRouter();

    const handleGoogleSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleAppleSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleEmailSignIn = () => {
        router.push('/login');
    };

    const handleEmailSignUp = () => {
        router.push('/register');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header with Star Logo - LEFT aligned */}
            <View style={styles.headerContainer}>
                <LogoNew variant="full" width={110} height={25} />
            </View>

            {/* Subtitle - LEFT aligned */}
            <View style={styles.subtitleContainer}>
                <Text style={styles.subtitleText}>
                    Поможем тебе перестать залипать и начать заниматься тем, что реально развивает
                </Text>
            </View>

            {/* Spacer above buttons to center them */}
            <View style={styles.spacer} />


            {/* Main Action Buttons */}
            <View style={styles.actionContainer}>
                <Button
                    title="Войти"
                    onPress={handleEmailSignIn}
                    variant="primary"
                />
                <Button
                    title="Зарегистрироваться"
                    onPress={handleEmailSignUp}
                    variant="primary"
                />
            </View>

            {/* Spacer below buttons to center them */}
            <View style={styles.spacer} />

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Или</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialContainer}>
                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleGoogleSignIn}
                >
                    <Image
                        source={require('../../assets/icons/google-logo.png')}
                        style={styles.socialIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.socialButton}
                    onPress={handleAppleSignIn}
                >
                    <FontAwesome name="apple" size={24} color="black" />
                    <Text style={styles.socialButtonText}>Войти с Apple</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingHorizontal: 28,
    },
    headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: 130,
        marginBottom: 12,
        gap: 10,
    },
    headerTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 26,
        color: '#102852',
    },
    subtitleContainer: {
        alignItems: 'flex-start',
        marginBottom: 0,
    },
    subtitleText: {
        fontFamily: 'Gramatika-Light',
        fontSize: 16,
        lineHeight: 24,
        color: '#444444',
        textAlign: 'left',
        width: '90%',
    },
    spacer: {
        flex: 1,
    },
    actionContainer: {
        gap: 14,
        marginBottom: 24,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#C8C8C8',
    },
    dividerText: {
        fontFamily: 'Gramatika-Regular',
        fontSize: 14,
        color: '#999999',
        marginHorizontal: 16,
    },
    socialContainer: {
        gap: 14,
        paddingBottom: 40,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: '#C8C8C8',
        backgroundColor: 'transparent',
        gap: 12,
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    socialButtonText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: 18,
        color: '#000000',
    },
});
