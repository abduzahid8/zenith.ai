import { Stack } from 'expo-router';

export default function AppLayout() {
    return (
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="home" />
            <Stack.Screen name="weekly-plan" />
            <Stack.Screen name="ai-coach" />
            <Stack.Screen name="screen-time" />
        </Stack>
    );
}
