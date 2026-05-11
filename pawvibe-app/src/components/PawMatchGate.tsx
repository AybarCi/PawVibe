import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface PawMatchGateProps {
    isPremium: boolean;
    isAnonymous: boolean;
    onUpgrade: () => void;
    onLinkAccount: () => void;
    children: React.ReactNode;
}

export default function PawMatchGate({ isPremium, isAnonymous, onUpgrade, onLinkAccount, children }: PawMatchGateProps) {
    const { t } = useTranslation();

    if (isAnonymous) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0A001A', '#1A0B2E']} style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="lock-closed" size={60} color="#FFD700" />
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>SECURE</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>{t('pawmatch.link_required_title', 'Secure Your Account')}</Text>
                    <Text style={styles.desc}>
                        {t('pawmatch.link_required_desc', 'To join PawMatch and connect with other pet owners, you need to secure your account with an email or social login.')}
                    </Text>
                    <TouchableOpacity 
                        style={styles.primaryBtn} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onLinkAccount();
                        }}
                    >
                        <Text style={styles.btnText}>{t('pawmatch.link_account_btn', 'Link Account')}</Text>
                        <Ionicons name="arrow-forward" size={18} color="white" />
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    if (!isPremium) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={['#0A001A', '#2E001F']} style={styles.content}>
                    <View style={styles.premiumIconContainer}>
                        <Ionicons name="heart" size={80} color="#FF007F" />
                        <View style={[styles.badge, { backgroundColor: '#FF007F' }]}>
                            <Text style={styles.badgeText}>PREMIUM</Text>
                        </View>
                    </View>
                    <Text style={styles.title}>{t('pawmatch.premium_required_title', 'Unlock PawMatch')}</Text>
                    <Text style={styles.desc}>
                        {t('pawmatch.premium_required_desc', 'PawMatch is an exclusive feature for our premium members. Find the perfect mate for your pet and verify health records.')}
                    </Text>
                    <TouchableOpacity 
                        style={[styles.primaryBtn, { backgroundColor: '#FF007F' }]} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            onUpgrade();
                        }}
                    >
                        <Text style={styles.btnText}>{t('pawmatch.upgrade_now_btn', 'Go Premium')}</Text>
                        <Ionicons name="star" size={18} color="white" />
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        );
    }

    return <>{children}</>;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A001A',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    iconContainer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    premiumIconContainer: {
        marginBottom: 30,
        alignItems: 'center',
    },
    badge: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
        marginTop: -15,
    },
    badgeText: {
        color: 'black',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    title: {
        color: 'white',
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 15,
        textTransform: 'uppercase',
    },
    desc: {
        color: '#D3C4E5',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 40,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6A4C93',
        paddingHorizontal: 30,
        paddingVertical: 18,
        borderRadius: 20,
        gap: 10,
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    btnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
    }
});
