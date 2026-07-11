/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.tsx'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    setupFiles: ['<rootDir>/src/__tests__/__setup__/componentSetup.ts'],
    moduleNameMapper: {
        '^react-native$':
            '<rootDir>/src/__tests__/__mocks__/reactNativeComponent.ts',
        '^@react-native-async-storage/async-storage$':
            '<rootDir>/src/__tests__/__mocks__/asyncStorage.ts',
        '^react-native-safe-area-context$':
            '<rootDir>/src/__tests__/__mocks__/safeArea.ts',
    },
    transformIgnorePatterns: ['/node_modules/'],
    watchman: false,
};
