import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator, FlatList, TextInput, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { requestUsagePermission, hasUsagePermission, getUsageStats } from 'device-activity';
import { requestSmsPermission, getAllSms } from 'sms-reader';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { scale } from '../constants';

interface UsageStat {
    packageName: string;
    totalTimeInForeground: number;
}

interface SmsMessage {
    address: string;
    body: string;
}

export default function PhoneAnalysisScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [hasUsagePerm, setHasUsagePerm] = useState(false);
    const [hasSmsPerm, setHasSmsPerm] = useState(false);
    const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
    const [smsMessages, setSmsMessages] = useState<SmsMessage[]>([]);
    const [step, setStep] = useState<'instruction' | 'input'>('instruction');

    useEffect(() => {
        if (Platform.OS === 'android') {
            checkPermissions();
        }
    }, []);

    const checkPermissions = async () => {
        try {
            const usage = await hasUsagePermission();
            setHasUsagePerm(usage);
        } catch (e) {
            console.error(e);
        }
    };

    const handleGrantUsage = async () => {
        await requestUsagePermission();
    };

    const handleGrantSms = async () => {
        const granted = await requestSmsPermission();
        setHasSmsPerm(granted);
        if (granted) fetchData();
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            if (hasUsagePerm) {
                const now = Date.now();
                const yesterday = now - 24 * 60 * 60 * 1000;
                const stats = await getUsageStats(yesterday, now);
                setUsageStats(stats.sort((a: UsageStat, b: UsageStat) => b.totalTimeInForeground - a.totalTimeInForeground));
            }

            if (hasSmsPerm) {
                const sms = await getAllSms(20);
                setSmsMessages(sms);
            }
        } catch (e) {
            console.error("Error fetching data", e);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (ms: number) => {
        const minutes = Math.floor(ms / 1000 / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    };

    const [manualTime, setManualTime] = useState('');
    const [manualApp, setManualApp] = useState('');

    const openIosSettings = () => {
        Linking.openURL('App-Prefs:root=SCREEN_TIME').catch(() => {
            Linking.openSettings();
        });
    };

    if (Platform.OS !== 'android') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={[styles.header, { borderBottomWidth: 0 }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Image source={require('../../icons/back.png')} style={{ width: scale(24), height: scale(24), tintColor: '#000' }} resizeMode="contain" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Data Analysis</Text>
                </View>

                <View style={styles.centerContent}>
                    {step === 'instruction' ? (
                        <View style={styles.card}>
                            <View style={styles.iconCircle}>
                                <Image source={require('../../icons/magnifier.png')} style={{ width: scale(32), height: scale(32), tintColor: colors.link }} resizeMode="contain" />
                            </View>
                            <Text style={styles.cardTitle}>Check Screen Time</Text>
                            <Text style={styles.cardBody}>
                                Due to Apple's privacy policy, we need you to check your data in Settings.
                            </Text>

                            <TouchableOpacity
                                style={[styles.button, styles.primaryButton]}
                                onPress={() => {
                                    openIosSettings();
                                    setTimeout(() => setStep('input'), 1000);
                                }}
                            >
                                <Ionicons name="open-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryButtonText}>Open Settings</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.textButton} onPress={() => setStep('input')}>
                                <Text style={styles.textButtonText}>I already have the data</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            <TouchableOpacity onPress={() => setStep('instruction')} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 20 }}>
                                <Image source={require('../../icons/back.png')} style={{ width: scale(20), height: scale(20), tintColor: colors.link, marginRight: 4 }} resizeMode="contain" />
                                <Text style={{ color: colors.link, fontSize: 16 }}>Back</Text>
                            </TouchableOpacity>

                            <Text style={styles.cardTitle}>Enter Your Data</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Total Screen Time (Today)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. 4h 12m"
                                    value={manualTime}
                                    onChangeText={setManualTime}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Most Used App</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Instagram"
                                    value={manualApp}
                                    onChangeText={setManualApp}
                                />
                            </View>

                            <TouchableOpacity style={[styles.button, styles.primaryButton, { marginTop: 10 }]} onPress={() => alert('Data saved!')}>
                                <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                <Text style={styles.primaryButtonText}>Save Data</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Image source={require('../../icons/back.png')} style={{ width: scale(24), height: scale(24), tintColor: '#000' }} resizeMode="contain" />
                </TouchableOpacity>
                <Text style={styles.title}>Data Analysis</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>App Usage (Last 24h)</Text>
                    {hasUsagePerm ? (
                        <View>
                            {usageStats.length > 0 ? (
                                usageStats.slice(0, 10).map((item, index) => (
                                    <View key={index} style={styles.statItem}>
                                        <Text style={styles.appName}>{item.packageName.split('.').pop()}</Text>
                                        <Text style={styles.appTime}>{formatTime(item.totalTimeInForeground)}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text>No usage data available (or refresh needed)</Text>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleGrantUsage}>
                            <Text style={styles.buttonText}>Enable Usage Access</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Recent SMS Analysis</Text>
                    {hasSmsPerm ? (
                        <View>
                            {smsMessages.length > 0 ? (
                                smsMessages.map((msg, index) => (
                                    <View key={index} style={styles.smsItem}>
                                        <Text style={styles.smsAddress}>{msg.address}</Text>
                                        <Text numberOfLines={1} style={styles.smsBody}>{msg.body}</Text>
                                    </View>
                                ))
                            ) : (
                                <Text>No SMS found</Text>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.button} onPress={handleGrantSms}>
                            <Text style={styles.buttonText}>Grant SMS Permission</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity style={[styles.button, styles.refreshButton]} onPress={() => { checkPermissions(); fetchData(); }}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Refresh Data</Text>}
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: colors.phoneAnalysis.cardBg,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 12,
        color: colors.text,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    message: {
        textAlign: 'center',
        color: colors.textSecondary,
        fontSize: 16,
    },
    button: {
        backgroundColor: colors.black,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonText: {
        color: colors.white,
        fontWeight: '600',
    },
    refreshButton: {
        backgroundColor: colors.text,
        marginTop: 20,
    },
    statItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    appName: {
        fontSize: 14,
        fontWeight: '500',
    },
    appTime: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    smsItem: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    smsAddress: {
        fontSize: 12,
        fontWeight: 'bold',
        color: colors.text,
    },
    smsBody: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    messageText: {
        fontSize: 15,
        color: colors.textMuted,
        lineHeight: 22,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 8,
        color: colors.text,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: colors.white,
    },
    // Styles for iOS Step Flow
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        backgroundColor: colors.phoneAnalysis.secondaryBg,
    },
    card: {
        backgroundColor: colors.white,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        shadowColor: colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        width: '100%',
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.phoneAnalysis.highlightBg,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    cardTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        color: colors.black,
    },
    cardBody: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    primaryButton: {
        backgroundColor: colors.phoneAnalysis.actionBg,
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        marginBottom: 16,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    primaryButtonText: {
        color: colors.white,
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'center',
    },
    textButton: {
        padding: 12,
    },
    textButtonText: {
        color: colors.link,
        fontSize: 16,
        fontWeight: '500',
    }
});
