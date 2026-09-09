import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';
import type { SessionResultData } from '../../../domain/sessions/learningCards';

interface FeedbackCardProps {
    title: string;
    body: string;
    verdict: string;
}

/** In-feed feedback: the card transforms instead of opening a modal. */
export const FeedbackCard: React.FC<FeedbackCardProps> = ({ title, body, verdict }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const good = verdict === 'pass' || verdict === 'partial';
    return (
        <View style={styles.viewport}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.eyebrow}>{good ? 'Отлично' : 'Смотри внимательнее'}</Text>
                <Text style={styles.mark}>{good ? '✓' : '!'}</Text>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.body}>{body}</Text>
            </ScrollView>
            <View style={styles.footer}>
                <Text style={styles.footerHint}>Свайп вверх</Text>
            </View>
        </View>
    );
};

interface ResultCardProps {
    data: SessionResultData;
    onContinue: () => void;
}

/** Final card: only real session values, never fabricated percentages. */
export const SessionResultCard: React.FC<ResultCardProps> = ({ data, onContinue }) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const lines: string[] = [];
    lines.push(`${data.minutesFocused} min focused`);
    lines.push(`${data.stepsCompleted} steps done`);
    if (data.answersVerified !== null) {
        lines.push(`${data.answersVerified} answers verified`);
    }
    if (data.taskCompleted) {
        lines.push(`Task completed ✓${data.taskTitle ? ` — ${data.taskTitle}` : ''}`);
    }
    return (
        <View style={styles.viewport}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={styles.eyebrow}>
                    {data.kind === 'discovery' ? 'Done' : data.kind === 'certificate_review' ? 'Bite complete' : 'Session complete'}
                </Text>
                <Text style={styles.title}>{data.objectiveTitle}</Text>
                <Text style={styles.hobby}>{data.hobbyLabel}</Text>
                {lines.map((line, i) => (
                    <Text key={i} style={styles.line}>
                        {line}
                    </Text>
                ))}
                {!!data.nextTitle && <Text style={styles.next}>Next: {data.nextTitle}</Text>}
            </ScrollView>
            <TouchableOpacity style={styles.continueButton} onPress={onContinue} activeOpacity={0.8}>
                <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );
};

const createStyles = (colors: any) =>
    StyleSheet.create({
        viewport: {
            flex: 1,
            backgroundColor: '#EDF2F7',
            paddingHorizontal: scale(24),
            paddingTop: scale(12),
            paddingBottom: scale(24),
        },
        scrollContent: {
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: scale(12),
        },
        eyebrow: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(13),
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: '#5BA3E6',
            marginBottom: scale(12),
        },
        mark: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(56),
            color: '#0F2147',
            marginBottom: scale(8),
        },
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(30),
            lineHeight: scale(36),
            color: '#1A253C',
            marginBottom: scale(12),
        },
        hobby: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(17),
            color: '#2B5B84',
            marginBottom: scale(16),
        },
        body: {
            fontFamily: fonts.body?.light || fonts.heading.light,
            fontSize: scale(18),
            lineHeight: scale(27),
            color: '#1A253C',
        },
        line: {
            fontFamily: fonts.heading.medium,
            fontSize: scale(17),
            lineHeight: scale(26),
            color: '#1A253C',
        },
        next: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(17),
            lineHeight: scale(26),
            color: '#0F2147',
            marginTop: scale(16),
        },
        footer: {
            alignItems: 'center',
            paddingTop: scale(8),
        },
        footerHint: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(12),
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: 'rgba(15, 33, 71, 0.4)',
        },
        continueButton: {
            backgroundColor: '#0F2147',
            borderRadius: 9999,
            height: scale(56),
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: scale(12),
        },
        continueText: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(18),
            color: '#FFFFFF',
        },
    });

export default FeedbackCard;
