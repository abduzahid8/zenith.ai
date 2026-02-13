import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fonts } from '../theme';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Global error boundary that prevents white-screen-of-death crashes.
 * Catches unhandled JS errors in the component tree and shows a recovery UI.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        // In production, send to crash reporting service (e.g., Sentry)
        if (__DEV__) {
            console.error('ErrorBoundary caught:', error, errorInfo);
        }
    }

    handleRetry = (): void => {
        this.setState({ hasError: false, error: null });
    };

    render(): ReactNode {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <View style={styles.container}>
                    <Text style={styles.emoji}>😵</Text>
                    <Text style={styles.title}>Что-то пошло не так</Text>
                    <Text style={styles.message}>
                        Произошла непредвиденная ошибка. Попробуйте снова.
                    </Text>
                    {__DEV__ && this.state.error && (
                        <Text style={styles.errorDetail}>
                            {this.state.error.message}
                        </Text>
                    )}
                    <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
                        <Text style={styles.retryText}>Попробовать снова</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.errorBoundary.background,
        padding: 32,
    },
    emoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    title: {
        fontFamily: fonts.heading.bold,
        fontSize: 24,
        color: colors.errorBoundary.text,
        marginBottom: 12,
        textAlign: 'center',
    },
    message: {
        fontFamily: fonts.body.regular,
        fontSize: 16,
        color: colors.errorBoundary.muted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    errorDetail: {
        fontFamily: fonts.body.light,
        fontSize: 12,
        color: colors.errorBoundary.mutedLight,
        textAlign: 'center',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    retryButton: {
        backgroundColor: colors.errorBoundary.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
    },
    retryText: {
        fontFamily: fonts.heading.bold,
        fontSize: 16,
        color: '#FFF',
    },
});

export default ErrorBoundary;
