import { StyleSheet, Text, View, ActivityIndicator, ScrollView, TouchableOpacity, Platform, Image, Linking, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useIAPContext } from '../context/IAPContext';
import { IAP_PRODUCTS } from '../../lib/iap';
import PawVibeLoader from '../components/PawVibeLoader';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import ConfettiCannon from 'react-native-confetti-cannon';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProfileScreen({ navigation }: any) {
    const { t } = useTranslation();
    const { products, subscriptions, purchasePackage, restorePurchases, lastPurchaseSuccess, clearLastPurchaseSuccess, isPurchasing } = useIAPContext();
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Credits' | 'Subscription'>('Credits');
    const confettiRef = useRef<any>(null);
    const lastProcessedRef = useRef<number>(0);
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const [isRestoring, setIsRestoring] = useState(false);
    const [confettiTrigger, setConfettiTrigger] = useState(0);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            // If user already has email, mark as linked immediately
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

    const fetchProfileData = async (silent = false) => {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.user) return;

        if (!silent) setLoading(true);

        try {
            // Fetch profile credits
            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', currentSession.user.id)
                .maybeSingle();

            if (profileError) {
                console.error('Error fetching profile:', profileError);
                Toast.show({
                    type: 'error',
                    text1: t('app.error', 'Error'),
                    text2: t('app.profile_fetch_error', 'Failed to fetch profile data.'),
                });
            } else if (profileData) {
                setProfile(profileData);
            }
        } catch (e) {
            console.error('Fetch error:', e);
            Toast.show({
                type: 'error',
                text1: t('app.error', 'Error'),
                text2: t('app.profile_fetch_error', 'Failed to fetch profile data.'),
            });
        } finally {
            setLoading(false);
        }
    };

    // Keep track of transaction IDs that have already triggered confetti in this session
    const seenTransactions = useRef(new Set<string>());

    useEffect(() => {
        if (lastPurchaseSuccess?.transactionId && lastPurchaseSuccess?.productId) {
            const txId = lastPurchaseSuccess.transactionId;

            // 1. DEDUP: Check if we already celebrated this EXACT transaction
            if (seenTransactions.current.has(txId)) {
                console.log('[Profile] Success event already seen/celebrated, skipping UI:', txId);
                return;
            }
            
            // Mark as seen immediately to prevent race conditions
            seenTransactions.current.add(txId);

            console.log('[Profile] FINAL FIX: Triggering unique success feedback for:', txId);
            setConfettiTrigger(prev => prev + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Toast.show({
                type: 'success',
                text1: t('app.success', 'Success!'),
                text2: t('app.purchase_success_msg', 'Your purchase was successful!'),
            });

            // Update local state instantly if profile was returned from backend
            if (lastPurchaseSuccess.profile) {
                setProfile(lastPurchaseSuccess.profile);
            }

            // Backup refresh to ensure everything is in sync
            fetchProfileData(true);

            // 2. IMMEDIATE CLEAR: Tell context we consumed this event for this screen instance
            clearLastPurchaseSuccess();
        }
    }, [lastPurchaseSuccess?.transactionId]);

    const handlePurchase = async (productId: string) => {
        Haptics.selectionAsync();
        const item = [...products, ...subscriptions].find((p: any) => p.productId === productId);
        if (!item) {
            console.warn(`[IAP] Product ${productId} not found in fetched products.`);
            console.warn('[IAP] Available products:', products.map((p: any) => p.productId));
            console.warn('[IAP] Available subscriptions:', subscriptions.map((p: any) => p.productId));
            Toast.show({
                type: 'error',
                text1: t('app.error', 'Error'),
                text2: t('app.product_not_found', 'Product not found. Please try again later.'),
            });
            return;
        }

        let offerToken;
        if (Platform.OS === 'android' && 'subscriptionOffers' in item) {
            const sub = item as any;
            offerToken = sub.subscriptionOffers?.[0]?.offerTokenAndroid
                || sub.subscriptionOfferDetailsAndroid?.[0]?.offerToken
                || undefined;
        }

        try {
            // Await so the native payment sheet appears and errors are caught.
            // Success is NOT handled here — it comes through lastPurchaseSuccess listener.
            await purchasePackage(productId, offerToken);
        } catch (err: any) {
            let errorText = t('app.purchase_failed', 'Purchase failed.');
            if (err && err.message && err.message !== 'undefined') {
                errorText = err.message;
            } else if (typeof err === 'string' && err !== 'undefined') {
                errorText = err;
            }
            Toast.show({
                type: 'error',
                text1: t('app.error', 'Error'),
                text2: errorText,
            });
        }
    };

    // Determine current user status from Supabase profile
    const isPremiumUser = profile?.is_premium;

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <PawVibeLoader size={120} />
            </View>
        );
    }

    if (!profile && !loading) {
        return (
            <View style={[styles.centerContainer, { padding: 20 }]}>
                <Ionicons name="person-circle-outline" size={64} color="#FF007F" style={{ marginBottom: 20 }} />
                <Text style={[styles.errorText, { fontSize: 20, textAlign: 'center' }]}>{t('app.profile_not_created')}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{t('app.profile_title')}</Text>
                {profile?.username && (
                    <View style={styles.usernameContainer}>
                        <Text style={styles.usernameText}>@{profile.username}</Text>
                    </View>
                )}
            </View>

            {/* Confetti Cannon - Powered by state trigger to avoid flickering square */}
            {confettiTrigger > 0 && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="none">
                    <ConfettiCannon
                        key={confettiTrigger}
                        count={200}
                        origin={{ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }} // Central explosion
                        fallSpeed={3000}
                        autoStart={true}
                        fadeOut={true}
                        colors={['#FF007F', '#6A4C93', '#FFD700', '#00FFFF']}
                    />
                </View>
            )}

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* <Text style={styles.headerTitle}>{t('app.profile_title')}</Text> */}

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
                {
                    activeTab === 'Credits' && (
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

                            {products.length === 0 ? (
                                <View style={[styles.purchaseContainer, { alignItems: 'center', paddingVertical: 30 }]}>
                                    <ActivityIndicator size="large" color="#FFD700" style={{ marginBottom: 15 }} />
                                    <Text style={{ ...styles.purchaseTitle, marginBottom: 5 }}>{t('app.products_loading', 'Loading Store...')}</Text>
                                    <Text style={{ color: '#aaa', textAlign: 'center', fontSize: 13, paddingHorizontal: 20 }}>
                                        {t('app.products_not_available', 'Products will appear here shortly. Please check your internet connection or try again later.')}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.purchaseContainer}>
                                    <Text style={styles.purchaseTitle}>{t('app.get_more_scans')}</Text>

                                    <TouchableOpacity style={[styles.purchaseBtn, isPurchasing && { opacity: 0.5 }]} disabled={isPurchasing} onPress={() => handlePurchase(IAP_PRODUCTS.SNACK_PACK)}>
                                        <Text style={styles.purchaseBtnText}>🦴 {t('app.snack_pack')}</Text>
                                        <Text style={styles.purchasePrice}>{(products.find((p: any) => p.productId === IAP_PRODUCTS.SNACK_PACK) as any)?.localizedPrice || ''}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.gradientContainer, isPurchasing && { opacity: 0.5 }]} disabled={isPurchasing} onPress={() => handlePurchase(IAP_PRODUCTS.PARTY_PACK)}>
                                        <LinearGradient
                                            colors={['#FF007F', '#6A4C93']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={styles.gradientBtn}
                                        >
                                            <Text style={styles.purchaseBtnText}>🎉 {t('app.party_pack')}</Text>
                                            <Text style={styles.purchasePrice}>{(products.find((p: any) => p.productId === IAP_PRODUCTS.PARTY_PACK) as any)?.localizedPrice || ''}</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    )
                }

                {/* Subscription Section */}
                {
                    activeTab === 'Subscription' && (
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
                                        <View style={styles.benefitItemWrapper}>
                                            <Image source={require('../../assets/icon-unlimited-scans.png')} style={styles.benefitIcon} />
                                            <Text style={styles.benefitItem}>{t('app.benefit_unlimited', 'Unlimited Scans')}</Text>
                                        </View>
                                        <View style={styles.benefitItemWrapper}>
                                            <Image source={require('../../assets/icon-astro-chart.png')} style={styles.benefitIcon} />
                                            <Text style={styles.benefitItem}>{t('app.benefit_astro', 'Pet Astrology Charts')}</Text>
                                        </View>
                                        <View style={styles.benefitItemWrapper}>
                                            <Image source={require('../../assets/icon-monthly-report.png')} style={styles.benefitIcon} />
                                            <Text style={styles.benefitItem}>{t('app.benefit_report', 'Monthly Psychology Report')}</Text>
                                        </View>
                                        <View style={styles.benefitItemWrapper}>
                                            <Image source={require('../../assets/icon-no-watermark.png')} style={styles.benefitIcon} />
                                            <Text style={styles.benefitItem}>{t('app.benefit_adfree', 'No Watermarks')}</Text>
                                        </View>
                                    </View>

                                    {subscriptions.length === 0 ? (
                                        <View style={[styles.purchaseContainer, { alignItems: 'center', paddingVertical: 20 }]}>
                                            <ActivityIndicator size="large" color="#FFD700" style={{ marginBottom: 15 }} />
                                            <Text style={{ ...styles.purchaseTitle, marginBottom: 5, fontSize: 16 }}>{t('app.products_loading', 'Loading Store...')}</Text>
                                            <Text style={{ color: '#aaa', textAlign: 'center', fontSize: 13, paddingHorizontal: 10 }}>
                                                {t('app.products_not_available', 'Products will appear here shortly. Please check your internet connection or try again later.')}
                                            </Text>
                                        </View>
                                    ) : (
                                        <TouchableOpacity style={[styles.gradientContainer, { marginTop: 10 }, isPurchasing && { opacity: 0.5 }]} disabled={isPurchasing} onPress={() => handlePurchase(IAP_PRODUCTS.PREMIUM_UNLIMITED)}>
                                            <LinearGradient
                                                colors={['#FFD700', '#FF8C00']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 1 }}
                                                style={styles.gradientBtn}
                                            >
                                                <Text style={styles.premiumBtnText}>👑 {t('app.subscribe_now', 'Subscribe Now')}</Text>
                                                <Text style={styles.premiumPrice}>{(subscriptions.find((p: any) => p.productId === IAP_PRODUCTS.PREMIUM_UNLIMITED) as any)?.localizedPrice || ''}</Text>
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </View>
                    )
                }

                {/* Account Settings Button */}
                <TouchableOpacity
                    style={{
                        marginTop: 10,
                        marginBottom: 10,
                        alignItems: 'center',
                        paddingVertical: 16,
                        paddingHorizontal: 24,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: '#FFD700',
                        backgroundColor: 'rgba(255, 215, 0, 0.1)',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 10,
                    }}
                    onPress={() => navigation.navigate('Account')}
                >
                    <Ionicons name="settings-outline" size={20} color="#FFD700" />
                    <Text style={{ color: '#FFD700', fontSize: 15, fontWeight: 'bold' }}>
                        {t('app.account_settings', 'Account Settings')}
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color="#FFD700" />
                </TouchableOpacity>

                {/* Restore Purchases Button */}
                <TouchableOpacity
                    style={{
                        marginTop: 20,
                        marginBottom: 10,
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 24,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: 'rgba(106, 76, 147, 0.5)',
                        backgroundColor: 'rgba(26, 11, 46, 0.6)',
                        opacity: isRestoring ? 0.5 : 1,
                        flexDirection: 'row',
                        justifyContent: 'center',
                        gap: 8,
                    }}
                    disabled={isRestoring || isPurchasing}
                    onPress={async () => {
                        Haptics.selectionAsync();
                        setIsRestoring(true);
                        try {
                            const { success, error } = await restorePurchases();
                            if (success) {
                                setConfettiTrigger(prev => prev + 1);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                Toast.show({ type: 'success', text1: t('app.restore_complete'), text2: t('app.restore_success_msg') });
                                fetchProfileData();
                            } else if (error === 'no_purchases') {
                                Toast.show({ type: 'info', text1: t('app.restore_purchases'), text2: t('app.no_purchases_found') });
                            } else if (error === 'already_restored') {
                                Toast.show({ type: 'info', text1: t('app.restore_purchases'), text2: t('app.already_restored') });
                            } else {
                                Toast.show({ type: 'error', text1: t('app.error'), text2: error || t('app.restore_failed') });
                            }
                        } finally {
                            setIsRestoring(false);
                        }
                    }}
                >
                    {isRestoring ? (
                        <ActivityIndicator size="small" color="#6A4C93" />
                    ) : (
                        <>
                            <Ionicons name="refresh-outline" size={18} color="#6A4C93" />
                            <Text style={{ color: '#6A4C93', fontSize: 14, fontWeight: '600' }}>
                                {t('app.restore_purchases', 'Restore Purchases')}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Privacy Policy & Terms of Service */}
                <View style={styles.legalContainer}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://paw-vibe.net/privacy')}>
                        <Text style={styles.legalLink}>{t('app.privacy_policy', 'Privacy Policy')}</Text>
                    </TouchableOpacity>
                    <Text style={styles.legalSeparator}>•</Text>
                    <TouchableOpacity onPress={() => Linking.openURL('https://paw-vibe.net/terms')}>
                        <Text style={styles.legalLink}>{t('app.terms_of_service', 'Terms of Service')}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 10 : 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 32, fontWeight: '900', color: '#fff' },
    usernameContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 0, 127, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15, borderWidth: 1, borderColor: '#FF007F' },
    usernameText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    scrollContent: { padding: 20, paddingBottom: 40 },
    centerContainer: { flex: 1, backgroundColor: '#0A001A', justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFD700', fontSize: 32, fontWeight: '900', marginBottom: 10, marginTop: 10, textShadowColor: '#FF007F', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    errorText: { color: 'white', textAlign: 'center', marginTop: 50 },
    card: { backgroundColor: '#1A0B2E', padding: 20, borderRadius: 15, marginBottom: 30, borderWidth: 1, borderColor: '#FF007F' },
    cardTitle: { color: '#FF007F', fontSize: 22, fontWeight: '900', marginBottom: 15 },
    creditRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a3b5e' },
    creditLabel: { color: '#ccc', fontSize: 16 },
    creditValue: { color: '#FFD700', fontSize: 18, fontWeight: 'bold' },

    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: '#1A0B2E', borderRadius: 10, marginBottom: 20, padding: 5, borderWidth: 1, borderColor: '#FF007F' },
    tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#FF007F', shadowColor: '#FF007F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 4 },
    tabText: { color: '#FF007F', fontWeight: 'bold', fontSize: 16 },
    activeTabText: { color: 'white' },

    // Purchase Styles
    purchaseContainer: { marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#2a3b5e' },
    purchaseTitle: { color: '#FF007F', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    purchaseBtn: { backgroundColor: '#2a3b5e', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    gradientContainer: { marginBottom: 10, borderRadius: 10, overflow: 'hidden', shadowColor: '#FF007F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 },
    gradientBtn: { padding: 15, borderRadius: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    purchaseBtnText: { color: 'white', fontWeight: 'bold', fontSize: 15 },
    purchasePrice: { color: '#FFD700', fontWeight: 'bold' },
    premiumBtnText: { color: 'white', fontWeight: '900', fontSize: 16 },
    premiumPrice: { color: 'white', fontWeight: 'bold' },
    premiumActiveBox: { backgroundColor: 'rgba(255, 215, 0, 0.2)', padding: 15, borderRadius: 10, marginTop: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FFD700' },
    premiumActiveText: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },

    // Subscriptions
    subscriptionContainer: { marginTop: 10 },
    benefitsList: { marginVertical: 15, paddingHorizontal: 10, gap: 10 },
    benefitItemWrapper: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    benefitIcon: { width: 50, height: 50, marginRight: 15, borderRadius: 5 },
    benefitItem: { color: 'white', fontSize: 16 },

    sectionTitle: { color: '#6A4C93', fontSize: 24, fontWeight: 'bold', marginBottom: 15 },
    emptyText: { color: '#888', fontStyle: 'italic', textAlign: 'center' },
    scanCard: { backgroundColor: '#1A0B2E', padding: 15, borderRadius: 10, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
    scanMood: { color: 'white', fontSize: 20, fontWeight: 'bold' },
    scanDate: { color: '#6A4C93', fontSize: 12, marginBottom: 10 },
    scanStats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
    scanStatText: { color: '#FF007F', fontSize: 13, fontWeight: '600', width: '48%', marginBottom: 5 },

    // Legal Links
    legalContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25, marginBottom: 10, gap: 8 },
    legalLink: { color: '#6A4C93', fontSize: 13, textDecorationLine: 'underline' },
    legalSeparator: { color: '#6A4C93', fontSize: 13 },
});
