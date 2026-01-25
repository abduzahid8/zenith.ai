import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

interface LogoProps {
    size?: 'small' | 'medium' | 'large';
}

// Logo component using the actual logo image
export const Logo: React.FC<LogoProps> = ({ size = 'medium' }) => {
    const dimensions = {
        small: { width: 120, height: 32 },
        medium: { width: 160, height: 42 },
        large: { width: 200, height: 52 },
    }[size];

    return (
        <View style={styles.container}>
            <Image
                source={require('../../assets/icons/logo-full.png')}
                style={{ width: dimensions.width, height: dimensions.height }}
                resizeMode="contain"
            />
        </View>
    );
};

export const LogoSimple = Logo;

// Star icon component
export const StarIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
    <Image
        source={require('../../assets/icons/star-icon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
    />
);

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
});

export default Logo;
