import { getSupabase } from './client';
import { Platform, Linking } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

export const authService = {
    signUp: async (email: string, password: string) => {
        const supabase = getSupabase();
        const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
        const emailRedirectTo = webUrl ? `${webUrl}/auth-callback` : 'zenyth://auth-callback';
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
        if (error) throw error;
        // Supabase silently "succeeds" for existing emails (no error, no email sent, identities:[])
        if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
            throw new Error('This email is already registered. Please sign in instead.');
        }
        return data;
    },

    signIn: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        return data;
    },

    signInWithGoogle: async () => {
        const supabase = getSupabase();
        const redirectUrl = makeRedirectUri({ scheme: 'zenyth' });

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                skipBrowserRedirect: true,
                queryParams: {
                    prompt: 'select_account',
                },
            },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No OAuth URL returned from Supabase');

        return new Promise<any>((resolve, reject) => {
            let settled = false;
            let cancelTimer: ReturnType<typeof setTimeout> | null = null;

            // ── helpers ────────────────────────────────────────────────────────

            /**
             * handleRedirectUrl – takes EXCLUSIVE ownership of the promise by
             * setting `settled = true` synchronously before any async work.
             * This prevents the cancel timer from firing mid-flight and prevents
             * a second invocation (from the other delivery path) from racing.
             */
            const handleRedirectUrl = async (incomingUrl: string) => {
                if (settled) return;
                // Claim ownership immediately (synchronous)
                settled = true;
                if (cancelTimer) clearTimeout(cancelTimer);
                listener.remove();

                try {
                    try { Promise.resolve(WebBrowser.dismissBrowser()).catch(() => {}); } catch (_) {}

                    // Tokens may be in the hash fragment (#access_token=…)
                    // or in query params (?access_token=… or ?code=… for PKCE)
                    const parsedUrl = new URL(incomingUrl);
                    const raw = parsedUrl.hash
                        ? parsedUrl.hash.substring(1)
                        : parsedUrl.search.substring(1);
                    const params = new URLSearchParams(raw);

                    const code = params.get('code');
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token') ?? '';

                    if (code) {
                        // PKCE flow: exchange the authorization code for a session
                        const { data: sd, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
                        if (sessionError) reject(sessionError);
                        else resolve(sd);
                    } else if (accessToken) {
                        // Implicit flow: set session directly from tokens in URL
                        const { data: sd, error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (sessionError) reject(sessionError);
                        else resolve(sd);
                    } else {
                        reject(new Error('Authentication failed: no code or access token in redirect URL'));
                    }
                } catch (e) {
                    reject(e instanceof Error ? e : new Error('Failed to process authentication response'));
                }
            };

            /** Reject once, safely. */
            const cancel = (reason: string) => {
                if (settled) return;
                settled = true;
                if (cancelTimer) clearTimeout(cancelTimer);
                listener.remove();
                reject(new Error(reason));
            };

            // ── register deep-link listener BEFORE opening the browser ─────────
            // Primary delivery path on Android; fallback on iOS.
            const listener = Linking.addEventListener('url', ({ url: incomingUrl }) => {
                const expectedScheme = redirectUrl.split(':')[0] + '://';
                if (!incomingUrl.startsWith(expectedScheme)) return;
                handleRedirectUrl(incomingUrl);
            });

            // ── open the OAuth browser ─────────────────────────────────────────
            WebBrowser.openAuthSessionAsync(data.url, redirectUrl)
                .then((result) => {
                    if (settled) return;

                    if (result.type === 'success' && result.url) {
                        // iOS: ASWebAuthenticationSession captured the redirect URL directly
                        handleRedirectUrl(result.url);
                    } else if (result.type === 'cancel') {
                        // iOS: user tapped the system "Cancel" button — reject immediately
                        cancel('Google sign-in was cancelled');
                    } else {
                        // 'dismiss' — on Android this fires even after a SUCCESSFUL redirect
                        // because Chrome Custom Tabs close when the deep link is handled.
                        // Give the Linking listener a short grace period before giving up.
                        cancelTimer = setTimeout(
                            () => cancel('Google sign-in was cancelled'),
                            2000
                        );
                    }
                })
                .catch((e) => {
                    cancel(e instanceof Error ? e.message : 'Failed to open sign-in browser');
                });
        });
    },

    signInWithApple: async () => {
        if (Platform.OS !== 'ios') {
            throw new Error('Apple sign-in is only available on iOS');
        }

        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            rawNonce
        );

        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
            nonce: hashedNonce,
        });

        if (!credential.identityToken) {
            throw new Error('No identity token returned from Apple');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
        });

        if (error) throw error;
        return data;
    },

    signOut: async () => {
        const supabase = getSupabase();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    getSession: async () => {
        try {
            const supabase = getSupabase();
            const { data, error } = await supabase.auth.getSession();
            if (error) throw error;
            return data.session;
        } catch (e) {
            console.warn('Supabase init skipped or failed:', e);
            return null;
        }
    },

    getUser: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        return data.user;
    },

    forgotPassword: async (email: string) => {
        const supabase = getSupabase();
        const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
        const redirectTo = webUrl
            ? `${webUrl}/auth-callback`
            : 'zenyth://auth-callback';
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        });
        if (error) throw error;
    },

    updatePassword: async (password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        return data;
    },

    resendConfirmation: async (email: string) => {
        const supabase = getSupabase();
        const webUrl = process.env.EXPO_PUBLIC_WEB_APP_URL;
        const emailRedirectTo = webUrl ? `${webUrl}/auth-callback` : 'zenyth://auth-callback';
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
            options: { emailRedirectTo },
        });
        if (error) throw error;
    },

    deleteAccount: async () => {
        console.log('[authService] getSupabase()...');
        const supabase = getSupabase();
        console.log('[authService] Calling delete_user_account RPC...');
        const { error } = await supabase.rpc('delete_user_account');
        console.log('[authService] RPC result error:', error);
        
        if (error) {
            console.error('[authService] RPC error:', error);
            throw error;
        }
        console.log('[authService] RPC execution successful.');
    },
};
