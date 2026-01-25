import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    TouchableOpacity,
    Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path, G, Defs, RadialGradient, Stop, ClipPath, Rect } from 'react-native-svg';
import { colors } from '../theme';

// Scale from Figma (402x874) to device
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIGMA_WIDTH = 402;
const scale = (size: number) => (SCREEN_WIDTH / FIGMA_WIDTH) * size;

// Fire emoji component
const FireIcon = () => (
    <Text style={{ fontSize: scale(24) }}>🔥</Text>
);

// Green trend up arrow icon
const TrendUpIcon = () => (
    <Svg width={scale(50)} height={scale(50)} viewBox="0 0 50 50" fill="none">
        <Path
            d="M43.0916 8.42101C43.4109 8.32825 43.7475 8.31107 44.0747 8.37083C44.4018 8.43059 44.7106 8.56564 44.9766 8.76531C45.2425 8.96499 45.4584 9.2238 45.6071 9.52128C45.7558 9.81877 45.8332 10.1468 45.8332 10.4793L45.8312 22.3793C45.8305 22.7773 45.7191 23.1673 45.5096 23.5056C45.3 23.8439 45.0005 24.1173 44.6445 24.2952C44.2885 24.4731 43.89 24.5485 43.4937 24.513C43.0973 24.4774 42.7186 24.3323 42.3999 24.0939L38.9791 21.521L30.2707 33.121C29.7633 33.7961 29.0247 34.2603 28.1964 34.4248C27.368 34.5894 26.5081 34.4426 25.7812 34.0127L25.4687 33.8043L18.5166 28.5814L9.31241 40.8418C8.43741 42.0085 6.84366 42.3148 5.61033 41.6085L5.31033 41.4106C4.75421 40.9928 4.36954 40.3865 4.2284 39.7053C4.08727 39.0242 4.19936 38.315 4.54366 37.7106L4.74158 37.4106L15.3187 23.3231C15.8259 22.6471 16.5649 22.1822 17.3938 22.0176C18.2228 21.8531 19.0833 22.0004 19.8103 22.4314L20.1207 22.6398L27.0707 27.8606L34.4082 18.0898L30.977 15.5127C30.68 15.2887 30.4463 14.9913 30.2989 14.6497C30.1515 14.3082 30.0955 13.9342 30.1362 13.5644C30.177 13.1946 30.3132 12.8418 30.5314 12.5405C30.7497 12.2393 31.0425 11.9999 31.3812 11.846L31.6666 11.7418L43.0937 8.41892L43.0916 8.42101Z"
            fill="#13E659"
        />
    </Svg>
);

// Instagram icon with gradient
const InstagramIcon = () => (
    <Svg width={scale(30)} height={scale(30)} viewBox="0 0 30 30" fill="none">
        <Defs>
            <RadialGradient id="paint0_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-18.4487 5.20295 -3.74853 -13.2914 29.0313 14.0614)" gradientUnits="userSpaceOnUse">
                <Stop stopColor="#FF005F" />
                <Stop offset="1" stopColor="#FC01D8" />
            </RadialGradient>
            <RadialGradient id="paint1_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(7.96852 32.3106) rotate(-90) scale(23.9466 25.4068)">
                <Stop stopColor="#FFCC00" />
                <Stop offset="0.1242" stopColor="#FFCC00" />
                <Stop offset="0.5672" stopColor="#FE4A05" />
                <Stop offset="0.6942" stopColor="#FF0F3F" />
                <Stop offset="1" stopColor="#FE0657" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="paint2_radial" cx="0" cy="0" r="1" gradientTransform="matrix(4.97046 -8.56425 11.1497 6.471 15.7581 29.5769)" gradientUnits="userSpaceOnUse">
                <Stop stopColor="#FFCC00" />
                <Stop offset="1" stopColor="#FFCC00" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="paint3_radial" cx="0" cy="0" r="1" gradientTransform="matrix(-18.2461 5.1378 -1.75 -6.21656 4.07036 1.22159)" gradientUnits="userSpaceOnUse">
                <Stop stopColor="#780CFF" />
                <Stop offset="1" stopColor="#820BFF" stopOpacity="0" />
            </RadialGradient>
            <ClipPath id="clip0">
                <Rect width="30" height="30" fill="white" />
            </ClipPath>
        </Defs>
        <G clipPath="url(#clip0)">
            <Path d="M15.0049 0C8.74254 0 6.91103 0.0064629 6.55502 0.0359999C5.26988 0.142855 4.47019 0.34526 3.59896 0.779131C2.92756 1.11263 2.39803 1.4992 1.87544 2.04109C0.9237 3.02933 0.346884 4.24512 0.138073 5.69032C0.0365584 6.39192 0.0070211 6.535 0.00102299 10.1187C-0.00127874 11.3133 0.00102299 12.8854 0.00102299 14.9941C0.00102299 21.2531 0.00793949 23.0833 0.0379414 23.4387C0.141769 24.6895 0.337881 25.4765 0.75319 26.3374C1.54689 27.9852 3.06275 29.2222 4.84857 29.6838C5.46692 29.8431 6.14987 29.9308 7.02663 29.9723C7.3981 29.9885 11.1843 30 14.9728 30C18.7613 30 22.5499 29.9954 22.9121 29.9769C23.9273 29.9291 24.5168 29.85 25.1686 29.6815C26.966 29.2176 28.4541 27.9991 29.264 26.3281C29.6712 25.4881 29.8777 24.6711 29.9712 23.4855C29.9915 23.227 30 19.1058 30 14.9902C30 10.8738 29.9908 6.76026 29.9705 6.50177C29.8759 5.29706 29.6694 4.487 29.249 3.63076C28.9041 2.92986 28.5211 2.40642 27.965 1.87124C26.9727 0.923153 25.759 0.346178 24.3128 0.137548C23.6121 0.0362268 23.4725 0.00622488 19.8871 0H15.0049Z" fill="url(#paint0_radial)" />
            <Path d="M15.0049 0C8.74254 0 6.91103 0.0064629 6.55502 0.0359999C5.26988 0.142855 4.47019 0.34526 3.59896 0.779131C2.92756 1.11263 2.39803 1.4992 1.87544 2.04109C0.9237 3.02933 0.346884 4.24512 0.138073 5.69032C0.0365584 6.39192 0.0070211 6.535 0.00102299 10.1187C-0.00127874 11.3133 0.00102299 12.8854 0.00102299 14.9941C0.00102299 21.2531 0.00793949 23.0833 0.0379414 23.4387C0.141769 24.6895 0.337881 25.4765 0.75319 26.3374C1.54689 27.9852 3.06275 29.2222 4.84857 29.6838C5.46692 29.8431 6.14987 29.9308 7.02663 29.9723C7.3981 29.9885 11.1843 30 14.9728 30C18.7613 30 22.5499 29.9954 22.9121 29.9769C23.9273 29.9291 24.5168 29.85 25.1686 29.6815C26.966 29.2176 28.4541 27.9991 29.264 26.3281C29.6712 25.4881 29.8777 24.6711 29.9712 23.4855C29.9915 23.227 30 19.1058 30 14.9902C30 10.8738 29.9908 6.76026 29.9705 6.50177C29.8759 5.29706 29.6694 4.487 29.249 3.63076C28.9041 2.92986 28.5211 2.40642 27.965 1.87124C26.9727 0.923153 25.759 0.346178 24.3128 0.137548C23.6121 0.0362268 23.4725 0.00622488 19.8871 0H15.0049Z" fill="url(#paint1_radial)" />
            <Path d="M15.0049 0C8.74254 0 6.91103 0.0064629 6.55502 0.0359999C5.26988 0.142855 4.47019 0.34526 3.59896 0.779131C2.92756 1.11263 2.39803 1.4992 1.87544 2.04109C0.9237 3.02933 0.346884 4.24512 0.138073 5.69032C0.0365584 6.39192 0.0070211 6.535 0.00102299 10.1187C-0.00127874 11.3133 0.00102299 12.8854 0.00102299 14.9941C0.00102299 21.2531 0.00793949 23.0833 0.0379414 23.4387C0.141769 24.6895 0.337881 25.4765 0.75319 26.3374C1.54689 27.9852 3.06275 29.2222 4.84857 29.6838C5.46692 29.8431 6.14987 29.9308 7.02663 29.9723C7.3981 29.9885 11.1843 30 14.9728 30C18.7613 30 22.5499 29.9954 22.9121 29.9769C23.9273 29.9291 24.5168 29.85 25.1686 29.6815C26.966 29.2176 28.4541 27.9991 29.264 26.3281C29.6712 25.4881 29.8777 24.6711 29.9712 23.4855C29.9915 23.227 30 19.1058 30 14.9902C30 10.8738 29.9908 6.76026 29.9705 6.50177C29.8759 5.29706 29.6694 4.487 29.249 3.63076C28.9041 2.92986 28.5211 2.40642 27.965 1.87124C26.9727 0.923153 25.759 0.346178 24.3128 0.137548C23.6121 0.0362268 23.4725 0.00622488 19.8871 0H15.0049Z" fill="url(#paint2_radial)" />
            <Path d="M15.0049 0C8.74254 0 6.91103 0.0064629 6.55502 0.0359999C5.26988 0.142855 4.47019 0.34526 3.59896 0.779131C2.92756 1.11263 2.39803 1.4992 1.87544 2.04109C0.9237 3.02933 0.346884 4.24512 0.138073 5.69032C0.0365584 6.39192 0.0070211 6.535 0.00102299 10.1187C-0.00127874 11.3133 0.00102299 12.8854 0.00102299 14.9941C0.00102299 21.2531 0.00793949 23.0833 0.0379414 23.4387C0.141769 24.6895 0.337881 25.4765 0.75319 26.3374C1.54689 27.9852 3.06275 29.2222 4.84857 29.6838C5.46692 29.8431 6.14987 29.9308 7.02663 29.9723C7.3981 29.9885 11.1843 30 14.9728 30C18.7613 30 22.5499 29.9954 22.9121 29.9769C23.9273 29.9291 24.5168 29.85 25.1686 29.6815C26.966 29.2176 28.4541 27.9991 29.264 26.3281C29.6712 25.4881 29.8777 24.6711 29.9712 23.4855C29.9915 23.227 30 19.1058 30 14.9902C30 10.8738 29.9908 6.76026 29.9705 6.50177C29.8759 5.29706 29.6694 4.487 29.249 3.63076C28.9041 2.92986 28.5211 2.40642 27.965 1.87124C26.9727 0.923153 25.759 0.346178 24.3128 0.137548C23.6121 0.0362268 23.4725 0.00622488 19.8871 0H15.0049Z" fill="url(#paint3_radial)" />
            <Path d="M15.0062 3.85205C11.9769 3.85205 11.5968 3.86528 10.407 3.91939C9.21951 3.97372 8.40897 4.16158 7.69974 4.43722C6.96612 4.7219 6.34381 5.10272 5.72382 5.72248C5.10338 6.34202 4.72226 6.96386 4.43644 7.6967C4.1599 8.40564 3.97167 9.2158 3.91823 10.4019C3.86502 11.5908 3.85107 11.9709 3.85107 14.998C3.85107 18.0251 3.86456 18.4038 3.91846 19.5927C3.97308 20.7793 4.16107 21.5892 4.43667 22.2979C4.7218 23.031 5.1029 23.6528 5.72312 24.2723C6.34289 24.8923 6.96519 25.2741 7.69835 25.5588C8.40803 25.8344 9.21882 26.0223 10.406 26.0766C11.5958 26.1307 11.9758 26.1439 15.0048 26.1439C18.0344 26.1439 18.4134 26.1307 19.6032 26.0766C20.7906 26.0223 21.6021 25.8344 22.3118 25.5588C23.0452 25.2741 23.6666 24.8923 24.2863 24.2723C24.9068 23.6528 25.2879 23.031 25.5737 22.2981C25.8479 21.5892 26.0361 20.779 26.0919 19.5929C26.1453 18.404 26.1593 18.025 26.1593 14.998C26.1593 11.9709 26.1453 11.5911 26.0919 10.4021C26.0361 9.21556 25.8479 8.40564 25.5737 7.69694C25.2879 6.96386 24.9068 6.342 24.2863 5.72248C23.6659 5.10248 23.0454 4.72166 22.3111 4.43721C21.6 4.16158 20.789 3.97372 19.6015 3.91939C18.4117 3.86528 18.033 3.85205 15.0027 3.85205H15.0062ZM14.0056 5.86065C14.3026 5.86018 14.634 5.86065 15.0062 5.86065C17.9844 5.86065 18.3374 5.87133 19.5135 5.92473C20.601 5.97443 21.1912 6.15601 21.5844 6.30857C22.105 6.51059 22.4761 6.75209 22.8662 7.14219C23.2566 7.53231 23.4983 7.90384 23.7009 8.42397C23.8536 8.8164 24.0356 9.40621 24.0851 10.4929C24.1385 11.6679 24.1501 12.0209 24.1501 14.9954C24.1501 17.97 24.1385 18.323 24.0851 19.4979C24.0353 20.5847 23.8536 21.1745 23.7009 21.5669C23.4988 22.087 23.2566 22.4574 22.8662 22.8473C22.4758 23.2374 22.1052 23.4789 21.5844 23.6809C21.1917 23.8342 20.601 24.0153 19.5135 24.065C18.3376 24.1184 17.9844 24.13 15.0062 24.13C12.0278 24.13 11.6748 24.1184 10.499 24.065C9.41146 24.0148 8.82122 23.8332 8.42779 23.6807C7.90726 23.4787 7.53544 23.2372 7.14506 22.8471C6.75466 22.457 6.51299 22.0864 6.31035 21.566C6.15767 21.1735 5.97572 20.5837 5.92623 19.497C5.87278 18.322 5.86209 17.9691 5.86209 14.9927C5.86209 12.0162 5.87278 11.6651 5.92623 10.4902C5.97596 9.40342 6.15767 8.81362 6.31035 8.42073C6.51251 7.90058 6.75466 7.52905 7.14506 7.13895C7.53544 6.74883 7.90726 6.50734 8.42779 6.30486C8.82098 6.1516 9.41146 5.97048 10.499 5.92055C11.528 5.87411 11.9267 5.86018 14.0056 5.85785L14.0056 5.86065ZM20.9603 7.71133C20.2213 7.71133 19.6217 8.30974 19.6217 9.04838C19.6217 9.7868 20.2213 10.3859 20.9603 10.3859C21.6992 10.3859 22.2988 9.7868 22.2988 9.04838C22.2988 8.30996 21.6992 7.71088 20.9603 7.71088L20.9603 7.71133ZM15.0062 9.27408C11.8428 9.27408 9.27807 11.837 9.27807 14.998C9.27807 18.159 11.8428 20.7207 15.0062 20.7207C18.1696 20.7207 20.7335 18.159 20.7335 14.998C20.7335 11.837 18.1694 9.27408 15.006 9.27408H15.0062ZM15.0062 11.2827C17.0595 11.2827 18.7243 12.946 18.7243 14.998C18.7243 17.0498 17.0595 18.7133 15.0062 18.7133C12.9527 18.7133 11.2882 17.0498 11.2882 14.998C11.2882 12.946 12.9527 11.2827 15.0062 11.2827Z" fill="white" />
        </G>
    </Svg>
);

// Chess piece icon
const ChessPieceIcon = () => (
    <Svg width={scale(26)} height={scale(36)} viewBox="0 0 26 36" fill="none">
        <Path d="M20.1725 24.6331C15.1787 20.7991 15.7345 17.4781 15.6718 16.1101H18.7201C19.0787 15.4441 19.258 14.8321 19.258 14.0581L15.8063 11.7721C17.0076 10.8991 17.7876 9.47711 17.7876 7.87511C17.7876 5.85911 16.5504 4.12211 14.7932 3.41111C14.2373 3.18611 10.3283 16.1101 10.3283 16.1101C10.3104 16.4071 10.3104 16.7941 10.3104 17.2621C10.3104 18.5491 13.4483 18.3511 13.278 19.4851C13.027 21.1771 12.9732 22.4731 11.5208 26.5411C10.5435 29.2951 4.00765 26.5411 3.54144 27.8911C3.21868 28.8271 3.04834 29.8801 3.04834 31.0141C3.04834 31.1311 3.30834 32.9491 13.0001 32.9491C22.6918 32.9491 22.9518 31.1311 22.9518 31.0141C22.9518 28.2511 21.9297 25.9741 20.1725 24.6331Z" fill="#5D9948" />
        <Path d="M12.8209 26.3518C13.3588 23.8858 13.834 21.2578 14.1299 19.6828C14.4885 17.7208 11.5299 17.3698 10.3106 17.1898C10.2568 18.8638 9.79055 21.5908 5.81883 24.6328C4.75193 25.4518 3.954 26.6218 3.48779 28.0438C4.56366 28.5658 5.98917 28.8808 8.19469 28.8808C9.61124 28.8808 12.2292 29.0518 12.8209 26.3518ZM14.9009 16.1008C15.3671 14.8768 15.3133 14.0488 15.3133 14.0488L13.3588 11.7628C15.4388 10.8718 16.694 9.18878 16.694 7.23578C16.694 5.67878 15.9499 4.28378 14.8112 3.41078C14.2554 3.18578 13.6457 3.05078 13.0092 3.05078C10.3643 3.05078 8.22159 5.20178 8.22159 7.86578C8.22159 9.46778 9.00159 10.8898 10.203 11.7628L6.75124 14.0488C6.75124 14.8138 6.93055 15.4348 7.28917 16.1008H14.9009Z" fill="#81B64C" />
        <Path d="M12.7313 4.0408C15.4926 4.4728 11.4582 7.6948 10.1851 7.5418C8.97471 7.3888 10.1402 3.6358 12.7313 4.0408Z" fill="#B2E068" />
    </Svg>
);

// Telegram icon
const TelegramIcon = () => (
    <Svg width={scale(30)} height={scale(30)} viewBox="0 0 30 30" fill="none">
        <Path d="M15 30C23.2843 30 30 23.2843 30 15C30 6.71573 23.2843 0 15 0C6.71573 0 0 6.71573 0 15C0 23.2843 6.71573 30 15 30Z" fill="#039BE5" />
        <Path d="M6.77344 14.7656L21.8203 9.14062C22.5 8.90625 23.0859 9.32812 22.875 10.3125L22.8765 10.3109L20.3438 22.2656C20.1563 23.0625 19.6875 23.25 19.0312 22.875L15.0938 20.0156L13.1953 21.8438C12.9844 22.0547 12.8086 22.2305 12.4219 22.2305L12.6953 18.2344L19.875 11.7656C20.1953 11.4844 19.8047 11.3203 19.3828 11.6016L10.5469 17.2031L6.65625 15.9844C5.88281 15.7422 5.85938 15.2109 6.77344 14.7656Z" fill="white" />
    </Svg>
);

export const StatisticsScreen: React.FC = () => {
    const router = useRouter();
    const [streakDays] = React.useState(4);

    const handleNavigateHome = () => {
        router.replace('/home');
    };

    const handleNavigateScreenTime = () => {
        // Navigate to detailed screen time view
        router.push('/screen-time');
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

            {/* Content */}
            <View style={styles.content}>
                {/* First Card - Screen Time Reduction */}
                <TouchableOpacity
                    style={styles.firstCard}
                    onPress={handleNavigateScreenTime}
                    activeOpacity={0.8}
                >
                    <View style={styles.firstCardContent}>
                        <View style={styles.percentageRow}>
                            <Text style={styles.percentageText}>-24%</Text>
                            <TrendUpIcon />
                        </View>
                        <Text style={styles.periodText}>за последнюю{'\n'}неделю</Text>
                    </View>
                </TouchableOpacity>

                {/* Second Card - Hobby Time */}
                <TouchableOpacity
                    style={styles.secondCard}
                    activeOpacity={0.8}
                >
                    <View style={styles.secondCardContent}>
                        <Text style={styles.timeText}>5:30:29</Text>
                        <Text style={styles.hobbyText}>потраченно{'\n'}на хобби</Text>
                    </View>
                </TouchableOpacity>

                {/* App Buttons */}
                <View style={styles.appButtonsContainer}>
                    {/* Instagram */}
                    <TouchableOpacity style={styles.appButton} activeOpacity={0.8}>
                        <View style={styles.appButtonLeft}>
                            <InstagramIcon />
                            <Text style={styles.appName}>Instagram</Text>
                        </View>
                        <Text style={styles.appPercentage}>-21%</Text>
                    </TouchableOpacity>

                    {/* Chess.com */}
                    <TouchableOpacity style={styles.appButton} activeOpacity={0.8}>
                        <View style={styles.appButtonLeft}>
                            <ChessPieceIcon />
                            <Text style={styles.appName}>Chess.com</Text>
                        </View>
                        <Text style={styles.appPercentage}>+34%</Text>
                    </TouchableOpacity>

                    {/* Telegram */}
                    <TouchableOpacity style={styles.appButton} activeOpacity={0.8}>
                        <View style={styles.appButtonLeft}>
                            <TelegramIcon />
                            <Text style={styles.appName}>Telegram</Text>
                        </View>
                        <Text style={styles.appPercentage}>-10%</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Navigation */}
            <View style={styles.bottomNav}>
                <TouchableOpacity style={styles.navItem} onPress={handleNavigateHome}>
                    <Ionicons name="home-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem}>
                    <Ionicons name="bar-chart" size={scale(28)} color="#000" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/ai-coach-chat')}>
                    <MaterialCommunityIcons name="lightbulb-outline" size={scale(28)} color="#A3A3A3" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.navItem} onPress={() => router.push('/weekly-plan')}>
                    <MaterialCommunityIcons name="calendar-text" size={scale(28)} color="#A3A3A3" />
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
        color: '#000',
    },
    menuButton: {
        padding: scale(4),
    },
    // Content
    content: {
        flex: 1,
        paddingHorizontal: scale(20),
        paddingTop: scale(20),
    },
    // First Card - 366x160, border-radius 25px
    firstCard: {
        width: scale(366),
        height: scale(160),
        borderRadius: scale(25),
        backgroundColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
        marginBottom: scale(20),
        paddingHorizontal: scale(20),
        paddingVertical: scale(20),
    },
    firstCardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    percentageRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(8),
    },
    percentageText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(48),
        lineHeight: scale(56),
        color: '#000',
    },
    periodText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(24),
        lineHeight: scale(28),
        color: '#000',
    },
    // Second Card - 362x160, same styling
    secondCard: {
        width: scale(362),
        height: scale(160),
        borderRadius: scale(25),
        backgroundColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
        marginBottom: scale(56),
        paddingHorizontal: scale(20),
        paddingVertical: scale(20),
    },
    secondCardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    timeText: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(48),
        lineHeight: scale(56),
        color: '#000',
    },
    hobbyText: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(24),
        lineHeight: scale(28),
        color: '#000',
    },
    // App Buttons Container
    appButtonsContainer: {
        gap: scale(14),
    },
    // App Button - height 50px, border-radius 56px/38px
    appButton: {
        height: scale(50),
        borderRadius: scale(38),
        backgroundColor: '#E0E0E0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(16),
    },
    appButtonLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: scale(12),
    },
    appName: {
        fontFamily: 'Gramatika-Bold',
        fontSize: scale(16),
        color: '#000',
    },
    appPercentage: {
        fontFamily: 'Gramatika-Light',
        fontSize: scale(20),
        lineHeight: scale(22),
        color: '#000',
        textAlign: 'right',
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

export default StatisticsScreen;
