import { getSupabase } from './client';
import { Platform } from 'react-native';
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

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
            const url = new URL(result.url);
            // Tokens can come as hash fragment or query params
            const params = new URLSearchParams(
                url.hash ? url.hash.substring(1) : url.search.substring(1)
            );
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken) {
                const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken || '',
                });
                if (sessionError) throw sessionError;
                return sessionData;
            }
        }

        throw new Error('Google sign-in was cancelled or failed');
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
        const { error } = await supabase.rpc('delete_user_account');
        if (error) throw error;
    },
};
