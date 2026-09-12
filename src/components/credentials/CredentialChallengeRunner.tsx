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
import {
    isContentUnavailable,
    startKnowledgeAttempt,
    submitKnowledgeAttempt,
} from '../../services/trustApi';

/**
 * Slice 2 — one reusable challenge runner, knowledge mode only.
 * (The `mode` prop reserves practical/final for later slices; only
 * "knowledge" is implemented — anything else renders nothing.)
 *
 * Authority rules, mirroring the verified-challenge contract:
 * - questions come ONLY from startKnowledgeAttempt (server-assigned;
 *   an existing active attempt resumes — never a client identity);
 * - answers submit keyed by public item_key; the client never grades;
 * - the server verdict (including score, staleness) is rendered as-is;
 * - content-unavailable is a valid server answer with its own copy.
 */

export type RunnerMode = 'knowledge';

export interface KnowledgeQuestion {
    itemKey: string;
    prompt: string;
    options: string[];
}

export interface KnowledgeSubmitResult {
    passed: boolean;
    score: number | null;
    contentStale: boolean;
}

export interface CredentialChallengeRunnerProps {
    visible: boolean;
    mode: RunnerMode;
    programSlug: string;
    programTitle: string;
    onClose: () => void;
    onComplete: (result: KnowledgeSubmitResult) => void;
}

type RunnerPhase =
    | 'loading'
    | 'answering'
    | 'submitting'
    | 'passed'
    | 'failed'
    | 'stale'
    | 'unavailable'
    | 'error';

function toQuestion(raw: unknown): KnowledgeQuestion | null {
    if (raw == null || typeof raw !== 'object') return null;
    const q = raw as {
        item_key?: unknown;
        itemKey?: unknown;
        skill?: unknown;
        prompt?: unknown;
        question?: unknown;
        options?: unknown;
        payload?: unknown;
    };
    const key = q.item_key ?? q.itemKey;
    if (typeof key !== 'string') return null;
    // Server shape nests prompt/options under payload; accept flat too.
    const payload = (q.payload != null && typeof q.payload === 'object'
        ? (q.payload as { prompt?: unknown; question?: unknown; options?: unknown })
        : null);
    const prompt = payload?.prompt ?? payload?.question ?? q.prompt ?? q.question;
    const rawOptions = payload?.options ?? q.options;
    const options = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === 'string') : [];
    // Safe projection only: never carry answer keys, thresholds, or bank ids.
    return { itemKey: key, prompt: typeof prompt === 'string' ? prompt : '', options };
}

export const CredentialChallengeRunner: React.FC<CredentialChallengeRunnerProps> = ({
    visible,
    mode,
    programSlug,
    programTitle,
    onClose,
    onComplete,
}) => {
    const { colors } = useAppTheme();
    const [phase, setPhase] = useState<RunnerPhase>('loading');
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<KnowledgeQuestion[]>([]);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState<number | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const start = useCallback(async () => {
        setPhase('loading');
        setAnswers({});
        setIndex(0);
        setAttemptId(null);
        setScore(null);
        try {
            const started = await startKnowledgeAttempt(programSlug);
            if (!mounted.current) return;
            const parsed = started.questions.map(toQuestion).filter((q): q is KnowledgeQuestion => q !== null);
            if (parsed.length === 0) {
                setPhase('error');
                return;
            }
            setAttemptId(started.attemptId);
            setQuestions(parsed);
            setPhase('answering');
        } catch (err) {
            if (!mounted.current) return;
            const message = err instanceof Error ? err.message : String(err);
            setPhase(isContentUnavailable(message) ? 'unavailable' : 'error');
        }
    }, [programSlug]);

    useEffect(() => {
        if (visible && mode === 'knowledge') {
            void start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, mode, programSlug]);

    const submit = useCallback(async () => {
        if (!attemptId || phase === 'submitting') return;
        setPhase('submitting');
        try {
            const result = await submitKnowledgeAttempt(attemptId, answers);
            if (!mounted.current) return;
            if (result.contentStale) {
                setPhase('stale');
                return;
            }
            const passed = result.passed === true;
            setScore(result.score);
            setPhase(passed ? 'passed' : 'failed');
            onComplete({ passed, score: result.score, contentStale: false });
        } catch (err) {
            if (!mounted.current) return;
            const message = err instanceof Error ? err.message : String(err);
            setPhase(isContentUnavailable(message) ? 'unavailable' : 'error');
        }
    }, [attemptId, answers, phase, onComplete]);

    if (!visible || mode !== 'knowledge') return null;

    const current = questions[index] ?? null;
    const currentAnswer = current ? (answers[current.itemKey] ?? '') : '';

    const choose = (value: string) => {
        if (!current || phase !== 'answering') return;
        setAnswers(prev => ({ ...prev, [current.itemKey]: value }));
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {programTitle} — Knowledge Check
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {phase === 'loading' && (
                        <View style={styles.center}>
                            <ActivityIndicator size="small" color="#666" />
                            <Text style={[styles.body, { color: colors.textSecondary }]}>Loading check…</Text>
                        </View>
                    )}

                    {(phase === 'answering' || phase === 'submitting') && current && (
                        <View>
                            <Text style={[styles.progress, { color: colors.textSecondary }]}>
                                Question {index + 1} of {questions.length}
                            </Text>
                            <Text style={[styles.body, { color: colors.text }]}>{current.prompt}</Text>
                            {current.options.length > 0 ? (
                                <View>
                                    {current.options.map(opt => {
                                        const selected = currentAnswer === opt;
                                        return (
                                            <TouchableOpacity
                                                key={opt}
                                                style={[
                                                    styles.option,
                                                    { backgroundColor: colors.background },
                                                    selected && styles.optionSelected,
                                                ]}
                                                onPress={() => choose(opt)}
                                                disabled={phase === 'submitting'}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ) : (
                                <TextInput
                                    style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                                    value={current ? (answers[current.itemKey] ?? '') : ''}
                                    onChangeText={text => {
                                        if (current) setAnswers(prev => ({ ...prev, [current.itemKey]: text }));
                                    }}
                                    placeholder="Your answer…"
                                    placeholderTextColor="#999"
                                    editable={phase === 'answering'}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            )}
                            <View style={styles.row}>
                                {index > 0 && (
                                    <TouchableOpacity
                                        style={[styles.secondary, { backgroundColor: colors.background }]}
                                        onPress={() => {
                                            setIndex(i => Math.max(0, i - 1));
                                        }}
                                        disabled={phase === 'submitting'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.secondaryText, { color: colors.text }]}>Back</Text>
                                    </TouchableOpacity>
                                )}
                                {index < questions.length - 1 ? (
                                    <TouchableOpacity
                                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                        onPress={() => {
                                            setIndex(i => Math.min(questions.length - 1, i + 1));
                                        }}
                                        disabled={phase === 'submitting'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.primaryText, { color: colors.white }]}>Next</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                        onPress={() => void submit()}
                                        disabled={phase === 'submitting'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.primaryText, { color: colors.white }]}>Submit answers</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {phase === 'submitting' && (
                                <ActivityIndicator size="small" color="#666" style={styles.spinner} />
                            )}
                        </View>
                    )}

                    {phase === 'passed' && (
                        <View>
                            <Text style={[styles.result, { color: colors.text }]}>Knowledge passed</Text>
                            {score != null && (
                                <Text style={[styles.body, { color: colors.textSecondary }]}>Score: {Math.round(score)}%</Text>
                            )}
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
                            <Text style={[styles.result, { color: colors.text }]}>Knowledge check not passed</Text>
                            {score != null && (
                                <Text style={[styles.body, { color: colors.textSecondary }]}>Score: {Math.round(score)}%</Text>
                            )}
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue learning</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'stale' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                This check was updated. Start again with the latest version.
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={() => void start()}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Start new check</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'unavailable' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Knowledge check is temporarily unavailable. Try again later.
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

                    {phase === 'error' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Verification needs an internet connection.
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
        maxWidth: scale(340),
        maxHeight: '85%',
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
        fontSize: scale(18),
        flex: 1,
    },
    close: {
        fontSize: scale(18),
    },
    center: {
        alignItems: 'center',
        paddingVertical: scale(16),
    },
    progress: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(12),
        marginBottom: scale(8),
    },
    body: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        marginBottom: scale(12),
    },
    options: {
        marginBottom: scale(4),
    },
    option: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        paddingHorizontal: scale(16),
        marginBottom: scale(8),
    },
    optionSelected: {
        borderWidth: 2,
        borderColor: '#007aff',
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
        flex: 1,
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
});

export default CredentialChallengeRunner;
