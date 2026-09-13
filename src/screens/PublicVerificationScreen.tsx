import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { verifyCredentialPublic } from '../services/credentialVerification';
import type { PublicCredential } from '../services/credentialVerification';
import { gradeLabel, shortDate } from '../components/credentials/CredentialJourneyBlock';

export type VerificationViewState =
    | 'loading'
    | 'verified'
    | 'revoked'
    | 'expired'
    | 'not_found'
    | 'unavailable';

/**
 * Slice 6 — public credential verification. Works WITHOUT
 * authentication: it calls only the anon-callable verify_credential RPC
 * and renders the safe public projection (never user ids, artifacts,
 * reviewers, keys, or internal IDs).
 */
export const PublicVerificationScreen: React.FC<{ credentialId: string }> = ({ credentialId }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const [state, setState] = useState<VerificationViewState>('loading');
    const [credential, setCredential] = useState<PublicCredential | null>(null);

    const load = useCallback(async () => {
        const id = credentialId.trim();
        if (!id) {
            setCredential(null);
            setState('not_found');
            return;
        }
        setState('loading');
        try {
            const res = await verifyCredentialPublic(id);
            if (!res.found || !res.credential) {
                setCredential(null);
                setState('not_found');
                return;
            }
            setCredential(res.credential);
            if (res.credential.status === 'revoked') {
                setState('revoked');
            } else if (res.credential.status === 'expired') {
                setState('expired');
            } else {
                setState('verified');
            }
        } catch {
            setCredential(null);
            setState('unavailable');
        }
    }, [credentialId]);

    useEffect(() => {
        void load();
    }, [load]);

    const headline = (() => {
        switch (state) {
            case 'verified':
                return 'Verified credential';
            case 'revoked':
                return 'Credential revoked';
            case 'expired':
                return 'Credential expired';
            case 'not_found':
                return 'Credential not found';
            case 'unavailable':
                return 'Verification unavailable';
            case 'loading':
            default:
                return 'Verifying credential';
        }
    })();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.kicker}>Zenyth verification</Text>
                <Text style={styles.title}>{headline}</Text>
                {state === 'loading' && <ActivityIndicator size="small" />}
                {(state === 'verified' || state === 'revoked' || state === 'expired') && credential && (
                    <View style={styles.card}>
                        <Text style={styles.program}>{credential.programTitle}</Text>
                        <Text style={styles.holder}>{credential.holderDisplayName}</Text>
                        <Text style={styles.score}>
                            {Math.round(credential.finalScore)}%
                            {gradeLabel(credential.grade) ? ` · ${gradeLabel(credential.grade)}` : ''}
                        </Text>
                        {credential.verifiedSkills.length > 0 && (
                            <Text style={styles.body}>{credential.verifiedSkills.map(s => s.name).join(' · ')}</Text>
                        )}
                        <Text style={styles.meta}>
                            {shortDate(credential.issuedAt) ? `Issued ${shortDate(credential.issuedAt)}` : ''}
                            {credential.expiresAt && shortDate(credential.expiresAt)
                                ? ` · Expires ${shortDate(credential.expiresAt)}`
                                : ''}
                        </Text>
                        <Text style={styles.meta} selectable>
                            {credential.credentialId}
                        </Text>
                        {state !== 'verified' && (
                            <Text style={styles.body}>
                                {state === 'revoked'
                                    ? 'This credential was revoked and is no longer valid.'
                                    : 'This credential has expired and is no longer valid.'}
                            </Text>
                        )}
                    </View>
                )}
                {state === 'not_found' && (
                    <View style={styles.card}>
                        <Text style={styles.body}>
                            No credential matches this identifier. Check the link and try again.
                        </Text>
                    </View>
                )}
                {state === 'unavailable' && (
                    <View style={styles.card}>
                        <Text style={styles.body}>Verification needs an internet connection.</Text>
                        <TouchableOpacity style={styles.retry} onPress={() => void load()} activeOpacity={0.7}>
                            <Text style={styles.retryText}>Try again</Text>
                        </TouchableOpacity>
                    </View>
                )}
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
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(40),
            paddingTop: scale(24),
        },
        kicker: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: colors.textSecondary,
            marginBottom: scale(4),
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(26),
            lineHeight: scale(32),
            color: colors.text,
            marginBottom: scale(16),
        },
        card: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            padding: scale(20),
        },
        program: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(15),
            color: colors.textSecondary,
            marginBottom: scale(4),
        },
        holder: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
            marginBottom: scale(4),
        },
        score: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(28),
            color: colors.text,
            marginBottom: scale(8),
        },
        body: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.text,
            marginTop: scale(8),
        },
        meta: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
            marginTop: scale(4),
        },
        retry: {
            marginTop: scale(12),
            borderRadius: scale(12),
            paddingVertical: scale(12),
            alignItems: 'center',
            backgroundColor: colors.buttonPrimary,
        },
        retryText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.white,
        },
    });

export default PublicVerificationScreen;
