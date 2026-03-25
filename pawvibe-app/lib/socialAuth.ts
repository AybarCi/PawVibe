/**
 * Social Authentication — Apple & Google Sign-In
 * 
 * Uses Supabase Auth with native identity tokens for seamless login/linking.
 * These functions only work in native builds (NOT Expo Go).
 */
import { Platform } from 'react-native';
import { supabase } from './supabase';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';

const isExpoGo = Constants.appOwnership === 'expo';

// === APPLE SIGN-IN ===

export const signInWithApple = async (): Promise<{ success: boolean; error?: string }> => {
    if (isExpoGo) {
        return { success: false, error: 'Apple Sign-In is not available in Expo Go' };
    }

    try {
        const AppleAuthentication = require('expo-apple-authentication');

        const isAvailable = await AppleAuthentication.isAvailableAsync();
        if (!isAvailable) {
            return { success: false, error: 'Apple Sign-In is not available on this device' };
        }

        // Generate a nonce for Apple too (best practice)
        const rawNonce = Array.from(
            Crypto.getRandomBytes(32),
            (byte) => byte.toString(16).padStart(2, '0')
        ).join('');
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
            return { success: false, error: 'No identity token received from Apple' };
        }

        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
            nonce: rawNonce,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        // User cancelled
        if (e.code === 'ERR_REQUEST_CANCELED' || e.code === 'ERR_CANCELED') {
            return { success: false, error: 'cancelled' };
        }
        console.error('[SocialAuth] Apple sign-in error:', e);
        return { success: false, error: e.message || 'Apple Sign-In failed' };
    }
};

// === GOOGLE SIGN-IN ===

let googleConfigured = false;

const configureGoogle = () => {
    if (isExpoGo || googleConfigured) return;
    try {
        const { GoogleSignin } = require('@react-native-google-signin/google-signin');
        GoogleSignin.configure({
            webClientId: '805364395142-c02fk5t0hm39au11nagdu5arl7h541ke.apps.googleusercontent.com',
            iosClientId: Platform.OS === 'ios' ? '805364395142-esbqqr3j5c7f0fi8hafifvs43jb6f64t.apps.googleusercontent.com' : undefined,
        });
        googleConfigured = true;
    } catch (e) {
        console.warn('[SocialAuth] Failed to configure Google Sign-In:', e);
    }
};

export const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (isExpoGo) {
        return { success: false, error: 'Google Sign-In is not available in Expo Go' };
    }

    try {
        configureGoogle();

        const { GoogleSignin } = require('@react-native-google-signin/google-signin');

        await GoogleSignin.hasPlayServices();
        const response = await GoogleSignin.signIn();

        const idToken = response?.data?.idToken;
        if (!idToken) {
            return { success: false, error: 'No ID token received from Google' };
        }

        // No nonce needed — "Skip nonce checks" is enabled in Supabase Dashboard
        const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (e: any) {
        if (e.code === 'SIGN_IN_CANCELLED' || e.code === '12501') {
            return { success: false, error: 'cancelled' };
        }
        console.error('[SocialAuth] Google sign-in error:', e);
        return { success: false, error: e.message || 'Google Sign-In failed' };
    }
};
