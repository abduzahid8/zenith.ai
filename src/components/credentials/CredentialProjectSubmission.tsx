import React, { useEffect, useState } from 'react';
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

/**
 * Slice 5 — one lightweight project submission sheet (no new app page).
 * Text-only: a link/reference and/or notes. There is no file-upload
 * authority in this slice, so no picker, attachment, or progress UI.
 * The sheet never grades and never writes directly: it hands trimmed
 * input to the parent RPC flow and honors the returned outcome.
 */

export interface ProjectSheetOutcome {
    ok: boolean;
    /** Safe retryable copy (network only). Parent closes otherwise. */
    errorCopy?: string;
}

export interface CredentialProjectSubmissionProps {
    visible: boolean;
    /** Display-only requirement label, e.g. "Game analysis". */
    headline: string;
    /** Display-only requirement description. */
    description: string;
    /** "Submit Project" for first submit, "Submit revision" for rework. */
    submitLabel: string;
    onSubmit: (artifactRef: string, notes: string) => Promise<ProjectSheetOutcome>;
    onClose: () => void;
}

export const CredentialProjectSubmission: React.FC<CredentialProjectSubmissionProps> = ({
    visible,
    headline,
    description,
    submitLabel,
    onSubmit,
    onClose,
}) => {
    const { colors } = useAppTheme();
    const [artifact, setArtifact] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const mounted = React.useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (visible) {
            // Clean editable fields on every open: never silently resubmit
            // old values, never mutate a previous submission row.
            setArtifact('');
            setNotes('');
            setBusy(false);
            setError(null);
        }
    }, [visible]);

    if (!visible) return null;

    const submit = async () => {
        if (busy) return;
        if (artifact.trim() === '' && notes.trim() === '') {
            setError('Add a project reference or your project notes.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const outcome = await onSubmit(artifact, notes);
            if (!mounted.current) return;
            if (!outcome.ok) {
                // Retryable (network): stay open with safe copy.
                setError(outcome.errorCopy ?? 'Project submission needs an internet connection.');
            }
            // Parent closes the sheet on success and on terminal outcomes.
        } finally {
            if (mounted.current) setBusy(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: colors.text }]}>
                            {headline}
                        </Text>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.close, { color: colors.textSecondary }]}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>
                        {description}
                    </Text>
                    <Text style={[styles.label, { color: colors.text }]}>
                        Project link or reference
                    </Text>
                    <TextInput
                        style={[styles.input, { color: colors.text, borderColor: colors.textSecondary }]}
                        value={artifact}
                        onChangeText={setArtifact}
                        placeholder="https://…"
                        placeholderTextColor="#999"
                        editable={!busy}
                        autoCapitalize="none"
                    />
                    <Text style={[styles.label, { color: colors.text }]}>
                        Notes / analysis
                    </Text>
                    <TextInput
                        style={[styles.input, styles.multiline, { color: colors.text, borderColor: colors.textSecondary }]}
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Paste your PGN, analysis, or essay…"
                        placeholderTextColor="#999"
                        editable={!busy}
                        multiline
                    />
                    {error && (
                        <Text style={[styles.error, { color: colors.text }]}>
                            {error}
                        </Text>
                    )}
                    <TouchableOpacity
                        style={[styles.primary, { backgroundColor: colors.buttonPrimary }, busy && styles.disabled]}
                        onPress={() => void submit()}
                        disabled={busy}
                        activeOpacity={0.7}
                    >
                        {busy ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={[styles.primaryText, { color: colors.white }]}>{submitLabel}</Text>
                        )}
                    </TouchableOpacity>
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
    body: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(14),
        lineHeight: scale(20),
        marginBottom: scale(12),
    },
    label: {
        fontFamily: fonts.heading.medium,
        fontSize: scale(13),
        marginBottom: scale(6),
    },
    input: {
        borderWidth: 1,
        borderRadius: scale(12),
        paddingVertical: scale(12),
        paddingHorizontal: scale(16),
        fontSize: scale(15),
        marginBottom: scale(12),
    },
    multiline: {
        minHeight: scale(88),
    },
    error: {
        fontFamily: fonts.heading.regular,
        fontSize: scale(13),
        marginBottom: scale(8),
    },
    primary: {
        borderRadius: scale(12),
        paddingVertical: scale(12),
        alignItems: 'center',
        marginTop: scale(4),
    },
    disabled: {
        opacity: 0.6,
    },
    primaryText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(16),
    },
});

export default CredentialProjectSubmission;
