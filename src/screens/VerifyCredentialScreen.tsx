import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    TextInput,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { parseCredentialId } from '../domain/credentials/scoring';
import { useCredentialStore } from '../store/credentialStore';
import { SkillBar } from '../components/credentials/SkillBar';

/**
 * Public verification page (§12–§14), deep-linkable at
 * zenyth.ai/verify/{credential_id} (and in-app via /verify/[id]).
 * A forged PDF cannot fake this record: unknown IDs show "Not Found",
 * revoked/suspended/expired states are explicit.
 */
export const VerifyCredentialScreen: React.FC = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const initialId = typeof params.id === 'string' ? decodeURIComponent(params.id) : '';

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    const verifyLocal = useCredentialStore(s => s.verifyLocal);

    const [input, setInput] = useState(initialId);
    const [checkedId, setCheckedId] = useState(initialId);

    const parsed = checkedId ? parseCredentialId(checkedId) : null;
    const credential = checkedId ? verifyLocal(checkedId) : null;

    const handleCheck = () => {
        console.log('[Verify] check pressed:', input);
        setCheckedId(input.trim());
    };

    const handleShare = async () => {
        if (!credential) return;
        try {
            await Share.share({ message: `Verify my credential: ${credential.verificationUrl}` });
        } catch {
            // dismissed
        }
    };

    const renderResult = () => {
        if (!checkedId) {
            return <Text style={styles.body}>Enter a credential ID (e.g. ZNY-DAF-26-A81F42) or open a verification link.</Text>;
        }
        if (!parsed) {
            return (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Credential Not Found</Text>
                    <Text style={styles.body}>“{checkedId}” is not a valid Zenyth credential ID.</Text>
                </View>
            );
        }
        if (!credential) {
            return (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Credential Not Found</Text>
                    <Text style={styles.body}>
                        No record matches {parsed.code}-{parsed.year}-{parsed.hash}. The certificate may be forged or
                        issued on another device.
                    </Text>
                </View>
            );
        }
        if (credential.status === 'revoked') {
            return (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Credential Revoked</Text>
                    <Text style={styles.body}>This credential was invalidated by Zenyth AI.</Text>
                </View>
            );
        }
        if (credential.status === 'suspended') {
            return (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Credential Suspended</Text>
                    <Text style={styles.body}>This credential is under review.</Text>
                </View>
            );
        }
        if (credential.status === 'expired') {
            return (
                <View style={styles.resultCard}>
                    <Text style={styles.resultTitle}>Credential Expired</Text>
                    <Text style={styles.body}>This credential expired and needs renewal.</Text>
                </View>
            );
        }
        return (
            <View style={styles.verifiedCard}>
                <Text style={styles.resultTitle}>Verified Credential ✓</Text>
                <Text style={styles.holder}>{credential.holderName}</Text>
                <Text style={styles.body}>has successfully earned</Text>
                <Text style={styles.program}>{credential.programTitle}</Text>
                <Text style={styles.body}>
                    Issued {new Date(credential.issuedAt).toLocaleDateString()} · ID {credential.credentialId} ·
                    Credential standard v{credential.programVersion}
                </Text>
                <Text style={styles.sectionHead}>Skills Demonstrated</Text>
                {credential.skills.map(s => (
                    <SkillBar key={s.key} name={s.name} score={s.score} minimumScore={0} />
                ))}
                <Text style={styles.sectionHead}>Assessment</Text>
                <Text style={styles.body}>Overall score: {Math.round(credential.finalScore)}% ({credential.grade})</Text>
                <Text style={styles.sectionHead}>Evidence</Text>
                <Text style={styles.body}>
                    {credential.evidence.learningHours} hours of learning · {credential.evidence.tasksCompleted} tasks ·{' '}
                    {credential.evidence.assessmentsTaken} assessment answers · {credential.evidence.projectsCompleted}{' '}
                    final project
                </Text>
                <Text style={styles.issuer}>Issued by Zenyth AI</Text>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
                    <Text style={styles.shareText}>Share credential</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        console.log('[Verify] Back pressed');
                        router.back();
                    }}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Verify</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={styles.heading}>Zenyth Verified Credential</Text>
                <View style={styles.inputRow}>
                    <TextInput
                        style={styles.input}
                        placeholder="ZNY-XXX-YY-HASH"
                        autoCapitalize="characters"
                        value={input}
                        onChangeText={setInput}
                    />
                    <TouchableOpacity style={styles.checkBtn} onPress={handleCheck} activeOpacity={0.85}>
                        <Text style={styles.checkText}>Check</Text>
                    </TouchableOpacity>
                </View>
                {renderResult()}
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
            gap: scale(12),
            paddingHorizontal: scale(20),
            paddingTop: scale(8),
            paddingBottom: scale(4),
        },
        backButton: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        backText: {
            fontFamily: fonts.body.regular,
            fontSize: scale(16),
            color: colors.text,
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            color: colors.text,
        },
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(60),
        },
        heading: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
            marginVertical: scale(12),
        },
        inputRow: {
            flexDirection: 'row',
            gap: scale(10),
            marginBottom: scale(16),
        },
        input: {
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderRadius: scale(12),
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: scale(14),
            paddingVertical: scale(12),
            fontSize: scale(15),
            color: colors.text,
        },
        checkBtn: {
            backgroundColor: '#102852',
            borderRadius: scale(50),
            paddingHorizontal: scale(24),
            justifyContent: 'center',
        },
        checkText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: '#FFFFFF',
        },
        resultCard: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            padding: scale(16),
        },
        verifiedCard: {
            backgroundColor: '#D1FAE5',
            borderRadius: scale(16),
            padding: scale(16),
        },
        resultTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            color: colors.text,
            marginBottom: scale(8),
        },
        holder: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(22),
            color: colors.text,
        },
        program: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: colors.text,
            marginVertical: scale(6),
        },
        body: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: colors.text,
            marginBottom: scale(6),
        },
        sectionHead: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: colors.text,
            marginTop: scale(10),
            marginBottom: scale(6),
        },
        issuer: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: colors.text,
            marginTop: scale(12),
        },
        shareBtn: {
            marginTop: scale(12),
            backgroundColor: '#102852',
            borderRadius: scale(50),
            paddingVertical: scale(12),
            alignItems: 'center',
        },
        shareText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: '#FFFFFF',
        },
    });

export default VerifyCredentialScreen;
