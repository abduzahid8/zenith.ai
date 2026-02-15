import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export interface TimerProgressProps {
    /** Progress value from 0.0 to 1.0 */
    progress: number;
    /** Diameter of the circle in px */
    size: number;
    /** Width of the ring stroke */
    strokeWidth: number;
    /** Color of the filled arc */
    color: string;
    /** Color of the background track arc */
    trackColor: string;
    children: React.ReactNode;
}

const TimerProgress: React.FC<TimerProgressProps> = ({
    progress,
    size,
    strokeWidth,
    color,
    trackColor,
    children,
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - progress * circumference;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
                {/* Track */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </Svg>
            {children}
        </View>
    );
};

export default TimerProgress;
