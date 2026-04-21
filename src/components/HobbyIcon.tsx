import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';
import { useUserProfileStore } from '../store/userProfileStore';
import { scale } from '../constants';
import { getHobbyIconSource } from '../data/hobbyIconAssets';

interface HobbyIconProps {
    style?: StyleProp<ViewStyle>;
}

export const HobbyIcon: React.FC<HobbyIconProps> = ({ style }) => {
    const { selectedHobby } = useUserProfileStore();
    const source = getHobbyIconSource(selectedHobby);

    return (
        <View style={[{ width: scale(24), height: scale(24), alignItems: 'center', justifyContent: 'center' }, style]}>
            <Image source={source} style={{ width: scale(22), height: scale(22) }} resizeMode="contain" />
        </View>
    );
};
