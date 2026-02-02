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

const ZenythLogo = () => (
    <Svg width="177" height="40" viewBox="0 0 177 40" fill="none">
        <Path d="M50.044 31.2838V27.3077L61.7567 15.5782V14.9823H50.6371V9.41737H71.1754V13.7906L59.7387 25.1604V25.7188H71.1754V31.2838H50.044Z" fill="#000000" />
        <Path d="M94.5263 22.5372H77.5503C77.9979 23.7027 78.7365 24.6245 79.766 25.2991C80.7955 25.9736 81.9668 26.3146 83.2873 26.3146C83.8953 26.3146 84.4735 26.2622 85.0293 26.1572C85.5851 26.0523 86.0774 25.9062 86.5139 25.7188C86.9503 25.5352 87.2972 25.3216 87.5621 25.0817C87.8269 24.8419 87.9724 24.5908 87.9985 24.3247H94.3696C93.9742 25.4377 93.4259 26.4533 92.7283 27.3677C92.0271 28.282 91.199 29.0578 90.2366 29.6948C89.2742 30.3319 88.1924 30.8228 86.9913 31.1676C85.7902 31.5123 84.5033 31.6847 83.1343 31.6847C81.4185 31.6847 79.8443 31.4074 78.4045 30.8491C76.9646 30.2907 75.7262 29.5187 74.6855 28.5219C73.6448 27.5288 72.8316 26.3371 72.2534 24.9431C71.6715 23.5528 71.3843 22.02 71.3843 20.3524C71.3843 18.6848 71.6753 17.1596 72.2534 15.7805C72.8316 14.4015 73.6448 13.2098 74.6855 12.2017C75.7262 11.1937 76.9684 10.4142 78.4045 9.85581C79.8406 9.29744 81.4185 9.02013 83.1343 9.02013C84.742 9.02013 86.2416 9.31244 87.6255 9.8933C89.0094 10.4779 90.2179 11.2798 91.2475 12.2992C92.277 13.3185 93.0827 14.5251 93.6609 15.9154C94.2391 17.3057 94.53 18.8122 94.53 20.4274V22.5335L94.5263 22.5372ZM88.7893 17.7255C88.0768 16.5338 87.2935 15.6794 86.4355 15.1622C85.5776 14.6451 84.5033 14.3865 83.209 14.3865C81.9146 14.3865 80.7769 14.6863 79.7846 15.2821C78.7961 15.878 78.0762 16.7061 77.6286 17.7667L88.7893 17.7255Z" fill="#000000" />
        <Path d="M95.9102 15.3796H93.9332V9.41736H100.461V12.2017H101.054C101.897 11.1937 102.96 10.4142 104.24 9.85581C105.519 9.29744 106.873 9.02013 108.298 9.02013C109.536 9.02013 110.685 9.27871 111.741 9.79586C112.797 10.313 113.714 11.0288 114.49 11.9431C115.27 12.8575 115.874 13.9293 116.31 15.1622C116.747 16.3951 116.963 17.7404 116.963 19.1982V31.2838H111.424V20.8284C111.424 18.7335 111.002 17.1371 110.159 16.0391C109.316 14.9411 108.063 14.3902 106.399 14.3902C104.736 14.3902 103.594 14.9486 102.74 16.0616C101.882 17.1746 101.453 18.7635 101.453 20.8321V31.2875H95.9139V15.3833L95.9102 15.3796Z" fill="#000000" />
        <Path d="M130.023 34.3042C129.601 35.3123 129.206 36.133 128.836 36.77C128.467 37.4071 128.072 37.9018 127.65 38.2615C127.229 38.6213 126.759 38.8724 126.244 39.0185C125.729 39.1647 125.117 39.2359 124.405 39.2359H117.758V34.0681H124.088L125.274 31.2463L116.172 9.42113H122.189L127.967 23.3354H128.56L134.379 9.42113H140.355L130.026 34.308L130.023 34.3042Z" fill="#000000" />
        <Path d="M154.955 26.116V31.2837H147.991C146.249 31.2837 145.014 30.939 144.29 30.2494C143.563 29.5599 143.201 28.3945 143.201 26.7493V14.1879H139.956V9.41736H143.201V1.50648H148.741V9.41736H154.519V14.1879H148.741V26.116H154.955Z" fill="#000000" />
        <Path d="M155.548 1.46526H161.087V11.5646H161.722C163.464 9.86705 165.56 9.02013 168.014 9.02013C169.253 9.02013 170.402 9.27871 171.457 9.79586C172.513 10.313 173.431 11.0288 174.206 11.9431C174.982 12.8575 175.59 13.9293 176.027 15.1622C176.463 16.3951 176.68 17.7404 176.68 19.1982V31.2837H171.14V20.8284C171.14 18.7335 170.719 17.1371 169.876 16.0391C169.033 14.9411 167.779 14.3902 166.116 14.3902C164.452 14.3902 163.266 14.9486 162.397 16.0616C161.528 17.1746 161.091 18.7635 161.091 20.8321V31.2875H155.552V1.469L155.548 1.46526Z" fill="#000000" />
        <Path d="M38.1298 20.0451L28.0658 23.7851L31.0126 30.2195C31.2849 30.8153 30.6732 31.4261 30.0801 31.1526L23.6791 28.1958L19.9527 38.3064C19.7289 38.921 18.8635 38.921 18.6359 38.3064L14.9132 28.1958L8.50853 31.1526C7.91543 31.4261 7.30368 30.8153 7.57598 30.2195L10.5228 23.7851L0.458811 20.0451C-0.152937 19.8165 -0.152937 18.9471 0.458811 18.7223L10.5191 14.9786L7.57598 8.54794C7.30368 7.95209 7.91543 7.33751 8.50853 7.61107L14.9132 10.5716L18.6359 0.460937C18.8635 -0.153646 19.7289 -0.153646 19.9527 0.460937L23.6791 10.5678L30.0801 7.61107C30.6732 7.33751 31.2849 7.95209 31.0126 8.54794L28.0695 14.9786L38.1298 18.7223C38.7416 18.9471 38.7416 19.8165 38.1298 20.0451Z" fill="#000000" />
    </Svg>
);

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

            {/* Logo at top */}
            <View style={styles.logoContainer}>
                <ZenythLogo />
            </View>

            {/* Content */}
            <View style={styles.contentContainer}>
                <Text style={styles.titleText}>Давайте начнем !</Text>
                <Text style={styles.subtitleText}>
                    Поможем тебе перестать залипать и начать заниматься тем, что реально развивает
                </Text>
            </View>

            {/* Social Auth */}
            <View style={styles.socialContainer}>
                {/* Google Sign-In */}
                <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleSignIn}
                >
                    <Image
                        source={require('../../assets/icons/google-logo.png')}
                        style={styles.iconImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.socialButtonText}>Войти с Google</Text>
                </TouchableOpacity>

                {/* Apple Sign-In */}
                <TouchableOpacity
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                >
                    <FontAwesome name="apple" size={24} color="black" />
                    <Text style={styles.socialButtonText}>Войти с Apple</Text>
                </TouchableOpacity>
            </View>

            {/* Email buttons */}
            <View style={styles.emailContainer}>
                <TouchableOpacity
                    style={styles.filledButton}
                    onPress={handleEmailSignIn}
                >
                    <Text style={styles.filledButtonText}>Войти</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.filledButton}
                    onPress={handleEmailSignUp}
                >
                    <Text style={styles.filledButtonText}>Зарегистрироваться</Text>
                </TouchableOpacity>
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
        marginTop: 70,
    },
    contentContainer: {
        marginTop: 70,
        alignItems: 'center',
        width: '100%',
    },
    titleText: {
        fontFamily: 'Gramatika-Black',
        fontSize: 28,
        color: '#000',
        lineHeight: 38,
        textAlign: 'center',
        marginBottom: 12,
        marginTop: 0,
    },
    subtitleText: {
        fontFamily: 'Geometria-Light',
        fontSize: 20,
        fontWeight: '300',
        color: '#000',
        textAlign: 'center',
        width: 329,
        lineHeight: 28,
    },
    socialContainer: {
        marginTop: 100, // Move Google/Apple lower
        alignItems: 'center',
        width: '100%',
    },
    emailContainer: {
        marginTop: 80, // ADJUST THIS VALUE to move the 3rd and 4th buttons lower/higher
        alignItems: 'center',
        paddingBottom: 48,
        width: '100%',
    },
    googleButton: {
        display: 'flex',
        width: 306,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'transparent',
    },
    appleButton: {
        display: 'flex',
        width: 306,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#000',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: 'transparent',
        marginTop: 12,
    },
    filledButton: {
        display: 'flex',
        width: 305,
        height: 50,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
        borderRadius: 25,
        backgroundColor: '#D9D9D9',
        marginTop: 12,
    },
    // Special margin for the first filled button (Login) to separate from social buttons
    loginButtonContainer: {
        marginTop: 100, // Significantly increased gap to push email buttons lower
    },
    socialButtonText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: 16,
        color: '#000',
    },
    filledButtonText: {
        fontFamily: 'Gramatika-Medium',
        fontSize: 16,
        color: '#000',
    },
    iconImage: {
        width: 24,
        height: 24,
    },
});
