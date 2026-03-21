import { getSupabase } from './client';
import { Platform, Linking } from 'react-native';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';

export const authService = {
    signUp: async (email: string, password: string) => {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
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
            },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No OAuth URL returned');

        // Listen for the deep-link redirect BEFORE opening the browser
        // The hash fragment (#access_token=...) is only available via Linking, not WebBrowser result.url
        const sessionData = await new Promise<any>((resolve, reject) => {
            let settled = false;

            const listener = Linking.addEventListener('url', async ({ url: incomingUrl }) => {
                if (settled) return;
                if (!incomingUrl.startsWith('zenyth://')) return;

                settled = true;
                listener.remove();
                WebBrowser.dismissBrowser();

                try {
                    // Tokens may be in hash fragment or query params
                    const parsedUrl = new URL(incomingUrl);
                    const params = new URLSearchParams(
                        parsedUrl.hash ? parsedUrl.hash.substring(1) : parsedUrl.search.substring(1)
                    );
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');

                    if (!accessToken) {
                        reject(new Error('No access token in redirect URL'));
                        return;
                    }

                    const { data: sd, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken || '',
                    });
                    if (sessionError) reject(sessionError);
                    else resolve(sd);
                } catch (e) {
                    reject(e);
                }
            });

            // Open the browser — resolve/reject happens via the listener above
            WebBrowser.openAuthSessionAsync(data.url, redirectUrl).then((result) => {
                if (settled) return;
                // Browser closed without a redirect (user cancelled)
                if (result.type === 'cancel' || result.type === 'dismiss') {
                    settled = true;
                    listener.remove();
                    reject(new Error('Google sign-in was cancelled'));
                    return;
                }
                // Some platforms deliver the URL through WebBrowser result directly
                if (result.type === 'success' && result.url) {
                    settled = true;
                    listener.remove();
                    const parsedUrl = new URL(result.url);
                    const params = new URLSearchParams(
                        parsedUrl.hash ? parsedUrl.hash.substring(1) : parsedUrl.search.substring(1)
                    );
                    const accessToken = params.get('access_token');
                    const refreshToken = params.get('refresh_token');
                    if (accessToken) {
                        supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken || '',
                        }).then(({ data: sd, error: sessionError }) => {
                            if (sessionError) reject(sessionError);
                            else resolve(sd);
                        });
                    } else {
                        reject(new Error('No access token in redirect URL'));
                    }
                }
            }).catch((e) => {
                if (!settled) {
                    settled = true;
                    listener.remove();
                    reject(e);
                }
            });
        });

        return sessionData;
    },

    signInWithApple: async () => {
        if (Platform.OS !== 'ios') {
            throw new Error('Apple sign-in is only available on iOS');
        }

        const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
        });

        if (!credential.identityToken) {
            throw new Error('No identity token returned from Apple');
        }

        const supabase = getSupabase();
        const { data, error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
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
        const redirectUrl = makeRedirectUri({ scheme: 'zenyth' });
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl,
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
        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
        });
        if (error) throw error;
    },

    deleteAccount: async () => {
        const supabase = getSupabase();
        const { data, error } = await supabase.functions.invoke('delete-account');
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
    },
};
