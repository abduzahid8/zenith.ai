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
        case 'logic_puzzles':
            iconSource = require('../../icons/puzzle.png');
            break;
        case 'home_workout':
        case 'running':
        case 'yoga':
        case 'dancing':
        case 'martial_arts':
            iconSource = require('../../icons/dumbbell.png');
            break;
        case 'english':
        case 'languages':
        case 'speed_reading':
        case 'writing':
        case 'journaling':
        case 'planning':
            iconSource = require('../../icons/book.png');
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
