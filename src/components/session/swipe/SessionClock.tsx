import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';

interface SessionClockProps {
    paused: boolean;
    stopped: boolean;
    onTick: (seconds: number) => void;
}

function formatElapsed(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Isolated session clock: owns its interval so ticking never rerenders the
 * card tree (60fps-friendly). Reports elapsed seconds upward by ref callback.
 */
export const SessionClock: React.FC<SessionClockProps> = ({ paused, stopped, onTick }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        if (paused || stopped) return;
        const id = setInterval(() => {
            setSeconds(prev => {
                const next = prev + 1;
                onTick(next);
                return next;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [paused, stopped, onTick]);

    return (
        <Text style={styles.timeText}>
            {paused ? '▶' : '❚❚'} {formatElapsed(seconds)}
        </Text>
    );
};

export const SessionClockPill: React.FC<SessionClockProps> = props => (
    <TouchableOpacity style={styles.timePill} activeOpacity={0.7}>
        <SessionClock {...props} />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    timePill: {
        backgroundColor: 'rgba(91, 163, 230, 0.12)',
        borderRadius: scale(16),
        paddingHorizontal: scale(14),
        paddingVertical: scale(6),
    },
    timeText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: '#2B5B84',
    },
});

export default SessionClock;
