/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src', '<rootDir>/db-test'],
    testMatch: ['**/__tests__/**/*.e2e.test.ts'],
    testTimeout: 60000,
    globalSetup: '<rootDir>/db-test/setup.ts',
    globalTeardown: '<rootDir>/db-test/teardown.ts',
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
    moduleNameMapper: {
        '^@react-native-async-storage/async-storage$':
            '<rootDir>/src/__tests__/__mocks__/asyncStorage.ts',
        '^react-native$': '<rootDir>/src/__tests__/__mocks__/reactNative.ts',
        '^react-native-url-polyfill/auto$':
            '<rootDir>/src/__tests__/__mocks__/emptyMock.ts',
    },
    transformIgnorePatterns: ['/node_modules/'],
    watchman: false,
};
