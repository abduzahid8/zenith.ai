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
    parseRetakeBlock,
    startAssessment,
    startKnowledgeAttempt,
    startPracticalAttempt,
    submitAssessment,
    submitKnowledgeAttempt,
    submitPracticalAttempt,
} from '../../services/trustApi';
import { CredentialChessMoveInput } from './CredentialChessMoveInput';

/**
 * Slice 4 — one reusable challenge runner, knowledge + practical + final.
 * No separate exam dashboard/page: `mode` selects the server flow.
 *
 * Authority rules, mirroring the verified-challenge contract:
 * - items come ONLY from the server start call (server-assigned; an
 *   existing active attempt resumes — never a client identity);
 * - answers submit keyed by public ids; the client never grades;
 * - the server verdict (including score, staleness) is rendered as-is;
 * - content-unavailable is a valid server answer with its own copy.
 * Practical renders ONLY the safe payload (kind/prompt/options/fen);
 * Final renders ONLY the assigned safe question subset; server-only keys
 * are never read, bundled, or reconstructed.
 * The Final timer uses the absolute server deadline (display only — the
 * server alone decides expiry, via reconcile on countdown zero).
 */

export type RunnerMode = 'knowledge' | 'practical' | 'final';

export interface KnowledgeQuestion {
    itemKey: string;
    prompt: string;
    options: string[];
}

export interface PracticalTask {
    itemKey: string;
    kind: string;
    prompt: string;
    options: string[];
    fen: string;
}

export interface FinalQuestion {
    questionId: string;
    skill: string;
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
    /** Remediation flow: Verify CTA target. Used by Final retake blocks. */
    onVerifySkill?: (target: { skillKey: string; skillName: string }) => void;
    /** Journey skill names by key, for remediation copy. */
    skillNames?: Record<string, string>;
}

/**
 * Typed client parsing for the richer Final start outcomes. Raw
 * Postgres/Supabase strings never reach the UI.
 */
export type FinalStartBlock =
    | { kind: 'cooldown'; until: string }
    | { kind: 'remediation'; skillKeys: string[] }
    | { kind: 'not_ready' }
    | { kind: 'already_passed' }
    | { kind: 'content_unavailable' }
    | { kind: 'network' };

export function parseFinalStartBlock(message: string): FinalStartBlock {
    const retake = parseRetakeBlock(message);
    if (retake) {
        if (retake.reason === 'cooldown') {
            return { kind: 'cooldown', until: retake.detail ?? '' };
        }
        const skillKeys = (retake.detail ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);
        return { kind: 'remediation', skillKeys };
    }
    if (message.includes('final_not_ready')) {
        return { kind: 'not_ready' };
    }
    if (message.includes('final_already_passed')) {
        return { kind: 'already_passed' };
    }
    if (isContentUnavailable(message)) {
        return { kind: 'content_unavailable' };
    }
    return { kind: 'network' };
}

type RunnerPhase =
    | 'loading'
    | 'answering'
    | 'submitting'
    | 'passed'
    | 'failed'
    | 'stale'
    | 'expired'
    | 'cooldown'
    | 'remediation'
    | 'not_ready'
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
    // Safe projection only: never carry hidden keys, thresholds, or bank ids.
    return { itemKey: key, prompt: typeof prompt === 'string' ? prompt : '', options };
}

function toPracticalTask(raw: unknown): PracticalTask | null {
    if (raw == null || typeof raw !== 'object') return null;
    const q = raw as {
        item_key?: unknown;
        itemKey?: unknown;
        skill?: unknown;
        prompt?: unknown;
        question?: unknown;
        options?: unknown;
        fen?: unknown;
        kind?: unknown;
        payload?: unknown;
    };
    const key = q.item_key ?? q.itemKey;
    if (typeof key !== 'string') return null;
    const payload = (q.payload != null && typeof q.payload === 'object'
        ? (q.payload as { kind?: unknown; prompt?: unknown; question?: unknown; options?: unknown; fen?: unknown })
        : null);
    const kind = payload?.kind ?? q.kind;
    const prompt = payload?.prompt ?? payload?.question ?? q.prompt ?? q.question;
    const rawOptions = payload?.options ?? q.options;
    const rawFen = payload?.fen ?? q.fen;
    const options = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === 'string') : [];
    // Safe projection only: kind/prompt/options/fen. Nothing else leaves
    // the server payload (no hidden keys, no bank ids, no thresholds).
    return {
        itemKey: key,
        kind: typeof kind === 'string' ? kind : '',
        prompt: typeof prompt === 'string' ? prompt : '',
        options,
        fen: typeof rawFen === 'string' ? rawFen : '',
    };
}

function toFinalQuestion(raw: unknown): FinalQuestion | null {
    if (raw == null || typeof raw !== 'object') return null;
    const q = raw as {
        id?: unknown;
        question_id?: unknown;
        item_key?: unknown;
        itemKey?: unknown;
        skill?: unknown;
        prompt?: unknown;
        question?: unknown;
        options?: unknown;
    };
    const id = q.id ?? q.question_id ?? q.item_key ?? q.itemKey;
    if (typeof id !== 'string') return null;
    const prompt = q.prompt ?? q.question;
    const rawOptions = q.options;
    const options = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === 'string') : [];
    // Safe projection only: public id, skill, prompt, options. Never keys,
    // thresholds, or unassigned bank contents.
    return {
        questionId: id,
        skill: typeof q.skill === 'string' ? q.skill : '',
        prompt: typeof prompt === 'string' ? prompt : '',
        options,
    };
}

/** Remaining whole seconds until the server deadline (display only). */
export function remainingSeconds(deadline: string | null, nowMs: number): number | null {
    if (!deadline) return null;
    const target = new Date(deadline).getTime();
    if (Number.isNaN(target)) return null;
    return Math.max(0, Math.floor((target - nowMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
    const ss = String(secs).padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const CredentialChallengeRunner: React.FC<CredentialChallengeRunnerProps> = ({
    visible,
    mode,
    programSlug,
    programTitle,
    onClose,
    onComplete,
    onVerifySkill,
    skillNames,
}) => {
    const { colors } = useAppTheme();
    const [phase, setPhase] = useState<RunnerPhase>('loading');
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [questions, setQuestions] = useState<KnowledgeQuestion[]>([]);
    const [tasks, setTasks] = useState<PracticalTask[]>([]);
    const [finalQuestions, setFinalQuestions] = useState<FinalQuestion[]>([]);
    const [index, setIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [score, setScore] = useState<number | null>(null);
    const [deadline, setDeadline] = useState<string | null>(null);
    const [nowMs, setNowMs] = useState<number>(() => Date.now());
    const [cooldownUntil, setCooldownUntil] = useState<string>('');
    const [remediationKeys, setRemediationKeys] = useState<string[]>([]);
    const mounted = useRef(true);
    // Timer-zero auto-reconcile fires at most ONCE per (attemptId,
    // deadline) per runner session. A same-identity resume must not
    // re-arm it (client/server clock skew would otherwise RPC-storm);
    // a genuinely new identity gets its own single reconciliation.
    const reconciledKeyRef = useRef<string | null>(null);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const applyFinalStart = useCallback(
        (
            started: { attemptId: string; questions: unknown[]; deadline: string; retakeReason: string },
            opts?: { keepAnswers?: boolean },
        ): boolean => {
            // Returns false when the response carried no runnable payload.
            if (started.retakeReason === 'expired_finalized' && (started.questions ?? []).length === 0) {
                // Server-owned expiry: recorded as not passed. Refresh the
                // canonical journey; the modal only narrates.
                setPhase('expired');
                onComplete({ passed: false, score: null, contentStale: false });
                return false;
            }
            const parsed = started.questions.map(toFinalQuestion).filter((q): q is FinalQuestion => q !== null);
            if (parsed.length === 0) {
                setPhase('error');
                return false;
            }
            setAttemptId(started.attemptId);
            setFinalQuestions(parsed);
            setQuestions([]);
            setTasks([]);
            setDeadline(started.deadline);
            // Deliberately no reconcile re-arm here: the key stays recorded
            // for a same-identity resume (see the timer effect).
            if (!opts?.keepAnswers) {
                setAnswers({});
                setIndex(0);
            } else {
                setIndex(i => Math.min(i, Math.max(0, parsed.length - 1)));
            }
            setScore(null);
            setPhase('answering');
            return true;
        },
        [onComplete],
    );

    const handleFinalStartError = useCallback(
        (err: unknown): void => {
            const message = err instanceof Error ? err.message : String(err);
            const block = parseFinalStartBlock(message);
            switch (block.kind) {
                case 'already_passed':
                    // Stale client read: the canonical journey already holds
                    // the pass. Refresh and close — never an error UI.
                    onComplete({ passed: true, score: null, contentStale: false });
                    onClose();
                    return;
                case 'not_ready':
                    setPhase('not_ready');
                    onComplete({ passed: false, score: null, contentStale: false });
                    return;
                case 'cooldown':
                    setCooldownUntil(block.until);
                    setPhase('cooldown');
                    return;
                case 'remediation':
                    setRemediationKeys(block.skillKeys);
                    setPhase('remediation');
                    return;
                case 'content_unavailable':
                    setPhase('unavailable');
                    return;
                case 'network':
                default:
                    setPhase('error');
                    return;
            }
        },
        [onComplete, onClose],
    );

    const start = useCallback(async () => {
        setPhase('loading');
        setAnswers({});
        setIndex(0);
        setAttemptId(null);
        setScore(null);
        setDeadline(null);
        setCooldownUntil('');
        setRemediationKeys([]);
        reconciledKeyRef.current = null;
        try {
            if (mode === 'final') {
                const started = await startAssessment(programSlug);
                if (!mounted.current) return;
                applyFinalStart(started);
                return;
            }
            if (mode === 'practical') {
                const started = await startPracticalAttempt(programSlug);
                if (!mounted.current) return;
                const parsed = started.tasks.map(toPracticalTask).filter((t): t is PracticalTask => t !== null);
                if (parsed.length === 0) {
                    setPhase('error');
                    return;
                }
                setAttemptId(started.attemptId);
                setTasks(parsed);
                setQuestions([]);
                setFinalQuestions([]);
                setPhase('answering');
                return;
            }
            const started = await startKnowledgeAttempt(programSlug);
            if (!mounted.current) return;
            const parsed = started.questions.map(toQuestion).filter((q): q is KnowledgeQuestion => q !== null);
            if (parsed.length === 0) {
                setPhase('error');
                return;
            }
            setAttemptId(started.attemptId);
            setQuestions(parsed);
            setTasks([]);
            setFinalQuestions([]);
            setPhase('answering');
        } catch (err) {
            if (!mounted.current) return;
            if (mode === 'final') {
                handleFinalStartError(err);
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            setPhase(isContentUnavailable(message) ? 'unavailable' : 'error');
        }
    }, [programSlug, mode, applyFinalStart, handleFinalStartError]);

    useEffect(() => {
        if (visible && (mode === 'knowledge' || mode === 'practical' || mode === 'final')) {
            void start();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, mode, programSlug]);

    // Server-deadline countdown (final only, display only).
    useEffect(() => {
        if (!visible || mode !== 'final' || deadline == null) return;
        if (phase !== 'answering' && phase !== 'submitting') return;
        setNowMs(Date.now());
        const timer = setInterval(() => setNowMs(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [visible, mode, deadline, phase]);

    // Countdown zero reconciles with the server at most ONCE per
    // (attemptId, deadline): the server finalizes expiry (or applies
    // rotation authority). Nothing is marked locally and no second attempt
    // is minted client-side. A same-identity resume keeps rendering with
    // the timer at 0; only a genuinely new identity re-arms.
    useEffect(() => {
        if (!visible || mode !== 'final' || deadline == null) return;
        if (phase !== 'answering' && phase !== 'submitting') return;
        const remaining = remainingSeconds(deadline, nowMs);
        if (remaining !== 0) return;
        const key = `${attemptId ?? ''}|${deadline}`;
        if (reconciledKeyRef.current === key) return;
        reconciledKeyRef.current = key;
        (async () => {
            try {
                const started = await startAssessment(programSlug);
                if (!mounted.current) return;
                applyFinalStart(started, { keepAnswers: true });
            } catch (err) {
                if (!mounted.current) return;
                handleFinalStartError(err);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nowMs, deadline, phase, visible, mode, programSlug, attemptId]);

    const submit = useCallback(async () => {
        if (!attemptId || phase === 'submitting') return;
        setPhase('submitting');
        try {
            const result = mode === 'final'
                ? await submitAssessment(attemptId, answers)
                : mode === 'practical'
                    ? await submitPracticalAttempt(attemptId, answers)
                    : await submitKnowledgeAttempt(attemptId, answers);
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
            if (mode === 'final') {
                handleFinalStartError(err);
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            setPhase(isContentUnavailable(message) ? 'unavailable' : 'error');
        }
    }, [attemptId, answers, phase, onComplete, mode, handleFinalStartError]);

    if (!visible || (mode !== 'knowledge' && mode !== 'practical' && mode !== 'final')) return null;

    const isPractical = mode === 'practical';
    const isFinal = mode === 'final';
    const total = isFinal ? finalQuestions.length : isPractical ? tasks.length : questions.length;
    const currentTask = isPractical ? (tasks[index] ?? null) : null;
    const currentQuestion = !isPractical && !isFinal ? (questions[index] ?? null) : null;
    const currentFinal = isFinal ? (finalQuestions[index] ?? null) : null;
    const currentKey = isFinal
        ? (currentFinal?.questionId ?? '')
        : isPractical
            ? (currentTask?.itemKey ?? '')
            : (currentQuestion?.itemKey ?? '');
    const currentAnswer = currentKey ? (answers[currentKey] ?? '') : '';
    const heading = isFinal
        ? `${programTitle} — Final Assessment`
        : isPractical
            ? `${programTitle} — Practical Check`
            : `${programTitle} — Knowledge Check`;
    const progressLabel = isFinal
        ? `Question ${index + 1} of ${total}`
        : isPractical
            ? `Task ${index + 1} of ${total}`
            : `Question ${index + 1} of ${total}`;
    const remaining = isFinal ? remainingSeconds(deadline, nowMs) : null;

    const choose = (value: string) => {
        if (!currentKey || phase !== 'answering') return;
        setAnswers(prev => ({ ...prev, [currentKey]: value }));
    };

    const closeAndRefresh = (result: KnowledgeSubmitResult) => {
        onComplete(result);
        onClose();
    };

    const renderPracticalInput = () => {
        if (!currentTask) return null;
        if (currentTask.fen !== '') {
            const lineMode = currentTask.kind === 'opening_line';
            return (
                <CredentialChessMoveInput
                    fen={currentTask.fen}
                    mode={lineMode ? 'line' : 'single'}
                    value={currentAnswer}
                    onChange={choose}
                />
            );
        }
        if (currentTask.options.length > 0) {
            return (
                <View>
                    {currentTask.options.map(opt => {
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
            );
        }
        return (
            <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                value={currentAnswer}
                onChangeText={text => {
                    if (currentKey) setAnswers(prev => ({ ...prev, [currentKey]: text }));
                }}
                placeholder="Your answer…"
                placeholderTextColor="#999"
                editable={phase === 'answering'}
                autoCapitalize="none"
            />
        );
    };

    const renderFinalInput = () => {
        if (!currentFinal) return null;
        if (currentFinal.options.length > 0) {
            return (
                <View>
                    {currentFinal.options.map(opt => {
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
            );
        }
        return (
            <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                value={currentAnswer}
                onChangeText={text => {
                    if (currentKey) setAnswers(prev => ({ ...prev, [currentKey]: text }));
                }}
                placeholder="Your answer…"
                placeholderTextColor="#999"
                editable={phase === 'answering'}
                autoCapitalize="none"
            />
        );
    };

    const passedTitle = isFinal ? 'Final Assessment passed' : isPractical ? 'Practical passed' : 'Knowledge passed';
    const failedTitle = isFinal
        ? 'Final Assessment not passed'
        : isPractical
            ? 'Practical check not passed'
            : 'Knowledge check not passed';
    const staleCopy = isFinal
        ? 'This Final Assessment was updated. Return to your credential path.'
        : isPractical
            ? 'This practical check was updated. Start again with the latest version.'
            : 'This check was updated. Start again with the latest version.';
    const unavailableCopy = isFinal
        ? 'Final Assessment is temporarily unavailable. Try again later.'
        : isPractical
            ? 'Practical check is temporarily unavailable. Try again later.'
            : 'Knowledge check is temporarily unavailable. Try again later.';
    const errorCopy = isFinal
        ? 'Final Assessment needs an internet connection.'
        : isPractical
            ? 'Practical check needs an internet connection.'
            : 'Verification needs an internet connection.';
    const submitLabel = isFinal ? 'Submit Final Assessment' : isPractical ? 'Submit Practical Check' : 'Submit answers';

    const remediationNames = remediationKeys.map(k => skillNames?.[k] ?? k);
    const firstRemediation = remediationKeys[0] ?? '';
    const firstRemediationName = remediationNames[0] ?? firstRemediation;
    const cooldownLabel = (() => {
        if (!cooldownUntil) return '';
        const parsed = new Date(cooldownUntil);
        if (Number.isNaN(parsed.getTime())) return cooldownUntil;
        return parsed.toLocaleString();
    })();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {heading}
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

                    {(phase === 'answering' || phase === 'submitting') && (currentQuestion || currentTask || currentFinal) && (
                        <View>
                            <Text style={[styles.progress, { color: colors.textSecondary }]}>
                                {progressLabel}
                            </Text>
                            {isFinal && remaining != null && (
                                <Text style={[styles.timer, { color: colors.textSecondary }]}>
                                    {`Time left ${formatCountdown(remaining)}`}
                                </Text>
                            )}
                            <Text style={[styles.body, { color: colors.text }]}>
                                {isFinal ? currentFinal?.prompt : isPractical ? currentTask?.prompt : currentQuestion?.prompt}
                            </Text>
                            {!isPractical && !isFinal && currentQuestion && (
                                currentQuestion.options.length > 0 ? (
                                    <View>
                                        {currentQuestion.options.map(opt => {
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
                                        value={currentQuestion ? (answers[currentQuestion.itemKey] ?? '') : ''}
                                        onChangeText={text => {
                                            if (currentQuestion) setAnswers(prev => ({ ...prev, [currentQuestion.itemKey]: text }));
                                        }}
                                        placeholder="Your answer…"
                                        placeholderTextColor="#999"
                                        editable={phase === 'answering'}
                                        autoCapitalize="none"
                                    />
                                )
                            )}
                            {isPractical && renderPracticalInput()}
                            {isFinal && renderFinalInput()}
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
                                {index < total - 1 ? (
                                    <TouchableOpacity
                                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                        onPress={() => {
                                            setIndex(i => Math.min(total - 1, i + 1));
                                        }}
                                        disabled={phase === 'submitting'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.primaryText, { color: colors.white }]}>
                                            {isPractical || isFinal ? 'Continue' : 'Next'}
                                        </Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                        onPress={() => void submit()}
                                        disabled={phase === 'submitting'}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.primaryText, { color: colors.white }]}>
                                            {submitLabel}
                                        </Text>
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
                            <Text style={[styles.result, { color: colors.text }]}>{passedTitle}</Text>
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
                            <Text style={[styles.result, { color: colors.text }]}>{failedTitle}</Text>
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
                                {staleCopy}
                            </Text>
                            {isFinal ? (
                                <TouchableOpacity
                                    style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                    onPress={() => closeAndRefresh({ passed: false, score: null, contentStale: true })}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.primaryText, { color: colors.white }]}>Return to credential path</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                    onPress={() => void start()}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.primaryText, { color: colors.white }]}>Start new check</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {phase === 'expired' && (
                        <View>
                            <Text style={[styles.result, { color: colors.text }]}>Time expired</Text>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                This attempt was recorded as not passed.
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={() => closeAndRefresh({ passed: false, score: null, contentStale: false })}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue learning</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'cooldown' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                {`Your next Final attempt will be available after${cooldownLabel ? ` ${cooldownLabel}` : ''}.`}
                            </Text>
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={onClose}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>Continue learning</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'remediation' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Before your next Final attempt, complete a fresh skill check.
                            </Text>
                            {remediationNames.length > 0 && (
                                <Text style={[styles.body, { color: colors.text }]}>
                                    {remediationNames.join(', ')}
                                </Text>
                            )}
                            <TouchableOpacity
                                style={[styles.primary, { backgroundColor: colors.buttonPrimary }]}
                                onPress={() => {
                                    if (firstRemediation && onVerifySkill) {
                                        onVerifySkill({ skillKey: firstRemediation, skillName: firstRemediationName });
                                    }
                                    onClose();
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.primaryText, { color: colors.white }]}>
                                    {firstRemediationName ? `Verify ${firstRemediationName}` : 'Continue'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {phase === 'not_ready' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                Your credential path changed. Complete the current verification step first.
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

                    {phase === 'unavailable' && (
                        <View>
                            <Text style={[styles.body, { color: colors.textSecondary }]}>
                                {unavailableCopy}
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
                                {errorCopy}
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
    timer: {
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
