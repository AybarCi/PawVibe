import { StyleSheet, Text, View, ActivityIndicator, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
    const { t } = useTranslation();
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [scans, setScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (session?.user) {
                fetchProfileData();
            }
        }, [session])
    );

    const fetchProfileData = async () => {
        if (!session?.user) return;
        setLoading(true);

        try {
            // Fetch profile credits
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profileError && profileError.code !== 'PGRST116') {
                console.error('Error fetching profile:', profileError);
            } else if (profileData) {
                setProfile(profileData);
            }

            // Fetch scan history
            const { data: scanData, error: scanError } = await supabase
                .from('scans')
                .select('*')
                .eq('user_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (scanError) {
                console.error('Error fetching scans:', scanError);
            } else if (scanData) {
                setScans(scanData);
            }

        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#FF4B4B" />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.container}>
                <Text style={styles.errorText}>{t('app.profile_not_created')}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.headerTitle}>{t('app.profile_title')}</Text>

            {/* Credits Section */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>{t('app.my_credits')}</Text>
                <View style={styles.creditRow}>
                    <Text style={styles.creditLabel}>{t('app.weekly_free')}</Text>
                    <Text style={styles.creditValue}>{profile.weekly_credits}</Text>
                </View>
                <View style={[styles.creditRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.creditLabel}>{t('app.purchased_scans')}</Text>
                    <Text style={styles.creditValue}>{profile.purchased_credits}</Text>
                </View>
                {/* TODO: Add RevenueCat Purchase Buttons Here */}
                <View style={styles.premiumBox}>
                    <Text style={styles.premiumText}>{t('app.buy_snack_pack')}</Text>
                </View>
            </View>

            {/* History Section */}
            <Text style={styles.sectionTitle}>{t('app.recent_scans')}</Text>
            {scans.length === 0 ? (
                <Text style={styles.emptyText}>{t('app.no_scans')}</Text>
            ) : (
                scans.map((scan) => (
                    <View key={scan.id} style={styles.scanCard}>
                        <Text style={styles.scanMood}>{scan.mood_title}</Text>
                        <Text style={styles.scanDate}>{new Date(scan.created_at).toLocaleDateString()}</Text>
                        <View style={styles.scanStats}>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.chaos')}: {scan.chaos_score ?? 0} 🌪️</Text>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.energy')}: {scan.energy_level ?? 0} ⚡</Text>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.sweetness')}: {scan.sweetness_score ?? 0} 🍬</Text>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.judgment')}: {scan.judgment_level ?? 0} 😒</Text>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.cuddle')}: {scan.cuddle_o_meter ?? 0} 🤗</Text>
                            <Text style={styles.scanStatText} numberOfLines={1}>{t('app.derp')}: {scan.derp_factor ?? 0} 🤪</Text>
                        </View>
                    </View>
                ))
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    headerTitle: { color: '#FFD700', fontSize: 32, fontWeight: '900', marginBottom: 20, marginTop: 40, textShadowColor: '#FF007F', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
    card: { backgroundColor: '#1A0B2E', padding: 20, borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: '#FF007F' },
    cardTitle: { color: '#FF007F', fontSize: 22, fontWeight: '900', marginBottom: 15 },
    creditRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a3b5e' },
    creditLabel: { color: '#ccc', fontSize: 16 },
    creditValue: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },
    premiumBox: { backgroundColor: '#FF007F', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', shadowColor: '#FF007F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
    premiumText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    sectionTitle: { color: '#6A4C93', fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center' },
    scanCard: { backgroundColor: '#1A0B2E', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    scanMood: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    scanDate: { color: '#6A4C93', fontSize: 12, marginBottom: 10 },
    scanStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
    scanStatText: { color: '#FF007F', fontSize: 13, fontWeight: '600', width: '48%', marginBottom: 5 }
});
