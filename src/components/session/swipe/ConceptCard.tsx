import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { scale } from '../../../constants';
import { fonts } from '../../../theme';
import { useAppTheme } from '../../../theme/useAppTheme';

interface PassiveCardProps {
    eyebrow: string;
    title?: string;
    body: string;
    footerHint?: string;
}

const PassiveCardShell: React.FC<PassiveCardProps & { tone?: 'light' | 'code' }> = ({
    eyebrow,
    title,
    body,
    footerHint,
    tone = 'light',
}) => {
    const { colors } = useAppTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    return (
        <View style={styles.viewport}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
            >
                <Text style={styles.eyebrow}>{eyebrow}</Text>
                {!!title && <Text style={styles.title}>{title}</Text>}
                <Text style={[styles.body, tone === 'code' && styles.codeBody]}>{body}</Text>
            </ScrollView>
            {!!footerHint && (
                <View style={styles.footer}>
                    <Text style={styles.footerHint}>{footerHint}</Text>
                </View>
            )}
        </View>
    );
};

export const ConceptCard: React.FC<{ eyebrow: string; title?: string; body: string }> = (props) => (
    <PassiveCardShell {...props} footerHint="Свайп ↑" />
);

export const ExampleCard: React.FC<{ body: string }> = ({ body }) => (
    <PassiveCardShell eyebrow="Пример" body={body} tone="code" footerHint="Свайп ↑" />
);

export const KeyIdeaCard: React.FC<{ term: string }> = ({ term }) => (
    <PassiveCardShell eyebrow="Запомни" title={term} body="" footerHint="Свайп ↑" />
);

const createStyles = (colors: any) =>
    StyleSheet.create({
        viewport: {
            flex: 1,
            backgroundColor: '#EDF2F7',
            paddingHorizontal: scale(24),
            paddingTop: scale(12),
            paddingBottom: scale(16),
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
        title: {
            fontFamily: fonts.heading.bold,
            fontSize: scale(34),
            lineHeight: scale(40),
            color: '#1A253C',
            marginBottom: scale(16),
        },
        body: {
            fontFamily: fonts.body?.light || fonts.heading.light,
            fontSize: scale(19),
            lineHeight: scale(29),
            color: '#1A253C',
        },
        codeBody: {
            fontFamily: 'monospace',
            fontSize: scale(16),
            lineHeight: scale(26),
            backgroundColor: '#0F2147',
            color: '#E8F1FF',
            borderRadius: scale(16),
            padding: scale(16),
            overflow: 'hidden',
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
    });

export default ConceptCard;
