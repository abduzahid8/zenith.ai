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
