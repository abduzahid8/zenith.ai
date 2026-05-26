import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { scale } from '../../constants';
import { fonts } from '../../theme';
import { useAppTheme } from '../../theme/useAppTheme';
import { useT } from '../../store/languageStore';
import { useGamificationStore } from '../../store/gamificationStore';

interface PythonRunnerProps {
    starterCode: string;
    onOutput: (stdout: string, stderr: string | null) => void;
}

const INLINE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/pyodide/v0.27.0/full/pyodide.js"></script>
</head>
<body style="margin:0; padding:0; background-color: transparent;">
<script>
  let pyodide = null;
  async function init() {
    try {
      pyodide = await loadPyodide();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.message }));
    }
  }
  init();

  window.addEventListener('message', async (e) => {
    try {
      const { code } = JSON.parse(e.data);
      if (!pyodide) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', stdout: '', error: 'Pyodide is not loaded yet' }));
        return;
      }
      
      // Capture stdout/stderr
      pyodide.runPython(\`
import sys, io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
\`);
      pyodide.runPython(code);
      const stdout = pyodide.runPython('sys.stdout.getvalue()');
      const stderr = pyodide.runPython('sys.stderr.getvalue()');
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', stdout, error: stderr || null }));
    } catch (err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'result', stdout: '', error: err.message }));
    }
  });
</script>
</body>
</html>
`;

export const PythonRunner: React.FC<PythonRunnerProps> = ({
    starterCode,
    onOutput,
}) => {
    const { colors } = useAppTheme();
    const t = useT();
    const webViewRef = useRef<WebView>(null);
    const { recordCodeRun } = useGamificationStore();

    // Editor & Console state
    const [code, setCode] = useState(starterCode);
    const [pyodideReady, setPyodideReady] = useState(false);
    const [running, setRunning] = useState(false);
    const [stdout, setStdout] = useState('');
    const [stderr, setStderr] = useState<string | null>(null);

    const handleRunCode = () => {
        if (!pyodideReady || running) return;

        console.log('[PythonRunner] Running code...');
        setRunning(true);
        setStdout('');
        setStderr(null);

        // Record code run event in gamification store (unlocks first_code_run badge)
        recordCodeRun();

        webViewRef.current?.postMessage(JSON.stringify({ code }));
    };

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            console.log('[PythonRunner] Received message from WebView:', data.type);

            if (data.type === 'ready') {
                setPyodideReady(true);
            } else if (data.type === 'error') {
                setStderr(data.message || 'Ошибка загрузки среды');
            } else if (data.type === 'result') {
                setStdout(data.stdout || '');
                setStderr(data.error || null);
                setRunning(false);
                onOutput(data.stdout || '', data.error || null);
            }
        } catch (e) {
            console.error('[PythonRunner] Failed to parse WebView message:', e);
            setRunning(false);
        }
    };

    return (
        <View style={styles.container}>
            {/* Hidden WebView to run Pyodide */}
            <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
                <WebView
                    ref={webViewRef}
                    source={{ html: INLINE_HTML }}
                    onMessage={handleMessage}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                />
            </View>

            {/* Preparation / Loader Overlay */}
            {!pyodideReady && (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color="#FF5722" />
                    <Text style={styles.loaderText}>
                        {t('🐍 Подготовка Python-среды (Pyodide)...')}
                    </Text>
                </View>
            )}

            {pyodideReady && (
                <>
                    {/* Code Editor */}
                    <View style={styles.editorContainer}>
                        <View style={styles.editorHeader}>
                            <Text style={styles.editorTitle}>index.py</Text>
                        </View>
                        <TextInput
                            style={styles.editorInput}
                            multiline
                            value={code}
                            onChangeText={setCode}
                            autoCapitalize="none"
                            autoCorrect={false}
                            spellCheck={false}
                        />
                    </View>

                    {/* Actions */}
                    <TouchableOpacity
                        style={[styles.runButton, running && styles.disabledButton]}
                        onPress={handleRunCode}
                        disabled={running}
                        activeOpacity={0.8}
                    >
                        {running ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.runButtonText}>▶ {t('Запустить код')}</Text>
                        )}
                    </TouchableOpacity>

                    {/* Output Console */}
                    <View style={styles.consoleContainer}>
                        <Text style={styles.consoleTitle}>{t('Вывод консоли:')}</Text>
                        <ScrollView style={styles.consoleScroll} nestedScrollEnabled>
                            {running ? (
                                <Text style={styles.consoleLoading}>{t('Выполнение...')}</Text>
                            ) : stderr ? (
                                <Text style={styles.consoleError}>{stderr}</Text>
                            ) : stdout ? (
                                <Text style={styles.consoleOutput}>{stdout}</Text>
                            ) : (
                                <Text style={styles.consolePlaceholder}>
                                    {t('Здесь появится результат выполнения программы.')}
                                </Text>
                            )}
                        </ScrollView>
                    </View>
                </>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    loaderContainer: {
        paddingVertical: scale(40),
        alignItems: 'center',
        justifyContent: 'center',
    },
    loaderText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(14),
        color: 'rgba(30, 30, 46, 0.6)',
        marginTop: scale(16),
        textAlign: 'center',
    },
    editorContainer: {
        backgroundColor: '#1E1E24',
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#2D2D35',
        overflow: 'hidden',
        height: scale(200),
        marginBottom: scale(12),
    },
    editorHeader: {
        backgroundColor: '#25252D',
        paddingHorizontal: scale(16),
        paddingVertical: scale(8),
        borderBottomWidth: 1,
        borderBottomColor: '#2D2D35',
    },
    editorTitle: {
        fontFamily: 'Courier',
        fontSize: scale(12),
        color: '#A0A0AB',
        fontWeight: 'bold',
    },
    editorInput: {
        flex: 1,
        fontFamily: 'Courier',
        fontSize: scale(14),
        color: '#F4F4F5',
        padding: scale(16),
        textAlignVertical: 'top',
    },
    runButton: {
        backgroundColor: '#FF5722',
        borderRadius: scale(8),
        height: scale(44),
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: scale(16),
    },
    disabledButton: {
        opacity: 0.6,
    },
    runButtonText: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(15),
        color: '#FFFFFF',
    },
    consoleContainer: {
        backgroundColor: '#09090B',
        borderRadius: scale(12),
        borderWidth: 1,
        borderColor: '#27272A',
        padding: scale(16),
        height: scale(120),
    },
    consoleTitle: {
        fontFamily: fonts.heading.bold,
        fontSize: scale(12),
        color: '#71717A',
        marginBottom: scale(8),
    },
    consoleScroll: {
        flex: 1,
    },
    consolePlaceholder: {
        fontFamily: 'Courier',
        fontSize: scale(13),
        color: '#52525B',
    },
    consoleLoading: {
        fontFamily: 'Courier',
        fontSize: scale(13),
        color: '#A1A1AA',
    },
    consoleOutput: {
        fontFamily: 'Courier',
        fontSize: scale(13),
        color: '#4ADE80', // Green for success output
    },
    consoleError: {
        fontFamily: 'Courier',
        fontSize: scale(13),
        color: '#F87171', // Red for errors
    },
});

export default PythonRunner;
