import { requireNativeModule } from 'expo-modules-core';
import { PermissionsAndroid, Platform } from 'react-native';

let SmsReaderModule: ReturnType<typeof requireNativeModule> | null = null;

function getSmsReader() {
    if (SmsReaderModule) return SmsReaderModule;
    if (Platform.OS === 'android') {
        try {
            SmsReaderModule = requireNativeModule('SmsReader');
        } catch (e) {
            SmsReaderModule = null;
        }
    }
    return SmsReaderModule;
}

export interface SmsMessage {
    address: string;
    body: string;
    date: number;
}

export async function getAllSms(limit: number = 50): Promise<SmsMessage[]> {
    const SmsReader = getSmsReader();
    if (Platform.OS !== 'android' || !SmsReader) return [];
    const hasPermission = await requestSmsPermission();
    if (!hasPermission) return [];

    return (SmsReader as any).getAllSms(limit);
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
