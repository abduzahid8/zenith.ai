import React from 'react';

const noop = () => {};

// Minimal mock of react-native for component rendering
const RN: any = {
    StyleSheet: {
        create: (styles: any) => {
            const result: any = {};
            for (const key of Object.keys(styles)) {
                result[key] = {};
                for (const prop of Object.keys(styles[key])) {
                    result[key][prop] = styles[key][prop];
                }
            }
            return result;
        },
        hairlineWidth: () => 1,
        flatten: (style: any) => style,
    },
    View: ({ children, style, ...props }: any) =>
        React.createElement('View', { style: JSON.stringify(style), ...props }, children),
    Text: ({ children, style, ...props }: any) =>
        React.createElement('Text', { style: JSON.stringify(style), ...props }, children),
    TouchableOpacity: ({ children, onPress, style, activeOpacity, ...props }: any) =>
        React.createElement(
            'TouchableOpacity',
            { ...props, onPress, style: JSON.stringify(style) },
            children,
        ),
    ScrollView: ({ children, contentContainerStyle, ...props }: any) =>
        React.createElement(
            'ScrollView',
            { ...props, style: JSON.stringify(contentContainerStyle) },
            children,
        ),
    Alert: {
        alert: jest.fn(),
    },
    Animated: {
        Value: jest.fn(() => ({
            interpolate: jest.fn(),
            setValue: jest.fn(),
            _value: 0,
        })),
        timing: jest.fn(() => ({
            start: jest.fn((cb?: any) => cb?.()),
        })),
        spring: jest.fn(() => ({
            start: jest.fn(),
        })),
        View: ({ children, style, ...props }: any) =>
            React.createElement('View', { style: JSON.stringify(style), ...props }, children),
        Text: ({ children, style, ...props }: any) =>
            React.createElement('Text', { style: JSON.stringify(style), ...props }, children),
        ScrollView: ({ children, ...props }: any) =>
            React.createElement('ScrollView', props, children),
    },
    Dimensions: {
        get: () => ({ width: 390, height: 844 }),
        addEventListener: jest.fn(),
    },
    Platform: {
        OS: 'ios',
        select: (obj: any) => obj.ios,
        Version: '26.1',
    },
    PixelRatio: {
        get: () => 3,
        getFontScale: () => 1,
        roundToNearestPixel: (n: number) => n,
    },
    StatusBar: {
        currentHeight: 0,
    },
    Image: 'Image',
    ActivityIndicator: 'ActivityIndicator',
    AppState: {
        addEventListener: jest.fn(() => ({ remove: jest.fn() })),
        currentState: 'active',
    },
};

export default RN;
module.exports = RN;
