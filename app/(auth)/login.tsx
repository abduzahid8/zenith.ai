// Auth Fix
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    StatusBar,
    TextInput,
    Alert,
    TouchableOpacity,
    Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { FontAwesome, MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Button';
import { colors } from '../../src/theme';
import { useAuthStore } from '../../src/store/authStore';

const StarLogo = () => (
    <Svg width="36" height="36" viewBox="0 0 40 40" fill="none">
        <Path
            d="M38.1298 20.0451L28.0658 23.7851L31.0126 30.2195C31.2849 30.8153 30.6732 31.4261 30.0801 31.1526L23.6791 28.1958L19.9527 38.3064C19.7289 38.921 18.8635 38.921 18.6359 38.3064L14.9132 28.1958L8.50853 31.1526C7.91543 31.4261 7.30368 30.8153 7.57598 30.2195L10.5228 23.7851L0.458811 20.0451C-0.152937 19.8165 -0.152937 18.9471 0.458811 18.7223L10.5191 14.9786L7.57598 8.54794C7.30368 7.95209 7.91543 7.33751 8.50853 7.61107L14.9132 10.5716L18.6359 0.460937C18.8635 -0.153646 19.7289 -0.153646 19.9527 0.460937L23.6791 10.5678L30.0801 7.61107C30.6732 7.33751 31.2849 7.95209 31.0126 8.54794L28.0695 14.9786L38.1298 18.7223C38.7416 18.9471 38.7416 19.8165 38.1298 20.0451Z"
            fill={colors.primary}
        />
    </Svg>
);

export default function LoginScreen() {
    const router = useRouter();
    const { signIn, isLoading } = useAuthStore();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Ошибка', 'Заполните все поля');
            return;
        }

        try {
            const trimmedEmail = email.trim();
            console.log('Submitting login for:', trimmedEmail);
            await signIn(trimmedEmail, password);
        } catch (error: any) {
            Alert.alert('Ошибка входа', error.message || 'Произошла ошибка');
        }
    };

    const handleGoogleSignIn = () => {
        router.push('/quiz-intro');
    };

    const handleAppleSignIn = () => {
        router.push('/quiz-intro');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.headerContainer}>
                <StarLogo />
                <Text style={styles.headerTitle}>Вход</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                {/* Email */}
                <Text style={styles.inputLabel}>Почта</Text>
                <View style={styles.inputContainer}>
                    <MaterialCommunityIcons name="email-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="example@gmail.com"
                        placeholderTextColor="#999"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                {/* Password */}
                <Text style={styles.inputLabel}>Пароль</Text>
                <View style={styles.inputContainer}>
                    <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                    <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                        <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                    </TouchableOpacity>
                </View>

                {/* Remember Me + Forgot Password */}
                <View style={styles.optionsRow}>
                    <TouchableOpacity
                        style={styles.checkboxRow}
                        onPress={() => setRememberMe(!rememberMe)}
                    >
                        <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                            {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
                        </View>
                        <Text style={styles.checkboxLabel}>Запомнить меня</Text>
                    </TouchableOpacity>

                    <TouchableOpacity>
                        <Text style={styles.forgotPassword}>Забыли пароль?</Text>
                    </TouchableOpacity>
                </View>

                {/* Login Button */}
                <Button
                    title="Войти"
                    onPress={handleLogin}
                    variant="primary"
                    size="large"
                    loading={isLoading}
                    style={styles.loginButton}
                />
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Или</Text>
                <View style={styles.dividerLine} />
            </View>

            {/* Social Buttons */}
            <View style={styles.socialContainer}>
                <TouchableOpacity style={styles.socialButton} onPress={handleGoogleSignIn}>
                    <Image
                        source={require('../../assets/icons/google-logo.png')}
                        style={styles.socialIcon}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.socialButton} onPress={handleAppleSignIn}>
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
        marginTop: 40,
        marginBottom: 80,
        gap: 10,
    },
    headerTitle: {
        fontFamily: 'Gramatika-Bold',
        fontSize: 26,
        color: '#08132A', // Color change
    },
    formContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontFamily: 'Geometria-Light', // Font change
        fontSize: 14,
        color: '#08132A', // Color change
        marginBottom: 8,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(8, 19, 42, 0.3)', // Color change
        borderRadius: 28,
        paddingHorizontal: 16,
        height: 52,
        backgroundColor: 'transparent',
        marginBottom: 20,
    },
    inputIcon: {
        marginRight: 10,
    },
    input: {
        flex: 1,
        fontFamily: 'Geometria-Light', // Font change
        fontSize: 15,
        color: '#4A515B', // Color change
    },
    eyeIcon: {
        padding: 4,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 28,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderWidth: 1,
        borderColor: '#808B9B', // Color change
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#102852',
        borderColor: '#102852',
    },
    checkboxLabel: {
        fontFamily: 'Geometria-Medium', // Font change
        fontSize: 13,
        color: '#808B9B', // Color change
    },
    forgotPassword: {
        fontFamily: 'Geometria-Medium', // Font change
        fontSize: 13,
        color: '#4A515B', // Color change
    },
    loginButton: {
        marginBottom: 0,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
        paddingHorizontal: 8,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(8, 19, 42, 0.5)', // Color change
    },
    dividerText: {
        fontFamily: 'Geometria-Light', // Font change
        fontSize: 14,
        color: 'rgba(8, 19, 42, 0.5)', // Color change
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
        borderColor: 'rgba(8, 19, 42, 0.3)', // Color change
        backgroundColor: 'transparent',
        gap: 12,
    },
    socialIcon: {
        width: 24,
        height: 24,
    },
    socialButtonText: {
        fontFamily: 'Gramatika-Bold', // Font change
        fontSize: 18,
        color: '#08132A', // Color change
    },
});
