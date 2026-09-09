import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    StatusBar,
    ActivityIndicator,
    Alert,
    Share,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useAppTheme } from '../theme/useAppTheme';
import { useT } from '../store/languageStore';
import { getProgram } from '../domain/credentials/catalog';
import { useCredentialStore } from '../store/credentialStore';
import { useCertificateProgress } from '../hooks/useCertificateProgress';
import { useTaskStore } from '../store/taskStore';
import { LevelBadge } from '../components/credentials/LevelBadge';
import { ProgressBar, SkillBar } from '../components/credentials/SkillBar';
import { QuestPath, buildQuestNodes, QuestNode } from '../components/credentials/QuestPath';
import { findNextIncompleteTask } from '../domain/sessions/sessionCompletion';
import { CredentialCelebration } from '../components/credentials/CredentialCelebration';
import { IssuedCredential } from '../domain/credentials/types';
import { evaluateProject } from '../services/credentialService';

/**
 * Program detail (§4–§6, §10, §16–§17, §25).
 * One screen shows the whole chain for a program:
 * Today's learning → Certification progress → Readiness → Assessment/Project
 * → Credential → Share. ONE BAR: daily tasks ARE the certificate progress —
 * Твой день Узнай/Сделай + Quick bites move the same certificationProgress.
 */
export const CredentialDetailScreen: React.FC = () => {
    const router = useRouter();
    const params = useLocalSearchParams();
    const slug = String(params.slug ?? '');
    const program = getProgram(slug);

    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const t = useT();
    // Canonical progress only — same engine read as every other surface.
    // tasks/sessions below are the hook's canonical arrays (reused for readiness).
    const cert = useCertificateProgress(slug);
    const { tasks, sessions, streakDays, userId, currentDay, unitProgress } = cert;
    const snapshot = useTaskStore(s => s.snapshot);

    // One DailyPlan (§11): make sure the shared plan is loaded so "today"
    // progress here matches Home / Your Day instead of showing "No plan today".
    const fetchDailyPlan = useTaskStore(s => s.fetchDailyPlan);
    const dailyCount = useTaskStore(s => s.dailyTasks.length);
    useEffect(() => {
        if (userId && dailyCount === 0) {
            fetchDailyPlan(userId).catch(() => {});
        }
    }, [userId, dailyCount, fetchDailyPlan]);

    const programs = useCredentialStore(s => s.programs);
    const enroll = useCredentialStore(s => s.enroll);
    const recordRemediation = useCredentialStore(s => s.recordRemediation);
    const submitProject = useCredentialStore(s => s.submitProject);
    const setIdentityVerified = useCredentialStore(s => s.setIdentityVerified);
    const getReadiness = useCredentialStore(s => s.getReadiness);
    const getRetake = useCredentialStore(s => s.getRetake);
    const getRecoveryPlan = useCredentialStore(s => s.getRecoveryPlan);
    const tryIssue = useCredentialStore(s => s.tryIssue);

    const [projectText, setProjectText] = useState('');
    const [evaluating, setEvaluating] = useState(false);
    const [celebration, setCelebration] = useState<IssuedCredential | null>(null);
    const scrollRef = React.useRef<ScrollView>(null);

    const state = programs[slug];
    const evidence = cert.evidence;
    const progress = cert.progress;
    const readiness = program
        ? getReadiness(slug, tasks, sessions, streakDays, snapshot?.avg_completion_7d ?? null)
        : null;
    const retake = program ? getRetake(slug, tasks, sessions) : null;
    const recoveryPlan = program ? getRecoveryPlan(slug, tasks, sessions) : null;

    if (!program) {
        return (
            <SafeAreaView style={styles.container} edges={['top']}>
                <Text style={styles.title}>Program not found</Text>
            </SafeAreaView>
        );
    }

    const enrolled = state?.enrolled ?? false;
    const issued = state?.issued ?? null;

    const handleEnroll = () => {
        console.log('[CredentialDetail] Enroll pressed:', slug);
        enroll(slug);
    };

    const handleStartAssessment = () => {
        console.log('[CredentialDetail] Start assessment pressed:', slug, 'retake:', retake);
        if (!retake?.allowed) {
            const pending = retake?.requiredRemediation ?? [];
            Alert.alert(
                'Not yet available',
                retake?.reason === 'cooldown'
                    ? `Next attempt opens ${retake.availableAfter ?? 'later'}. Use the time for targeted practice.`
                    : `Complete remediation first: ${pending.map(r => `${r.skillName} (${r.sessions})`).join(', ')}`,
            );
            return;
        }
        router.push(`/assessment/${slug}` as any);
    };

    const handleSubmitProject = async () => {
        if (projectText.trim().length < 50) {
            Alert.alert('Project too short', 'Describe your analysis in at least a few sentences.');
            return;
        }
        setEvaluating(true);
        try {
            const words = projectText.trim().split(/\s+/).length;
            const result = await evaluateProject(program, {
                text: projectText,
                wordCount: words,
                chartCount: (projectText.match(/chart|graph|diagram|dashboard/gi) ?? []).length,
                calculationCount: (projectText.match(/\d+[%.,]?\d*/g) ?? []).length,
                hasRecommendations: /recommend|suggest|should|next steps/i.test(projectText),
            });
            submitProject(slug, result.total, result.skillScores);
            Alert.alert(
                'Project evaluated',
                `${Math.round(result.total)} / 100${result.aiAssisted ? ' (AI-assisted)' : ' (offline)'}\n${result.feedback}`,
            );
        } finally {
            setEvaluating(false);
        }
    };

    const handleTryIssue = () => {
        if (!userId) {
            Alert.alert('Sign in required', 'Credentials are issued to your account.');
            return;
        }
        const result = tryIssue(slug, userId, tasks, sessions);
        if (result) {
            console.log('[CredentialDetail] Credential issued:', result.credentialId);
            setCelebration(result);
        } else {
            Alert.alert(
                'Not yet earned',
                'Finish all requirements: skill thresholds, final score, project and identity check.',
            );
        }
    };

    const handleShareCred = async (cred: IssuedCredential | null) => {
        const target = cred ?? issued;
        if (!target) return;
        try {
            await Share.share({
                message: `I earned "${target.programTitle}" (${Math.round(target.finalScore)}%) — verify: ${target.verificationUrl}`,
            });
        } catch {
            // share dismissed — no-op
        }
    };

    const handleShare = async () => {
        await handleShareCred(null);
    };

    const questNodes = useMemo(() => {
        if (!program || !progress) return [];
        const hobby = program.evidenceHobbyIds[0];
        const unitDay = (currentDay as Record<string, number>)[hobby] ?? 1;
        const unitsDone = Object.keys(unitProgress ?? {}).filter(k => k.startsWith(`${hobby}_unit`)).length;
        const todayStr = new Date().toISOString().slice(0, 10);
        const todays = tasks.filter(
            t => t.scheduled_date === todayStr && (!t.hobby_id || program.evidenceHobbyIds.includes(t.hobby_id)),
        );
        return buildQuestNodes({
            program,
            learningCompletion: progress.learningCompletion,
            practicePct: readiness?.practice ?? 0,
            readinessPct: readiness?.readiness ?? 0,
            retakeAllowed: retake?.allowed ?? false,
            finalScore: evidence?.finalAssessmentScore ?? null,
            projectScore: evidence?.projectScore ?? null,
            issued: issued !== null,
            unitNumber: unitsDone + 1,
            unitDay,
            todayDone: todays.filter(t => t.status === 'completed').length,
            todayTotal: todays.length,
            sessionsLogged: evidence?.sessionsCompleted ?? 0,
        });
    }, [program, progress, readiness, retake, evidence, issued, tasks, currentDay, unitProgress]);

    const handleQuestPress = (id: QuestNode['id']) => {
        console.log('[CredentialDetail] Quest node pressed:', id);
        if (id === 'learn') {
            router.push('/(app)/weekly-plan' as any);
        } else if (id === 'practice') {
            // Practice continues the SAME DailyPlan (INVARIANT 1/5) —
            // certification never generates its own lessons (INVARIANT 4).
            const next = findNextIncompleteTask(useTaskStore.getState().dailyTasks);
            if (next?.id) {
                const minutes = next.duration_minutes && next.duration_minutes > 0 ? next.duration_minutes : 30;
                router.push(
                    `/session-timer?minutes=${minutes}&taskId=${next.id}&kind=structured&origin=certification_milestone` as any,
                );
            } else {
                router.push('/session-timer?minutes=30&kind=structured&origin=certification_milestone' as any);
            }
        } else if (id === 'prove') {
            handleStartAssessment();
        } else if (id === 'project') {
            scrollRef.current?.scrollToEnd({ animated: true });
        } else if (id === 'verify') {
            handleTryIssue();
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        console.log('[CredentialDetail] Back pressed');
                        router.back();
                    }}
                    style={styles.backButton}
                >
                    <Ionicons name="chevron-back" size={scale(24)} color={colors.text} />
                    <Text style={styles.backText}>{t('Назад')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <LevelBadge level={program.level} />
                <Text style={styles.title}>{program.title}</Text>
                <Text style={styles.subtitle}>{program.subtitle}</Text>
                <Text style={styles.meta}>
                    v{program.version} · {program.estimatedHours}h · pass ≥ {program.requiredScore}%
                </Text>

                {enrolled && (
                    <View style={styles.whereCard}>
                        <Ionicons name="location-outline" size={scale(22)} color="#1E1E2E" />
                        <Text style={styles.whereText}>
                            You learn in Твой день (daily tasks) and Начать занятие (sessions). This quest only
                            tracks — everything counts automatically.
                        </Text>
                    </View>
                )}

                {enrolled && questNodes.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Your quest</Text>
                        <QuestPath nodes={questNodes} onNodePress={handleQuestPress} />
                    </View>
                )}

                {!enrolled ? (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>How it works</Text>
                        <Text style={styles.body}>
                            No separate school — you learn in Твой день and Начать занятие, exactly as today. Your
                            Узнай/Сделай tasks grow the bank-week skills below, session verdicts (👍/🤔) count as
                            proof, and finished 7-day units move the quest. The final exam is built from the same
                            bank topics.
                        </Text>
                        {program.requirements.map(r => (
                            <Text key={r.key} style={styles.bullet}>• {r.description}</Text>
                        ))}
                        <TouchableOpacity style={styles.primaryBtn} onPress={handleEnroll} activeOpacity={0.85}>
                            <Text style={styles.primaryBtnText}>Enroll — keep learning as usual</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* ONE BAR: daily tasks ARE certificate progress — no separate track */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Certificate Progress</Text>
                            <Text style={styles.bigPercent}>
                                {progress ? Math.round(progress.certificationProgress) : 0}% completed
                            </Text>
                            <ProgressBar value={progress?.certificationProgress ?? 0} />
                            <Text style={styles.body}>
                                Your Твой день tasks and Quick bites move this same bar — no separate
                                certificate list.
                            </Text>
                            {(progress?.skillGraph.skills ?? []).map(s => (
                                <SkillBar
                                    key={s.skillKey}
                                    name={s.name}
                                    score={s.score}
                                    minimumScore={s.minimumScore}
                                />
                            ))}
                        </View>

                        {/* Readiness (§25) */}
                        {readiness && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>
                                    Exam Readiness — {Math.round(readiness.readiness)}%
                                </Text>
                                <Text style={styles.body}>
                                    Knowledge {Math.round(readiness.knowledge)}% · Practice{' '}
                                    {Math.round(readiness.practice)}% · Projects {Math.round(readiness.projects)}% ·
                                    Consistency {Math.round(readiness.consistency)}%
                                </Text>
                                <Text style={styles.body}>
                                    {readiness.likelyToPass
                                        ? 'High likelihood of passing.'
                                        : `Weakest area: ${readiness.weakestArea ?? '—'}. About ${readiness.recommendedSessions} targeted sessions recommended.`}
                                </Text>
                            </View>
                        )}

                        {/* Evidence (§17) */}
                        {evidence && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Evidence</Text>
                                <Text style={styles.body}>
                                    {evidence.completedTasks} tasks · {evidence.sessionsCompleted} sessions ·{' '}
                                    {evidence.practiceMinutes} min of practice
                                    {evidence.avgFocusScore !== null ? ` · focus ${Math.round(evidence.avgFocusScore)}` : ''} ·{' '}
                                    {evidence.assessmentAnswers.length} assessment answers
                                    {evidence.finalAssessmentScore !== null ? ` · final ${Math.round(evidence.finalAssessmentScore)}%` : ''} ·{' '}
                                    {evidence.projectScore !== null ? `project ${Math.round(evidence.projectScore)}%` : 'no project yet'}
                                </Text>
                            </View>
                        )}

                        {/* Remediation (§16) */}
                        {recoveryPlan && (progress?.status === 'failed' || retake?.reason === 'remediation_required') && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Recovery Plan</Text>
                                {recoveryPlan.weakSkills.map(w => (
                                    <View key={w.skillKey} style={styles.recoveryRow}>
                                        <Text style={styles.body}>
                                            {w.skillName} — {Math.round(w.score)}% · {w.recommendedSessions} sessions
                                        </Text>
                                        <TouchableOpacity
                                            style={styles.smallBtn}
                                            onPress={() => {
                                                console.log('[CredentialDetail] Remediation logged:', w.skillKey);
                                                recordRemediation(slug, w.skillKey, 1);
                                                router.push('/session-timer?minutes=30' as any);
                                            }}
                                        >
                                            <Text style={styles.smallBtnText}>Practice</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Final assessment */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Final Assessment</Text>
                            <Text style={styles.body}>
                                {program.assessment.questionCount} questions · {program.assessment.timeLimitMinutes} min ·
                                randomized from a bank of {program.assessment.bankSize}.
                                {state && state.attempts.length > 0
                                    ? ` Attempts: ${state.attempts.filter(a => a.completedAt).length}.`
                                    : ' No attempts yet.'}
                            </Text>
                            <TouchableOpacity
                                style={[styles.primaryBtn, !retake?.allowed && styles.disabledBtn]}
                                onPress={handleStartAssessment}
                                activeOpacity={0.85}
                            >
                                <Text style={styles.primaryBtnText}>
                                    {retake?.allowed ? 'Start final assessment' : 'Assessment locked'}
                                </Text>
                            </TouchableOpacity>
                            {!retake?.allowed && retake?.reason === 'cooldown' && (
                                <Text style={styles.body}>Available after {retake.availableAfter}.</Text>
                            )}
                        </View>

                        {/* Project */}
                        {program.requiresProject && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Final Project</Text>
                                {state?.projectScore !== null && state?.projectScore !== undefined ? (
                                    <Text style={styles.body}>Submitted — {Math.round(state.projectScore)} / 100.</Text>
                                ) : (
                                    <>
                                        <Text style={styles.body}>
                                            Describe your analysis: data, calculations, charts and recommendations.
                                            Scored with a strict rubric, AI-assisted when online.
                                        </Text>
                                        <TextInput
                                            style={styles.projectInput}
                                            multiline
                                            placeholder="E-commerce sales analysis: data, findings, recommendations…"
                                            value={projectText}
                                            onChangeText={setProjectText}
                                        />
                                        <TouchableOpacity
                                            style={styles.primaryBtn}
                                            onPress={handleSubmitProject}
                                            disabled={evaluating}
                                            activeOpacity={0.85}
                                        >
                                            {evaluating ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <Text style={styles.primaryBtnText}>Submit for evaluation</Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        )}

                        {/* Identity (professional only, demo flow) */}
                        {program.requiresIdentityVerification && !state?.identityVerified && (
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Identity verification</Text>
                                <Text style={styles.body}>
                                    Professional credentials require a verified identity before issuance.
                                </Text>
                                <TouchableOpacity
                                    style={styles.primaryBtn}
                                    onPress={() => {
                                        console.log('[CredentialDetail] Identity verified (demo):', slug);
                                        setIdentityVerified(slug, true);
                                    }}
                                    activeOpacity={0.85}
                                >
                                    <Text style={styles.primaryBtnText}>Verify identity</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Issuance / issued */}
                        {issued ? (
                            <View style={styles.issuedCard}>
                                <Text style={styles.cardTitle}>Verified ✓ — {issued.credentialId}</Text>
                                <Text style={styles.body}>
                                    Issued {new Date(issued.issuedAt).toLocaleDateString()} · Score{' '}
                                    {Math.round(issued.finalScore)}% ({issued.grade}) · Standard v{issued.programVersion}
                                </Text>
                                <Text style={styles.verifyUrl}>{issued.verificationUrl}</Text>
                                <View style={styles.btnRow}>
                                    <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
                                        <Text style={styles.primaryBtnText}>Share credential</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.secondaryBtn}
                                        onPress={() => router.push(`/verify/${encodeURIComponent(issued.credentialId)}` as any)}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.secondaryBtnText}>Open verification</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.primaryBtn} onPress={handleTryIssue} activeOpacity={0.85}>
                                <Text style={styles.primaryBtnText}>Check & issue credential</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </ScrollView>

            <CredentialCelebration
                visible={celebration !== null}
                credential={celebration}
                onVerify={() => {
                    const cred = celebration;
                    setCelebration(null);
                    if (cred) router.push(`/verify/${encodeURIComponent(cred.credentialId)}` as any);
                }}
                onShare={() => handleShareCred(celebration)}
                onClose={() => setCelebration(null)}
            />
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
        content: {
            paddingHorizontal: scale(20),
            paddingBottom: scale(60),
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(24),
            lineHeight: scale(30),
            color: colors.text,
            marginTop: scale(8),
        },
        subtitle: {
            fontFamily: fonts.body.regular,
            fontSize: scale(15),
            lineHeight: scale(22),
            color: colors.textSecondary,
            marginTop: scale(4),
        },
        meta: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
            marginTop: scale(4),
            marginBottom: scale(12),
        },
        card: {
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(12),
        },
        issuedCard: {
            backgroundColor: '#D1FAE5',
            borderRadius: scale(16),
            padding: scale(16),
            marginBottom: scale(12),
        },
        whereCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: scale(10),
            backgroundColor: '#D6EBFD',
            borderRadius: scale(16),
            padding: scale(14),
            marginBottom: scale(12),
        },
        whereText: {
            flex: 1,
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(20),
            color: '#1E1E2E',
        },
        cardTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: colors.text,
            marginBottom: scale(8),
        },
        bigPercent: {
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
            marginBottom: scale(6),
        },
        bullet: {
            fontFamily: fonts.body.regular,
            fontSize: scale(14),
            lineHeight: scale(22),
            color: colors.text,
        },
        splitRow: {
            flexDirection: 'row',
            marginTop: scale(12),
            marginBottom: scale(12),
        },
        splitCol: {
            flex: 1,
        },
        splitLabel: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.textSecondary,
        },
        splitValue: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(20),
            color: colors.text,
        },
        primaryBtn: {
            marginTop: scale(12),
            backgroundColor: '#102852',
            borderRadius: scale(50),
            paddingVertical: scale(14),
            alignItems: 'center',
        },
        primaryBtnText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(16),
            color: '#FFFFFF',
        },
        disabledBtn: {
            opacity: 0.5,
        },
        secondaryBtn: {
            marginTop: scale(12),
            borderRadius: scale(50),
            paddingVertical: scale(14),
            alignItems: 'center',
            borderWidth: 1,
            borderColor: colors.border,
            flex: 1,
        },
        secondaryBtnText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(15),
            color: colors.text,
        },
        btnRow: {
            flexDirection: 'row',
            gap: scale(10),
        },
        smallBtn: {
            backgroundColor: '#102852',
            borderRadius: scale(50),
            paddingVertical: scale(8),
            paddingHorizontal: scale(18),
        },
        smallBtnText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(14),
            color: '#FFFFFF',
        },
        recoveryRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: scale(8),
        },
        projectInput: {
            minHeight: scale(120),
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: scale(12),
            padding: scale(12),
            fontSize: scale(14),
            color: colors.text,
            backgroundColor: '#FFFFFF',
            textAlignVertical: 'top',
        },
        verifyUrl: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            color: colors.link,
            marginVertical: scale(6),
        },
    });

export default CredentialDetailScreen;
