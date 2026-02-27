import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface AstroModalProps {
    visible: boolean;
    onClose: () => void;
    scanId: string | null;
    isPremiumUser: boolean;
}

export default function AstroModal({ visible, onClose, scanId, isPremiumUser }: AstroModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [astroData, setAstroData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const viewShotRef = useRef<any>(null);

    const captureAndShare = async () => {
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                const isAvailable = await Sharing.isAvailableAsync();
                if (isAvailable) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert(t('app.error', 'Error'), 'Sharing is not supported on this device.');
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert(t('app.error', 'Error'), 'Could not share image.');
        }
    };

    React.useEffect(() => {
        if (visible && scanId) {
            generateAstroChart();
        } else {
            // Reset state when closed
            setAstroData(null);
            setError(null);
        }
    }, [visible, scanId]);

    const generateAstroChart = async () => {
        if (!isPremiumUser) {
            setError(t('app.premium_required', 'Premium is required for this feature.'));
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No active session');

            // Invoke edge function
            const { data, error: functionError } = await supabase.functions.invoke('generate-pet-astrology', {
                body: {
                    scanId,
                    language: i18n.language // Pass active language 
                },
            });

            if (functionError) throw functionError;

            // the edge function returns { data: { sun_sign: "...", ... } }
            setAstroData(data?.data);
        } catch (err: any) {
            console.error('Error generating astro chart:', err);
            setError(err.message || 'Failed to generate astrology chart');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                <View style={[styles.modalView, { width: '90%', maxHeight: '80%' }]}>

                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>✨ {t('app.astro_chart', 'Astro Chart')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.contentContainer}>
                            <ActivityIndicator size="large" color="#FFD700" />
                            <Text style={styles.loadingText}>{t('app.consulting_stars', 'Consulting the stars...')}</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.contentContainer}>
                            <Ionicons name="alert-circle-outline" size={48} color="#FF4B4B" style={{ marginBottom: 10 }} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : astroData ? (
                        <ScrollView style={{ width: '100%', marginTop: 20 }} showsVerticalScrollIndicator={false}>
                            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ backgroundColor: '#1A0B2E', padding: 10, borderRadius: 10 }}>
                                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FFD700' }}>✨ PawVibe Astro ✨</Text>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.signLabel}>☀️ {t('app.sun_sign', 'Sun Sign')}</Text>
                                    <Text style={styles.signValue}>{astroData.sun_sign}</Text>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.signLabel}>🌙 {t('app.moon_sign', 'Moon Sign')}</Text>
                                    <Text style={styles.signValue}>{astroData.moon_sign}</Text>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.signLabel}>⬆️ {t('app.rising_sign', 'Rising Sign')}</Text>
                                    <Text style={styles.signValue}>{astroData.rising_sign}</Text>
                                </View>

                                <View style={styles.horoscopeCard}>
                                    <Text style={styles.horoscopeTitle}>🔮 {t('app.horoscope', 'Daily Horoscope')}</Text>
                                    <Text style={styles.horoscopeText}>{astroData.horoscope}</Text>
                                </View>
                            </ViewShot>

                            <TouchableOpacity style={styles.shareBtn} onPress={captureAndShare}>
                                <Ionicons name="share-social-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.shareBtnText}>{t('app.share', 'Share')} 🚀</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    ) : null}

                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(10, 0, 26, 0.9)',
    },
    modalView: {
        backgroundColor: '#1A0B2E',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#FFD700',
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
        borderBottomWidth: 1,
        borderBottomColor: '#2a3b5e',
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFD700',
    },
    closeButton: {
        padding: 5,
    },
    contentContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#FFD700',
        marginTop: 20,
        fontSize: 16,
        fontStyle: 'italic',
    },
    errorText: {
        color: '#FF4B4B',
        textAlign: 'center',
        fontSize: 16,
    },
    card: {
        backgroundColor: '#2a3b5e',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#FFD700',
        width: '100%',
    },
    signLabel: {
        color: '#ccc',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    signValue: {
        color: 'white',
        fontSize: 18,
    },
    horoscopeCard: {
        backgroundColor: 'rgba(255, 0, 127, 0.1)',
        padding: 20,
        borderRadius: 15,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#FF007F',
        width: '100%',
    },
    horoscopeTitle: {
        color: '#FF007F',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    horoscopeText: {
        color: 'white',
        fontSize: 16,
        lineHeight: 24,
        fontStyle: 'italic',
    },
    shareBtn: {
        backgroundColor: '#6A4C93',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    shareBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
