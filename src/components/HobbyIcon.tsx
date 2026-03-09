import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useUserProfileStore } from '../store/userProfileStore';
import { scale } from '../constants';

interface HobbyIconProps {
    style?: StyleProp<ImageStyle>;
    color?: string;
}

export const HobbyIcon: React.FC<HobbyIconProps> = ({ style, color = '#000000' }) => {
    const { selectedHobby } = useUserProfileStore();

    let iconSource;

    switch (selectedHobby) {
        case 'programming':
            iconSource = require('../../assets/images/icons-hobby/code.png');
            break;
        case 'english':
            iconSource = require('../../assets/images/icons-hobby/united-kingdom.png');
            break;
        case 'speed_reading':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'languages':
            iconSource = require('../../assets/images/icons-hobby/china.png');
            break;
        case 'chess':
        default:
            iconSource = require('../../icons/Hourse.png');
            break;
    }

    return (
        <Image
            source={iconSource}
            style={[{ width: scale(24), height: scale(24), tintColor: color }, style]}
            resizeMode="contain"
        />
    );
};
