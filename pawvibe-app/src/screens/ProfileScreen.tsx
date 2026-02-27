import { StyleSheet, Text, View, ActivityIndicator, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useIAP } from '../context/IAPContext';
import { IAP_PRODUCTS } from '../../lib/iap';

export default function ProfileScreen() {
    const { t } = useTranslation();
    const { products, subscriptions, purchasePackage, lastPurchaseSuccess } = useIAP();
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Credits' | 'Subscription'>('Credits');
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertTitle, setAlertTitle] = useState('');
    const [alertMessage, setAlertMessage] = useState('');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (!session) setLoading(false);
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (!session) setLoading(false);
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
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (lastPurchaseSuccess > 0) {
            fetchProfileData();
        }
    }, [lastPurchaseSuccess]);

    const handlePurchase = async (productId: string) => {
        const item = [...products, ...subscriptions].find(p => p.id === productId);
        if (!item) {
            console.warn(`Product ${productId} not found. Make sure products are configured in App Store/Play Store.`);
            return;
        }

        setLoading(true);

        let offerToken;
        // Extract offerToken for Android subscriptions
        if (Platform.OS === 'android' && 'subscriptionOffers' in item && item.subscriptionOffers?.length > 0) {
            offerToken = item.subscriptionOffers[0].offerTokenAndroid || undefined;
        }

        const { success, error } = await purchasePackage(productId, offerToken);
        setLoading(false);

        if (success) {
            // Re-fetch profile data to see updated credits or premium status
            fetchProfileData();
        } else if (error) {
            setAlertTitle(t('app.error', 'Error'));
            setAlertMessage(error);
            setAlertVisible(true);
        }
    };

    // Determine current user status from Supabase profile
    const isPremiumUser = profile?.is_premium;

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#FF4B4B" />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={[styles.centerContainer, { padding: 20 }]}>
                <Ionicons name="person-circle-outline" size={64} color="#FF007F" style={{ marginBottom: 20 }} />
                <Text style={[styles.errorText, { fontSize: 20, textAlign: 'center' }]}>{t('app.profile_not_created')}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            {/* Custom Alert Modal */}
            <Modal
                transparent={true}
                visible={alertVisible}
                animationType="fade"
                onRequestClose={() => setAlertVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{alertTitle}</Text>
                        <Text style={styles.modalMessage}>{alertMessage}</Text>
                        <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setAlertVisible(false)}>
                            <Text style={styles.btnText}>{t('app.ok', 'OK')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Text style={styles.headerTitle}>{t('app.profile_title')}</Text>

            {/* Custom Tab Segment Control */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'Credits' && styles.activeTab]}
                    onPress={() => setActiveTab('Credits')}
                >
                    <Text style={[styles.tabText, activeTab === 'Credits' && styles.activeTabText]}>
                        {t('app.tab_credits', 'Credits')}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tabButton, activeTab === 'Subscription' && styles.activeTab]}
                    onPress={() => setActiveTab('Subscription')}
                >
                    <Text style={[styles.tabText, activeTab === 'Subscription' && styles.activeTabText]}>
                        {t('app.tab_subscription', 'Subscription')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Credits Section */}
            {activeTab === 'Credits' && (
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

                    <View style={styles.purchaseContainer}>
                        <Text style={styles.purchaseTitle}>{t('app.get_more_scans')}</Text>

                        <TouchableOpacity style={styles.purchaseBtn} onPress={() => handlePurchase(IAP_PRODUCTS.SNACK_PACK)}>
                            <Text style={styles.purchaseBtnText}>🦴 {t('app.snack_pack')}</Text>
                            <Text style={styles.purchasePrice}>{products.find(p => p.id === IAP_PRODUCTS.SNACK_PACK)?.displayPrice || '$0.99'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.purchaseBtn, styles.popularBtn]} onPress={() => handlePurchase(IAP_PRODUCTS.PARTY_PACK)}>
                            <Text style={styles.purchaseBtnText}>🎉 {t('app.party_pack')}</Text>
                            <Text style={styles.purchasePrice}>{products.find(p => p.id === IAP_PRODUCTS.PARTY_PACK)?.displayPrice || '$2.99'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Subscription Section */}
            {activeTab === 'Subscription' && (
                <View style={styles.card}>
                    {isPremiumUser ? (
                        <View style={styles.premiumActiveBox}>
                            <Text style={styles.premiumActiveText}>👑 {t('app.premium_active')}</Text>
                            <Text style={{ color: '#ddd', marginTop: 10, textAlign: 'center' }}>
                                {t('app.premium_benefits_unlocked', 'You have unlocked unlimited scans, pet astrology charts, and monthly psychology reports!')}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.subscriptionContainer}>
                            <Text style={styles.purchaseTitle}>{t('app.go_premium')}</Text>

                            {/* Premium Benefits List */}
                            <View style={styles.benefitsList}>
                                <Text style={styles.benefitItem}>♾️ {t('app.benefit_unlimited', 'Unlimited Scans')}</Text>
                                <Text style={styles.benefitItem}>✨ {t('app.benefit_astro', 'Pet Astrology Charts')}</Text>
                                <Text style={styles.benefitItem}>📄 {t('app.benefit_report', 'Monthly Psychology Report')}</Text>
                                <Text style={styles.benefitItem}>🚫 {t('app.benefit_adfree', 'No Watermarks')}</Text>
                            </View>

                            <TouchableOpacity style={styles.premiumBtn} onPress={() => handlePurchase(IAP_PRODUCTS.PREMIUM_UNLIMITED)}>
                                <Text style={styles.premiumBtnText}>👑 {t('app.subscribe_now', 'Subscribe Now')}</Text>
                                <Text style={styles.premiumPrice}>{subscriptions.find(p => p.id === IAP_PRODUCTS.PREMIUM_UNLIMITED)?.displayPrice || '$4.99/mo'}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    centerContainer: { flex: 1, backgroundColor: '#0A001A', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFD700', fontSize: 32, fontWeight: '900', marginBottom: 20, marginTop: 40, textShadowColor: '#FF007F', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
    card: { backgroundColor: '#1A0B2E', padding: 20, borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: '#FF007F' },
    cardTitle: { color: '#FF007F', fontSize: 22, fontWeight: '900', marginBottom: 15 },
    creditRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a3b5e' },
    creditLabel: { color: '#ccc', fontSize: 16 },
    creditValue: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },

    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: '#1A0B2E', borderRadius: 10, marginBottom: 20, padding: 5, borderWidth: 1, borderColor: '#FF007F' },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#FF007F' },
    tabText: { color: '#FF007F', fontWeight: 'bold', fontSize: 16 },
    activeTabText: { color: 'white' },

    // Purchase Styles
    purchaseContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2a3b5e' },
    purchaseTitle: { color: '#FF007F', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    purchaseBtn: { backgroundColor: '#2a3b5e', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    popularBtn: { backgroundColor: '#6A4C93', borderWidth: 1, borderColor: '#FF007F' },
    purchaseBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    purchasePrice: { color: '#FFD700', fontWeight: 'bold' },
    premiumBtn: { backgroundColor: '#FF007F', padding: 15, borderRadius: 10, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#FF007F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
    premiumBtnText: { color: 'white', fontWeight: '900', fontSize: 16 },
    premiumPrice: { color: 'white', fontWeight: 'bold' },
    premiumActiveBox: { backgroundColor: 'rgba(255, 215, 0, 0.2)', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' },
    premiumActiveText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },

    // Subscriptions
    subscriptionContainer: { marginTop: 10 },
    benefitsList: { marginVertical: 15, paddingHorizontal: 10, gap: 10 },
    benefitItem: { color: 'white', fontSize: 15, marginBottom: 8 },

    sectionTitle: { color: '#6A4C93', fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center' },
    scanCard: { backgroundColor: '#1A0B2E', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    scanMood: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    scanDate: { color: '#6A4C93', fontSize: 12, marginBottom: 10 },
    scanStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
    scanStatText: { color: '#FF007F', fontSize: 13, fontWeight: '600', width: '48%', marginBottom: 5 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(10, 0, 26, 0.8)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '85%', backgroundColor: '#1A0B2E', borderRadius: 20, padding: 25, alignItems: 'center', borderColor: '#FF007F', borderWidth: 2, shadowColor: '#FFD700', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 15 },
    modalTitle: { color: '#FFD700', fontSize: 24, fontWeight: '900', marginBottom: 15, textAlign: 'center' },
    modalMessage: { color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 25, lineHeight: 24 },
    modalCloseBtn: { backgroundColor: '#FF007F', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 25 },
    btnText: { color: 'white', fontWeight: '900', fontSize: 16 }
});
