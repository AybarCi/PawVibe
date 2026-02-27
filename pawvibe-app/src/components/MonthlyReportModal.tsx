import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface MonthlyReportModalProps {
    visible: boolean;
    onClose: () => void;
    isPremiumUser: boolean;
}

export default function MonthlyReportModal({ visible, onClose, isPremiumUser }: MonthlyReportModalProps) {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState<any>(null);
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
        if (visible) {
            generateMonthlyReport();
        } else {
            // Reset state when closed
            setReportData(null);
            setError(null);
        }
    }, [visible]);

    const generateMonthlyReport = async () => {
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
            const currentMonthYear = new Date().toISOString().slice(0, 7); // e.g., '2026-02'
            const { data, error: functionError } = await supabase.functions.invoke('generate-monthly-report', {
                body: {
                    currentMonthYear,
                    language: i18n.language // Pass active language
                },
            });

            if (functionError) throw functionError;

            // the edge function returns { data: { title: "...", ... } }
            if (data?.error) {
                throw new Error(data.error);
            }

            setReportData(data?.data);
        } catch (err: any) {
            console.error('Error generating monthly report:', err);
            setError(err.message || 'Failed to generate monthly report');
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
                        <Text style={styles.modalTitle}>📄 {t('app.generate_monthly_report', 'Monthly Report')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="white" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.contentContainer}>
                            <ActivityIndicator size="large" color="#FF007F" />
                            <Text style={styles.loadingText}>{t('app.preparing_report', 'Analyzing 30 days of behavior...')}</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.contentContainer}>
                            <Ionicons name="alert-circle-outline" size={48} color="#FF4B4B" style={{ marginBottom: 10 }} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : reportData ? (
                        <ScrollView style={{ width: '100%', marginTop: 20 }} showsVerticalScrollIndicator={false}>
                            <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={{ backgroundColor: '#1A0B2E', padding: 15, borderRadius: 10 }}>
                                <View style={{ alignItems: 'center', marginBottom: 15 }}>
                                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#FF007F' }}>📚 PawVibe Monthly Report</Text>
                                </View>

                                <Text style={styles.reportMainTitle}>{reportData.title}</Text>

                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>📋 {t('app.executive_summary', 'Executive Summary')}</Text>
                                    <Text style={styles.cardText}>{reportData.executive_summary}</Text>
                                </View>

                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>🧠 {t('app.behavioral_analysis', 'Behavioral Analysis')}</Text>
                                    <Text style={styles.cardText}>{reportData.behavioral_analysis}</Text>
                                </View>

                                <View style={styles.highlightCard}>
                                    <Text style={styles.highlightTitle}>💡 {t('app.doctor_advice', 'Doctor\'s Advice')}</Text>
                                    <Text style={styles.highlightText}>{reportData.recommendation_for_owner}</Text>
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
        shadowColor: '#FF007F',
        shadowOffset: {
            width: 0,
            height: 0,
        },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#FF007F',
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
        fontSize: 22,
        fontWeight: '900',
        color: '#FF007F',
    },
    closeButton: {
        padding: 5,
    },
    reportMainTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFD700',
        textAlign: 'center',
        marginBottom: 20,
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
    },
    contentContainer: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        color: '#FF007F',
        marginTop: 20,
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
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
        marginBottom: 15,
        borderLeftWidth: 4,
        borderLeftColor: '#FF007F',
        width: '100%',
    },
    cardTitle: {
        color: '#FFD700',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    cardText: {
        color: 'white',
        fontSize: 15,
        lineHeight: 22,
    },
    highlightCard: {
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        padding: 20,
        borderRadius: 15,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#FFD700',
        width: '100%',
    },
    highlightTitle: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    highlightText: {
        color: 'white',
        fontSize: 15,
        lineHeight: 22,
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
        borderColor: '#FF007F',
    },
    shareBtnText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
