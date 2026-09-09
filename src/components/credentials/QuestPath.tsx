import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { CredentialProgram } from '../../domain/credentials/types';

export type QuestNodeState = 'done' | 'current' | 'locked';

export interface QuestNode {
    id: 'learn' | 'practice' | 'prove' | 'project' | 'verify';
    title: string;
    subtitle: string;
    state: QuestNodeState;
    /** 0..100 fill of the connector below this node */
    progress: number;
    icon: keyof typeof Ionicons.glyphMap;
}

export interface QuestPathInput {
    program: CredentialProgram;
    learningCompletion: number;
    practicePct: number;
    readinessPct: number;
    retakeAllowed: boolean;
    finalScore: number | null;
    projectScore: number | null;
    issued: boolean;
    /** Live position in the real curriculum: unit number + day inside it. */
    unitNumber?: number;
    unitDay?: number;
    /** Today's plan progress feeding this program. */
    todayDone?: number;
    todayTotal?: number;
    /** Focus sessions logged for the hobby. */
    sessionsLogged?: number;
}

/**
 * Builds the quest nodes for a program from live chain state.
 * Order mirrors the product promise: Learn → Practice → Prove → Verify.
 */
export function buildQuestNodes(input: QuestPathInput): QuestNode[] {
    const { program, learningCompletion, practicePct, readinessPct, retakeAllowed, finalScore, projectScore, issued } =
        input;
    const unitBit =
        input.unitNumber !== undefined && input.unitDay !== undefined
            ? `Unit ${input.unitNumber}, day ${input.unitDay} · `
            : '';
    const todayBit =
        input.todayTotal !== undefined && input.todayTotal > 0
            ? ` · ${input.todayDone ?? 0}/${input.todayTotal} today`
            : '';
    const passedFinal = finalScore !== null && finalScore >= program.requiredScore;
    const learnDone = learningCompletion >= 90;
    const practiceDone = practicePct >= 80 || passedFinal;
    const projectDone = !program.requiresProject || projectScore !== null;

    const hasPlan = (input.todayTotal ?? 0) > 0;
    const learn: QuestNode = {
        id: 'learn',
        title: 'Learn',
        subtitle: learnDone
            ? 'Path complete ✓'
            : !hasPlan
              ? 'No plan today — open Твой день to load it'
              : `Твой день → Узнай + Сделай · ${unitBit}${Math.round(learningCompletion)}% of daily path${todayBit}`,
        state: learnDone ? 'done' : 'current',
        progress: learningCompletion,
        icon: 'book-outline',
    };
    const practice: QuestNode = {
        id: 'practice',
        title: 'Practice',
        subtitle: practiceDone
            ? `Hands-on done ✓${input.sessionsLogged ? ` · ${input.sessionsLogged} sessions` : ''}`
            : !learnDone
              ? 'Finish Learn first'
              : `Начать занятие → 30-min session${input.sessionsLogged ? ` · ${input.sessionsLogged} logged` : ''} · 👍/🤔 verdicts count`,
        state: practiceDone ? 'done' : learnDone ? 'current' : 'locked',
        progress: practicePct,
        icon: 'barbell-outline',
    };
    const prove: QuestNode = {
        id: 'prove',
        title: 'Prove',
        subtitle: passedFinal
            ? `Final passed — ${Math.round(finalScore ?? 0)}% ✓`
            : !practiceDone
              ? 'Finish Practice first'
              : readinessPct >= program.readinessThreshold
                ? retakeAllowed
                    ? 'Exam unlocked — good luck!'
                    : 'Cooldown — keep practicing'
                : `Reach ${program.readinessThreshold}% readiness (${Math.round(readinessPct)}%)`,
        state: passedFinal ? 'done' : practiceDone ? 'current' : 'locked',
        progress: passedFinal ? 100 : Math.min(100, (readinessPct / program.readinessThreshold) * 100),
        icon: 'trophy-outline',
    };
    const nodes: QuestNode[] = [learn, practice, prove];
    if (program.requiresProject) {
        nodes.push({
            id: 'project',
            title: 'Project',
            subtitle: projectDone ? 'Submitted ✓' : !passedFinal ? 'Pass Prove first' : 'Submit your analysis',
            state: projectDone ? 'done' : passedFinal ? 'current' : 'locked',
            progress: projectDone ? 100 : 0,
            icon: 'briefcase-outline',
        });
    }
    nodes.push({
        id: 'verify',
        title: 'Verify',
        subtitle: issued ? 'Credential issued ✓' : passedFinal && projectDone ? 'Claim your credential' : 'Locked',
        state: issued ? 'done' : passedFinal && projectDone ? 'current' : 'locked',
        progress: issued ? 100 : 0,
        icon: 'shield-checkmark-outline',
    });
    return nodes;
}

/**
 * Duolingo-style vertical quest map in session visual language:
 * state-colored nodes, progress connectors, pulsing current node.
 */
export const QuestPath: React.FC<{ nodes: QuestNode[]; onNodePress: (id: QuestNode['id']) => void }> = ({
    nodes,
    onNodePress,
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);

    return (
        <View style={styles.path}>
            {nodes.map((node, i) => {
                const isLast = i === nodes.length - 1;
                const circleStyle =
                    node.state === 'done' ? styles.nodeDone : node.state === 'current' ? styles.nodeCurrent : styles.nodeLocked;
                const iconColor = node.state === 'locked' ? '#8E8E93' : '#FFFFFF';
                return (
                    <View key={node.id}>
                        <TouchableOpacity
                            style={styles.row}
                            activeOpacity={node.state === 'locked' ? 1 : 0.8}
                            onPress={() => {
                                if (node.state !== 'locked') onNodePress(node.id);
                            }}
                        >
                            <View style={styles.rail}>
                                <Animated.View style={[styles.node, circleStyle, node.state === 'current' && { transform: [{ scale: pulse }] }]}>
                                    {node.state === 'done' ? (
                                        <Ionicons name="checkmark" size={scale(26)} color="#FFFFFF" />
                                    ) : node.state === 'locked' ? (
                                        <Ionicons name="lock-closed" size={scale(22)} color={iconColor} />
                                    ) : (
                                        <Ionicons name={node.icon} size={scale(24)} color={iconColor} />
                                    )}
                                </Animated.View>
                            </View>
                            <View style={[styles.card, node.state === 'locked' && styles.cardLocked]}>
                                <Text style={styles.nodeTitle}>{node.title}</Text>
                                <Text style={styles.nodeSubtitle}>{node.subtitle}</Text>
                                {node.state !== 'locked' && node.progress < 100 && (
                                    <View style={styles.miniTrack}>
                                        <View style={[styles.miniFill, { width: `${Math.min(100, Math.max(0, node.progress))}%` }]} />
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                        {!isLast && (
                            <View style={styles.connector}>
                                <View style={styles.connectorTrack} />
                                <View
                                    style={[
                                        styles.connectorFill,
                                        {
                                            height: `${node.state === 'done' ? 100 : Math.min(100, Math.max(0, node.progress))}%`,
                                            backgroundColor: node.state === 'done' ? '#34C759' : '#37A0EF',
                                        },
                                    ]}
                                />
                            </View>
                        )}
                    </View>
                );
            })}
        </View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        path: {
            paddingVertical: scale(4),
        },
        row: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        rail: {
            width: scale(64),
            alignItems: 'center',
            justifyContent: 'center',
        },
        node: {
            width: scale(56),
            height: scale(56),
            borderRadius: scale(28),
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 3,
            shadowColor: '#0F2147',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 4,
        },
        nodeDone: {
            backgroundColor: '#34C759',
        },
        nodeCurrent: {
            backgroundColor: '#37A0EF',
        },
        nodeLocked: {
            backgroundColor: '#DDE8F4',
        },
        card: {
            flex: 1,
            backgroundColor: colors.surfaceLight,
            borderRadius: scale(16),
            paddingHorizontal: scale(14),
            paddingVertical: scale(12),
            marginLeft: scale(4),
        },
        cardLocked: {
            opacity: 0.6,
        },
        nodeTitle: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            color: colors.text,
        },
        nodeSubtitle: {
            fontFamily: fonts.body.regular,
            fontSize: scale(13),
            lineHeight: scale(18),
            color: colors.textSecondary,
            marginTop: scale(2),
        },
        miniTrack: {
            marginTop: scale(8),
            height: scale(6),
            borderRadius: scale(3),
            backgroundColor: '#DDE8F4',
            overflow: 'hidden',
        },
        miniFill: {
            height: '100%',
            borderRadius: scale(3),
            backgroundColor: '#37A0EF',
        },
        connector: {
            width: scale(64),
            height: scale(22),
            alignItems: 'center',
            position: 'relative',
        },
        connectorTrack: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: scale(4),
            borderRadius: scale(2),
            backgroundColor: '#DDE8F4',
        },
        connectorFill: {
            position: 'absolute',
            top: 0,
            width: scale(4),
            borderRadius: scale(2),
        },
    });

export default QuestPath;
