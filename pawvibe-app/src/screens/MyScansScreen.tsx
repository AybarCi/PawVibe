import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, ActivityIndicator, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Session } from '@supabase/supabase-js';
import PawVibeLoader from '../components/PawVibeLoader';
import AstroModal from '../components/AstroModal';
import MonthlyReportModal from '../components/MonthlyReportModal';

export default function MyScansScreen() {
    const { t } = useTranslation();
    const [scans, setScans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [session, setSession] = useState<Session | null>(null);
    const [isPremiumUser, setIsPremiumUser] = useState(false);

    // Modal States
    const [astroModalVisible, setAstroModalVisible] = useState(false);
    const [selectedAstroScanId, setSelectedAstroScanId] = useState<string | null>(null);
    const [monthlyReportModalVisible, setMonthlyReportModalVisible] = useState(false);

    const fetchScans = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);

            if (session) {
                // Fetch Scans
                const { data: scansData, error: scansError } = await supabase
                    .from('scans')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false });

                if (!scansError) {
                    setScans(scansData);
                }

                // Get premium status
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('is_premium')
                    .eq('id', session.user.id)
                    .single();

                setIsPremiumUser(profile?.is_premium || false);
            }
        } catch (error) {
            console.error('Fetch scans error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchScans();
        }, [])
    );

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        fetchScans();
    }, []);

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <PawVibeLoader size={120} />
            </View>
        );
    }

    if (!session) {
        return (
            <View style={[styles.centerContainer, { padding: 20 }]}>
                <Ionicons name="images-outline" size={64} color="#FF007F" style={{ marginBottom: 20 }} />
                <Text style={[styles.errorText, { fontSize: 20, textAlign: 'center' }]}>{t('app.profile_not_created')}</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ padding: 20 }}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF007F" />
            }
        >
            <Text style={styles.headerTitle}>{t('app.tab_scans', 'My Scans')}</Text>

            {/* Premium Feature Placeholder */}
            {scans.length > 0 && (
                <TouchableOpacity
                    style={styles.monthlyReportBtn}
                    onPress={() => setMonthlyReportModalVisible(true)}
                >
                    <Ionicons name="document-text-outline" size={20} color="white" style={{ marginRight: 6 }} />
                    <Text style={styles.monthlyReportBtnText}>{t('app.generate_monthly_report', 'Generate Monthly Report')}</Text>
                </TouchableOpacity>
            )}

            {/* History Section */}
            {scans.length === 0 ? (
                <Text style={styles.emptyText}>{t('app.no_scans')}</Text>
            ) : (
                scans.map((scan) => {
                    const isRealPet = scan.is_pet !== false && !(
                        scan.chaos_score === 0 &&
                        scan.energy_level === 0 &&
                        scan.sweetness_score === 0 &&
                        scan.judgment_level === 0 &&
                        scan.cuddle_o_meter === 0 &&
                        scan.derp_factor === 0
                    );

                    return (
                        <View key={scan.id} style={styles.scanCard}>
                            <View style={styles.scanHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.scanMood}>{scan.mood_title}</Text>
                                    <Text style={styles.scanDate}>{new Date(scan.created_at).toLocaleDateString()}</Text>
                                </View>
                                {isRealPet && (
                                    <TouchableOpacity
                                        style={styles.astroBtn}
                                        onPress={() => {
                                            setSelectedAstroScanId(scan.id);
                                            setAstroModalVisible(true);
                                        }}
                                    >
                                        <Text style={styles.astroBtnText}>✨ {t('app.astro_chart', 'Astro Chart')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {isRealPet && (
                                <View style={styles.scanStats}>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.chaos')}: {scan.chaos_score ?? 0} 🌪️</Text>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.energy')}: {scan.energy_level ?? 0} ⚡</Text>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.sweetness')}: {scan.sweetness_score ?? 0} 🍬</Text>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.judgment')}: {scan.judgment_level ?? 0} 😒</Text>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.cuddle')}: {scan.cuddle_o_meter ?? 0} 🤗</Text>
                                    <Text style={styles.scanStatText} numberOfLines={1}>{t('app.derp')}: {scan.derp_factor ?? 0} 🤪</Text>
                                </View>
                            )}
                        </View>
                    );
                })
            )}

            <AstroModal
                visible={astroModalVisible}
                onClose={() => setAstroModalVisible(false)}
                scanId={selectedAstroScanId}
                isPremiumUser={isPremiumUser}
            />

            <MonthlyReportModal
                visible={monthlyReportModalVisible}
                onClose={() => setMonthlyReportModalVisible(false)}
                isPremiumUser={isPremiumUser}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    centerContainer: { flex: 1, backgroundColor: '#0A001A', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFD700', fontSize: 32, fontWeight: '900', marginBottom: 20, marginTop: 40, textShadowColor: '#FF007F', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    errorText: { color: 'white', textAlign: 'center', marginTop: 50 },

    monthlyReportBtn: { backgroundColor: '#6A4C93', padding: 15, borderRadius: 10, marginBottom: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', borderWidth: 1, borderColor: '#FF007F' },
    monthlyReportBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

    emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },

    scanCard: { backgroundColor: '#1A0B2E', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    scanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    scanMood: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    scanDate: { color: '#6A4C93', fontSize: 12 },

    astroBtn: { backgroundColor: '#2a3b5e', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#FFD700' },
    astroBtnText: { color: '#FFD700', fontWeight: 'bold', fontSize: 12 },

    scanStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10, borderTopWidth: 1, borderTopColor: '#2a3b5e', paddingTop: 10 },
    scanStatText: { color: '#FF007F', fontSize: 13, fontWeight: '600', width: '48%', marginBottom: 5 }
});
