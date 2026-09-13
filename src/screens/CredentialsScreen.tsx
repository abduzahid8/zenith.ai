import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
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
import { resolveAuthoritativeEnrolled } from '../domain/credentials/enrollmentTruth';
import { useServerEnrollment } from '../hooks/useServerEnrollment';
import { ProgressBar } from '../components/credentials/SkillBar';
import { ensureEnrollment, getCredentialStatus, getProgramAvailability } from '../services/trustApi';
import type { CredentialClaimStatus } from '../services/trustApi';

const HUB_PROGRAM_SLUGS = CREDENTIAL_PROGRAMS.map(p => p.slug);

/**
 * Skills hub — what can I already prove?
 * One canonical overall per program; no XP headers, no extra metrics.
 *
 * Slice 6: program availability (issuance_enabled) and the server
 * claim status decide what each card promises. Programs whose issuance
 * is disabled never show claim/verification actions — only learning.
 *
 * Enrollment truth (unification): enrolled/locked gating comes ONLY from
 * the server-backed read (useServerEnrollment — same version-pinned
 * source the credential journey treats as enrollment). The local
 * credentialStore flag is a historical cache and is never authority here.
 */
export const CredentialsScreen: React.FC = () => {
    const router = useRouter();
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const allCert = useAllCertificateProgress();
    // Local projection (percent bars) only — never enrollment authority.
    const { status: serverStatus, refresh: refreshServerEnrollment } =
        useServerEnrollment(HUB_PROGRAM_SLUGS);
    const [enrolling, setEnrolling] = useState<Record<string, boolean>>({});
    // Server availability + claim status. Unknown while loading: cards
    // fall back to the learning view, never to claim affordances.
    const [issuable, setIssuable] = useState<Record<string, boolean> | null>(null);
    const [claim, setClaim] = useState<Record<string, CredentialClaimStatus>>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const programs = await getProgramAvailability();
                if (cancelled) return;
                const map: Record<string, boolean> = {};
                for (const p of programs) map[p.slug] = p.issuable === true;
                setIssuable(map);
                const next: Record<string, CredentialClaimStatus> = {};
                for (const p of programs) {
                    if (p.issuable !== true) continue;
                    try {
                        next[p.slug] = await getCredentialStatus(p.slug);
                    } catch {
                        // Per-program failure: omit the badge, keep learning.
                    }
                }
                if (!cancelled) setClaim(next);
            } catch {
                if (!cancelled) setIssuable(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const openDetail = (slug: string) => {
        console.log('[Credentials] Program pressed:', slug);
        router.push(`/credential/${slug}` as any);
    };

    // Server enrollment first (idempotent). Only after the server confirms
    // do we mirror into the local cache (cache only, never authority) and
    // re-read server truth — no optimistic enrollment, ever. On failure we
    // stay put with the CTA re-enabled; nothing is faked.
    const enrollProgram = (slug: string) => {
        if (enrolling[slug]) return;
        setEnrolling(prev => ({ ...prev, [slug]: true }));
        void (async () => {
            try {
                await ensureEnrollment(slug);
                useCredentialStore.getState().enroll(slug);
                refreshServerEnrollment();
                openDetail(slug);
            } catch {
                // Network/server failure: no state change, user can retry.
            } finally {
                setEnrolling(prev => ({ ...prev, [slug]: false }));
            }
        })();
    };

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
                    // Authoritative enrollment: server only. A stale local
                    // flag can neither enroll nor unenroll this card.
                    const serverState = serverStatus[program.slug] ?? 'unknown';
                    const enrolled = resolveAuthoritativeEnrolled(serverState) === true;
                    // Disabled issuance can never enroll: those cards keep
                    // the learning-only fallback regardless of server state.
                    const enrollmentUnknown =
                        resolveAuthoritativeEnrolled(serverState) === null;
                    const pct = cert ? Math.round(cert.overall) : 0;
                    // Disabled issuance must never look issuable. Unknown
                    // (loading/offline) defaults to the learning view.
                    const disabled = issuable !== null && issuable[program.slug] !== true;
                    const state = claim[program.slug]?.state ?? null;
                    const stateLine =
                        state === 'issued'
                            ? `Issued${claim[program.slug].score != null ? ` · ${Math.round(claim[program.slug].score!)}%` : ''}`
                            : state === 'ready_to_issue'
                              ? 'Ready to claim'
                              : state === 'revoked'
                                ? 'Revoked'
                                : state === 'expired'
                                  ? 'Expired'
                                  : null;
                    return (
                        <View key={program.slug} style={styles.card}>
                            <Text style={styles.cardTitle}>{programShortTitle(program.title)}</Text>
                            {stateLine && <Text style={styles.stateLine}>{stateLine}</Text>}
                            {disabled && <Text style={styles.stateLine}>{t('Credential unavailable')}</Text>}
                            {enrolled ? (
                                <>
                                    <Text style={styles.cardPct}>{pct}%</Text>
                                    <ProgressBar value={pct} />
                                    <TouchableOpacity
                                        style={styles.secondaryButton}
                                        activeOpacity={0.85}
                                        onPress={() => openDetail(program.slug)}
                                    >
                                        <Text style={styles.secondaryText}>{t('Подробнее')}</Text>
                                    </TouchableOpacity>
                                </>
                            ) : !disabled && (enrollmentUnknown || enrolling[program.slug]) ? (
                                // Server state not yet known (or enroll call
                                // in flight): neutral loading, never a claim
                                // in either direction.
                                <View style={styles.primaryButton}>
                                    <ActivityIndicator color="#FFFFFF" />
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={styles.primaryButton}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        if (disabled) {
                                            // No verification can start here:
                                            // view learning only, enroll nothing.
                                            openDetail(program.slug);
                                            return;
                                        }
                                        console.log('[Credentials] Enroll pressed:', program.slug);
                                        enrollProgram(program.slug);
                                    }}
                                >
                                    <Text style={styles.primaryText}>
                                        {disabled ? t('Подробнее') : t('Начать проверку')}
                                    </Text>
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
        stateLine: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(14),
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
