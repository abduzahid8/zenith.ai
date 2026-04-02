import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useUserProfileStore } from '../store/userProfileStore';
import { scale } from '../constants';

interface HobbyIconProps {
    style?: StyleProp<ImageStyle>;
}

export const HobbyIcon: React.FC<HobbyIconProps> = ({ style }) => {
    const { selectedHobby } = useUserProfileStore();

    let iconSource;

    switch (selectedHobby) {
        // Technology / Code
        case 'python':
        case 'programming':
        case 'web_design':
        case 'mobile_design':
        case 'video_editing':
        case '3d_motion':
        case 'content_creation':
            iconSource = require('../../assets/images/icons-hobby/code.png');
            break;
        // English
        case 'english':
        case 'public_speaking':
            iconSource = require('../../assets/images/icons-hobby/united-kingdom.png');
            break;
        // Chinese / Other languages
        case 'chinese':
        case 'languages':
            iconSource = require('../../assets/images/icons-hobby/china.png');
            break;
        // Reading / Writing / Knowledge
        case 'reading':
        case 'speed_reading':
        case 'chess':
        case 'logic_puzzles':
        case 'writing':
        case 'journaling':
        case 'planning':
        case 'finance':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        // Physical / Mindfulness / Creative — fallback
        case 'drawing':
        case 'music':
        case 'photography':
        case 'home_workout':
        case 'running':
        case 'yoga':
        case 'dancing':
        case 'martial_arts':
        case 'meditation':
        case 'cooking':
        default:
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
    }

    return (
        <Image
            source={iconSource}
            style={[{ width: scale(24), height: scale(24) }, style]}
            resizeMode="contain"
        />
    );
};
