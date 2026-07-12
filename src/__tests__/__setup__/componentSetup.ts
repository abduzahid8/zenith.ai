jest.mock('expo-router', () => ({
    useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
    useLocalSearchParams: () => ({ goalId: 'test-goal-1' }),
    useSegments: () => (['(app)']),
    Stack: { Screen: () => null },
}));

jest.mock('../../constants', () => ({
    FIGMA_WIDTH: 402,
    SCREEN_WIDTH: 390,
    SCREEN_HEIGHT: 844,
    IS_TABLET: false,
    MAX_CONTENT_WIDTH: 620,
    scale: (n: number) => Math.round(n * (390 / 402)),
}));

jest.mock('react-native-svg', () => {
    const React = require('react');
    const svg = {
        __esModule: true,
        default: 'SvgMock',
        Svg: (props: any) => React.createElement('View', props, props.children),
        Circle: (props: any) => React.createElement('View', props),
        Path: (props: any) => React.createElement('View', props),
        Defs: (props: any) => React.createElement('View', props, props.children),
        LinearGradient: (props: any) => React.createElement('View', props),
        Stop: (props: any) => React.createElement('View', props),
        Polyline: (props: any) => React.createElement('View', props),
        Line: (props: any) => React.createElement('View', props),
    };
    return svg;
});

jest.mock('../../theme', () => ({
    fonts: {
        heading: {
            black: 'System',
            bold: 'System',
            medium: 'System',
            regular: 'System',
            light: 'System',
            extraLight: 'System',
        },
        body: {
            regular: 'System',
            light: 'System',
            medium: 'System',
            extraLight: 'System',
        },
    },
}));
