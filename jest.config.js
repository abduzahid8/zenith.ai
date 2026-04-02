/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    // Mock React Native and AsyncStorage for pure logic tests
    moduleNameMapper: {
        '^@react-native-async-storage/async-storage$':
            '<rootDir>/src/__tests__/__mocks__/asyncStorage.ts',
        '^react-native$': '<rootDir>/src/__tests__/__mocks__/reactNative.ts',
        '^react-native-url-polyfill/auto$':
            '<rootDir>/src/__tests__/__mocks__/emptyMock.ts',
    },
    // Ignore node_modules except Expo packages if needed
    transformIgnorePatterns: ['/node_modules/'],
};
