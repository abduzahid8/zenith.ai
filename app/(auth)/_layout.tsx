import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="email-confirmation" />
            <Stack.Screen name="registration-success" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="reset-password" />
        </Stack>
    );
}
