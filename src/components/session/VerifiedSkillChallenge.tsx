import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from 'react-native';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import type { LearningRecommendation } from '../../domain/sessions/nextBestAction';
import {
    getProgramAvailability,
    getSkillVerification,
    isContentUnavailable,
    startTrustedValidation,
    submitTrustedValidation,
} from '../../services/trustApi';
import type { SkillVerification } from '../../services/trustApi';

/**
 * Slice 1 — prove_skill -> verified skill challenge.
 *
 * The trigger MUST come from the canonical Next Best Action recommendation
 * (see shouldShowVerifyChip). This module never infers readiness itself.
 * Pass/fail comes ONLY from submitTrustedValidation; local stores are
 * never consulted for verified state, so forged local flags cannot
 * produce verified UX.
 */

export interface VerifyChipContext {
    /** Server issuance_enabled for the program. Fail-closed when unknown. */
    issuable: boolean;
    /**
     * Skill keys whose FULL server-derived competency gate is satisfied
     * (same semantics as issuance — never "any pass").
     */
    verifiedSkillKeys: string[];
}

export interface VerifyTarget {
    skillKey: string;
    skillName: string;
}

/**
 * Pure gate: canonical recommendation + server context -> action target.
 * - Only kind === 'prove_skill' exposes an official Verify action.
 * - The skill always comes from the recommendation, never guessed in UI.
 * - Issuance-disabled programs never expose the action.
 * - Already server-verified skills never re-expose it.
 */
export function shouldShowVerifyChip(
    rec: LearningRecommendation | null | undefined,
    ctx: VerifyChipContext,
): VerifyTarget | null {
    if (!rec || rec.type !== 'prove_skill') return null;
    if (!rec.skillKey || !rec.skillName) return null;
    if (!ctx.issuable) return null;
    if (ctx.verifiedSkillKeys.includes(rec.skillKey)) return null;
    return { skillKey: rec.skillKey, skillName: rec.skillName };
}

/**
 * Re-reads the truth: server issuance flag + server-derived FULLY gated
 * skill verification (mirrors the issuance gate — never any-pass).
 * Throws offline/unauthenticated — callers must hide (never invent).
 */
export async function fetchVerifyContext(programSlug: string): Promise<VerifyChipContext> {
    const [programs, skills] = await Promise.all([
        getProgramAvailability(),
        getSkillVerification(programSlug),
    ]);
    const issuable = programs.some(p => p.slug === programSlug && p.issuable);
    return {
        issuable,
        verifiedSkillKeys: skills.filter(s => s.verified).map(s => s.skillKey),
    };
}

export type ChallengePhase = 'loading' | 'answering' | 'submitting' | 'passed' | 'failed' | 'stale' | 'error';

export interface VerifiedSkillChallengeProps {
    visible: boolean;
    programSlug: string;
    skillKey: string;
    skillName: string;
    onClose: () => void;
    /**
     * Server result + the FRESH server-derived verification snapshot for
     * this skill (null when the re-read failed — never claim verified
     * without it). The parent uses the snapshot for messaging and refresh;
     * it performs no counting itself.
     */
    onComplete: (passed: boolean, verification: SkillVerification | null) => void;
}

function promptOf(payload: Record<string, unknown>): string {
    const prompt = payload.prompt ?? payload.question;
    return typeof prompt === 'string' ? prompt : '';
}

function optionsOf(payload: Record<string, unknown>): string[] {
    const options = payload.options;
    if (!Array.isArray(options)) return [];
    return options.filter((o): o is string => typeof o === 'string');
}

/**
 * Lightweight verified-challenge sheet. Renders ONLY the server-returned
 * safe payload (prompt + options/answer input). Item ids, keys, versions
 * and trust metadata are never read, let alone rendered.
 */
export const VerifiedSkillChallenge: React.FC<VerifiedSkillChallengeProps> = ({
    visible,
    programSlug,
    skillKey,
    skillName,
    onClose,
    onComplete,
}) => {
    const { colors } = useAppTheme();
    const [phase, setPhase] = useState<ChallengePhase>('loading');
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [options, setOptions] = useState<string[]>([]);
    const [answer, setAnswer] = useState('');
    const [verification, setVerification] = useState<SkillVerification | null>(null);
    const [contentUnavailable, setContentUnavailable] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const start = useCallback(async () => {
        setPhase('loading');
        setAnswer('');
        setAttemptId(null);
        setVerification(null);
        setContentUnavailable(false);
        try {
            const challenge = await startTrustedValidation(programSlug, skillKey);
            if (!mounted.current) return;
            setAttemptId(challenge.attemptId);
            setPrompt(promptOf(challenge.payload));
            setOptions(optionsOf(challenge.payload));
            setPhase('answering');
        } catch (err) {
            if (!mounted.current) return;
            // Fail-closed server response (no live release) is NOT a
            // network problem: say so explicitly, leak no error codes.
            setContentUnavailable(isContentUnavailable(err instanceof Error ? err.message : String(err)));
            setPhase('error');
        }
    }, [programSlug, skillKey]);

    useEffect(() => {
        if (visible) {
            void start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, programSlug, skillKey]);

    const submit = useCallback(
        async (value: string) => {
            if (!attemptId || phase === 'submitting') return;
            setPhase('submitting');
            try {
                const result = await submitTrustedValidation(attemptId, value);
                if (!mounted.current) return;
                // Rotation superseded the attempt mid-flight: the server
                // recorded nothing. Never render this as pass/fail — offer
                // exactly one action: a fresh check. No internal terms leak.
                if (result.contentStale === true) {
                    setPhase('stale');
                    return;
                }
                const passed = result.passed === true;
                // Re-read authoritative progress, then render from BOTH the
                // server verdict and the full gate state. Completion is never
                // derived from local counters.
                let snapshot: SkillVerification | null = null;
                try {
                    const skills = await getSkillVerification(programSlug);
                    snapshot = skills.find(s => s.skillKey === skillKey) ?? null;
                } catch {
                    snapshot = null;
                }
                if (!mounted.current) return;
                setVerification(snapshot);
                setPhase(passed ? 'passed' : 'failed');
                onComplete(passed, snapshot);
            } catch {
                if (mounted.current) setPhase('error');
            }
        },
        [attemptId, phase, onComplete, programSlug, skillKey],
    );

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>{skillName}</Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {phase === 'loading' && (
                        <View style={styles.center}>
                            <ActivityIndicator size="small" color="#666" />
                            <Text style={[styles.body, { color: colors.textSecondary }]}>Loading challenge…</Text>
                        </View>
                    )}

                    {(phase === 'answering' || phase === 'submitting') && (
                        <View>
                            <Text style={[styles.body, { color: colors.text }]}>{prompt}</Text>
                            {options.length > 0 ? (
                                <View style={styles.options}>
                                    {options.map(opt => (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[styles.option, { backgroundColor: colors.background }]}
                                            onPress={() => void submit(opt)}
                                            disabled={phase === 'submitting'}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            ) : (
                                <View>
                                    <TextInput
                                        style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                                        value={answer}
                                        onChangeText={setAnswer}
                                        placeholder="Your answer…"
                                        placeholderTextColor="#999"
                                        editable={phase === 'answering'}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    <TouchableOpacity
                                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                        onPress={() => void submit(answer)}
                                        disabled={phase === 'submitting' || answer.trim().length === 0}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.primaryText, { color: colors.white }]}>Submit</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                            {phase === 'submitting' && (
                                <ActivityIndicator size="small" color="#666" style={styles.spinner} />
                            )}
                        </View>
                    )}

                    {phase === 'passed' && verification?.verified === true && (
                        <View>
                            <Text style={[styles.result, { color: colors.text }]}>✓ Verified</Text>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                {skillName} verified — nice work, it&apos;s locked in.
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'passed' && verification?.verified !== true && (
                        <View>
                            <Text style={[styles.result, { color: colors.text }]}>Good result</Text>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                {verification
                                    ? `Proof added — verification progress: ${verification.samplesCompleted} of ${verification.samplesRequired} checks completed.`
                                    : 'Proof added — keep going to complete verification.'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'failed' && (
                        <View>
                            <Text style={[styles.result, { color: colors.text }]}>Needs another try</Text>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Not verified yet — no worries. Keep practicing and try another verification when
                                you&apos;re ready.
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'stale' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                This verification was updated. Start a new check.
                            </Text>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[styles.secondary, { backgroundColor: colors.background }]}
                                    onPress={() => void start()}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.secondaryText, { color: colors.text }]}>Start new check</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {phase === 'error' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                {contentUnavailable
                                    ? 'Verification is temporarily unavailable. Try again later.'
                                    : 'Verification needs an internet connection.'}
                            </Text>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[styles.secondary, { backgroundColor: colors.background }]}
                                    onPress={() => void start()}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.secondaryText, { color: colors.text }]}>Retry</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.secondary, { backgroundColor: colors.background }]}
                                    onPress={onClose}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.secondaryText, { color: colors.text }]}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
};

/**
 * Compact Verify action for the Coach conversation. Purely presentational:
 * visibility is decided by shouldShowVerifyChip, never here.
 */
export const VerifySkillCta: React.FC<{ skillName: string; onPress: () => void }> = ({ skillName, onPress }) => {
    const { colors } = useAppTheme();
    return (
        <View style={[styles.ctaCard, { backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.ctaText, { color: colors.text }]}>{skillName} are ready to verify</Text>
            <TouchableOpacity
                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                onPress={onPress}
                activeOpacity={0.7}
            >
                <Text style={[styles.primaryText, { color: colors.white }]}>🎯 Verify {skillName}</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: scale(20),
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    container: {
        width: '100%',
        maxWidth: scale(320),
        borderRadius: scale(24),
        padding: scale(24),
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: scale(12),
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(20),
    },
    close: {
        fontSize: scale(18),
    },
    center: {
        alignItems: 'center',
        paddingVertical: scale(16),
    },
    body: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        marginBottom: scale(12),
    },
    options: {
        gap: scale(8),
    },
    option: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        paddingHorizontal: scale(16),
        marginBottom: scale(8),
    },
    optionText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(15),
    },
    input: {
        borderWidth: 1,
        borderRadius: scale(12),
        paddingVertical: scale(12),
        paddingHorizontal: scale(16),
        fontSize: scale(15),
        marginBottom: scale(12),
    },
    primary: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
        marginTop: scale(4),
    },
    primaryText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
    secondary: {
        flex: 1,
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
    },
    secondaryText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
    },
    row: {
        flexDirection: 'row',
        gap: scale(12),
        marginTop: scale(8),
    },
    result: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(22),
        marginBottom: scale(8),
    },
    spinner: {
        marginTop: scale(12),
    },
    ctaCard: {
        borderRadius: scale(16),
        padding: scale(16),
        marginHorizontal: scale(16),
        marginBottom: scale(8),
    },
    ctaText: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(15),
        marginBottom: scale(10),
    },
});

export default VerifiedSkillChallenge;
