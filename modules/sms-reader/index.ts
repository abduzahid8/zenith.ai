import { requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

const SmsReader = Platform.OS === 'android' ? requireNativeModule('SmsReader') : null;

export interface SmsMessage {
    address: string;
    body: string;
    date: number;
}

export async function getAllSms(limit: number = 50): Promise<SmsMessage[]> {
    if (Platform.OS !== 'android' || !SmsReader) return [];
    const hasPermission = await requestSmsPermission();
    if (!hasPermission) return [];

    return SmsReader.getAllSms(limit);
}

export async function requestSmsPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    try {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_SMS,
            {
                title: 'SMS Permission',
                message: 'This app needs access to your SMS to analyze data.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
            },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
        console.warn(err);
        return false;
    }
}
