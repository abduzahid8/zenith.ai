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
        case 'logic_puzzles':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'web_design':
        case 'mobile_design':
        case 'drawing':
            iconSource = require('../../assets/images/icons-hobby/code.png');
            break;
        case 'video_editing':
        case '3d_motion':
        case 'content_creation':
            iconSource = require('../../assets/images/icons-hobby/code.png');
            break;
        case 'music':
        case 'public_speaking':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'photography':
        case 'writing':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'home_workout':
        case 'running':
        case 'yoga':
        case 'dancing':
        case 'martial_arts':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'meditation':
        case 'journaling':
        case 'planning':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
        case 'cooking':
        case 'finance':
            iconSource = require('../../assets/images/icons-hobby/book-icon.png');
            break;
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
