import { Stack } from 'expo-router';

export default function AppLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="home" />
            <Stack.Screen name="screen-time" />
            <Stack.Screen name="statistics" />
            <Stack.Screen name="ai-coach" />
        </Stack>
    );
}
