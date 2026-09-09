import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { CREDENTIAL_PROGRAMS, programShortTitle } from '../domain/credentials/catalog';
import { useCredentialStore } from '../store/credentialStore';
import { useAllCertificateProgress } from '../hooks/useCertificateProgress';
import { ProgressBar } from '../components/credentials/SkillBar';

/**
 * Skills hub — what can I already prove?
 * One canonical overall per program; no XP headers, no extra metrics.
 * Exam/project/issuance UI arrives with the backend phases.
 */
export const CredentialsScreen: React.FC = () => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const allCert = useAllCertificateProgress();
    const enroll = useCredentialStore(s => s.enroll);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        console.log('[Credentials] Back pressed');
                        router.back();
                    }}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{t('Мои навыки')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {CREDENTIAL_PROGRAMS.map(program => {
                    const cert = allCert[program.slug];
                    const enrolled = cert?.enrolled ?? false;
                    const pct = cert ? Math.round(cert.overall) : 0;
                    return (
                        <View key={program.slug} style={styles.card}>
                            <Text style={styles.cardTitle}>{programShortTitle(program.title)}</Text>
                            {enrolled ? (
                                <>
                                    <Text style={styles.cardPct}>{pct}%</Text>
                                    <ProgressBar value={pct} />
                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.85}
                                        onPress={() => {
                                            console.log('[Credentials] Program pressed:', program.slug);
                                            router.push(`/credential/${program.slug}` as any);
                                        }}
                                    >
                                        <Text style={styles.secondaryText}>{t('Подробнее')}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        console.log('[Credentials] Enroll pressed:', program.slug);
                                        enroll(program.slug);
                                        router.push(`/credential/${program.slug}` as any);
                                    }}
                                >
                                    <Text style={styles.primaryText}>{t('Начать проверку')}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: scale(16),
            paddingTop: scale(8),
            paddingBottom: scale(12),
            gap: scale(12),
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: scale(6),
        },
        backText: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(16),
            color: colors.text,
        },
        title: {
            flex: 1,
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
        },
        card: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(25),
            padding: scale(20),
            marginBottom: scale(12),
        },
        cardTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(19),
            color: colors.text,
            marginBottom: scale(8),
        },
        cardPct: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(32),
            color: colors.text,
            marginBottom: scale(8),
        },
        primaryButton: {
            marginTop: scale(12),
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
        },
        primaryText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#FFFFFF',
        },
        secondaryButton: {
            marginTop: scale(12),
            borderRadius: 9999,
            borderWidth: 1.5,
            borderColor: '#0F2147',
            height: scale(52),
            justifyContent: 'center',
            alignItems: 'center',
        },
        secondaryText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.text,
        },
    });

export default CredentialsScreen;
