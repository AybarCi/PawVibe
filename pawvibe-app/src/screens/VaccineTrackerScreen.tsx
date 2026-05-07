import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    TouchableOpacity,
    FlatList,
    Modal,
    TextInput,
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    Image,
    RefreshControl
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Vaccination {
    id: string;
    pet_name: string;
    vaccine_name: string;
    date_administered: string;
    next_due_date: string | null;
    is_completed: boolean;
    notes: string | null;
}

export default function VaccineTrackerScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const [isGuest, setIsGuest] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    
    // Form States
    const [petName, setPetName] = useState('');
    const [vaccineName, setVaccineName] = useState('');
    const [dateAdministered, setDateAdministered] = useState(new Date());
    const [nextDueDate, setNextDueDate] = useState<Date | null>(null);
    const [notes, setNotes] = useState('');
    
    // Picker States
    const [showAdminPicker, setShowAdminPicker] = useState(false);
    const [showDuePicker, setShowDuePicker] = useState(false);

    const fetchVaccinations = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check if user is guest (no email/identity linked)
            setIsGuest(!user.email);

            // Fetch profile for premium status
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', user.id)
                .single();
            
            setIsPremium(profile?.is_premium || false);

            const { data, error } = await supabase
                .from('vaccinations')
                .select('*')
                .eq('user_id', user.id)
                .order('date_administered', { ascending: false });

            if (error) throw error;
            setVaccinations(data || []);
        } catch (error: any) {
            console.error('Error fetching vaccinations:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchVaccinations();
        setRefreshing(false);
    }, [fetchVaccinations]);

    useFocusEffect(
        useCallback(() => {
            fetchVaccinations();
        }, [fetchVaccinations])
    );

    const handleAddVaccine = async () => {
        if (!petName || !vaccineName) {
            Alert.alert(t('app.error'), t('app.fill_all_fields', 'Please fill pet name and vaccine name'));
            return;
        }

        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('vaccinations')
                .insert([{
                    user_id: user.id,
                    pet_name: petName,
                    vaccine_name: vaccineName,
                    date_administered: dateAdministered.toISOString().split('T')[0],
                    next_due_date: nextDueDate ? nextDueDate.toISOString().split('T')[0] : null,
                    notes: notes || null,
                    is_completed: true
                }]);

            if (error) throw error;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setIsModalVisible(false);
            resetForm();
            fetchVaccinations();
        } catch (error: any) {
            Alert.alert(t('app.error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const deleteVaccine = async (id: string) => {
        Alert.alert(
            t('app.delete_confirm_title', 'Delete?'),
            t('app.delete_vaccine_confirm', 'Are you sure you want to delete this record?'),
            [
                { text: t('app.cancel_btn'), style: 'cancel' },
                {
                    text: t('app.delete_confirm_btn'),
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('vaccinations')
                            .delete()
                            .eq('id', id);
                        if (!error) {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            fetchVaccinations();
                        }
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setPetName('');
        setVaccineName('');
        setDateAdministered(new Date());
        setNextDueDate(null);
        setNotes('');
    };

    const renderVaccineItem = ({ item }: { item: Vaccination }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.petName}>{item.pet_name}</Text>
                    <Text style={styles.vaccineName}>{item.vaccine_name}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteVaccine(item.id)}>
                    <Ionicons name="trash-outline" size={20} color="#FF007F" />
                </TouchableOpacity>
            </View>
            
            <View style={styles.cardFooter}>
                <View style={styles.dateBox}>
                    <Text style={styles.dateLabel}>{t('app.last_dose')}</Text>
                    <Text style={styles.dateValue}>{item.date_administered}</Text>
                </View>
                {item.next_due_date && (
                    <View style={styles.dateBox}>
                        <Text style={[styles.dateLabel, { color: '#00FFFF' }]}>{t('app.next_dose')}</Text>
                        <Text style={[styles.dateValue, { color: '#00FFFF' }]}>{item.next_due_date}</Text>
                    </View>
                )}
            </View>
            {item.notes && <Text style={styles.notesText}>{item.notes}</Text>}
        </View>
    );

    const handleOpenModal = () => {
        if (isGuest) {
            Alert.alert(
                t('app.auth_required_title'),
                t('app.auth_required_msg'),
                [
                    { text: t('app.cancel_btn'), style: 'cancel' },
                    { text: t('app.go_to_profile'), onPress: () => navigation.navigate('Profile') }
                ]
            );
            return;
        }

        if (!isPremium && vaccinations.length >= 3) {
            Alert.alert(
                t('app.vaccine_limit_reached'),
                t('app.vaccine_limit_msg'),
                [
                    { text: t('app.cancel_btn'), style: 'cancel' },
                    { text: t('app.go_premium'), onPress: () => navigation.navigate('Profile') }
                ]
            );
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('app.vaccine_tracker_title')}</Text>
                <TouchableOpacity 
                    style={styles.addButton} 
                    onPress={handleOpenModal}
                >
                    <Ionicons name="add-circle" size={32} color="#FF007F" />
                </TouchableOpacity>
            </View>

            {loading && vaccinations.length === 0 ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF007F" />
                </View>
            ) : (
                <FlatList
                    data={vaccinations}
                    keyExtractor={(item) => item.id}
                    renderItem={renderVaccineItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl 
                            refreshing={refreshing} 
                            onRefresh={onRefresh} 
                            tintColor="#FF007F" 
                            colors={["#FF007F"]} 
                        />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="needle" size={64} color="rgba(255, 255, 255, 0.1)" />
                            <Text style={styles.emptyText}>{t('app.no_vaccines')}</Text>
                        </View>
                    }
                />
            )}

            {/* Add Vaccine Modal */}
            <Modal visible={isModalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('app.add_vaccine')}</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <Ionicons name="close" size={28} color="white" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.form}>
                            <Text style={styles.inputLabel}>{t('app.pet_name')}</Text>
                            <TextInput
                                style={styles.input}
                                value={petName}
                                onChangeText={setPetName}
                                placeholder="e.g. Pamuk"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />

                            <Text style={styles.inputLabel}>{t('app.vaccine_name')}</Text>
                            <TextInput
                                style={styles.input}
                                value={vaccineName}
                                onChangeText={setVaccineName}
                                placeholder="e.g. Karma Aşı"
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />

                            <View style={styles.dateRow}>
                                <View style={styles.datePickerBtnContainer}>
                                    <Text style={styles.inputLabel}>{t('app.date_administered')}</Text>
                                    <TouchableOpacity 
                                        style={styles.datePickerBtn} 
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setShowAdminPicker(true);
                                        }}
                                    >
                                        <Ionicons name="calendar-outline" size={18} color="#FF007F" style={{ marginRight: 8 }} />
                                        <Text style={styles.dateText}>{dateAdministered.toLocaleDateString()}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.datePickerBtnContainer}>
                                    <Text style={[styles.inputLabel, { color: '#00FFFF' }]}>{t('app.next_dose')}</Text>
                                    <TouchableOpacity 
                                        style={[styles.datePickerBtn, { borderColor: 'rgba(0, 255, 255, 0.3)' }]} 
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            setShowDuePicker(true);
                                        }}
                                    >
                                        <Ionicons name="notifications-outline" size={18} color="#00FFFF" style={{ marginRight: 8 }} />
                                        <Text style={[styles.dateText, { color: '#00FFFF' }]}>
                                            {nextDueDate ? nextDueDate.toLocaleDateString() : t('app.select_date')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>{t('app.notes', 'Notes')}</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                value={notes}
                                onChangeText={setNotes}
                                multiline
                                placeholder="..."
                                placeholderTextColor="rgba(255,255,255,0.3)"
                            />

                            <TouchableOpacity style={styles.saveBtn} onPress={handleAddVaccine}>
                                <LinearGradient colors={['#FF007F', '#6A4C93']} style={styles.saveBtnGradient}>
                                    <Text style={styles.saveBtnText}>{t('app.save_vaccine')}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>

                        {/* iOS Specific Date Picker Modal */}
                        <Modal visible={Platform.OS === 'ios' && (showAdminPicker || showDuePicker)} transparent animationType="slide">
                            <View style={styles.pickerModalOverlay}>
                                <View style={styles.pickerModalContent}>
                                    <Text style={styles.pickerTitle}>
                                        {showAdminPicker ? t('app.date_administered') : t('app.next_dose')}
                                    </Text>
                                    <DateTimePicker
                                        value={showAdminPicker ? dateAdministered : (nextDueDate || new Date())}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        themeVariant="dark"
                                        textColor="white"
                                        style={{ height: 200, width: '100%' }}
                                        onChange={(event, date) => {
                                            if (date) {
                                                if (showAdminPicker) setDateAdministered(date);
                                                else setNextDueDate(date);
                                            }
                                        }}
                                    />
                                    <TouchableOpacity 
                                        style={styles.doneBtn} 
                                        onPress={() => {
                                            setShowAdminPicker(false);
                                            setShowDuePicker(false);
                                        }}
                                    >
                                        <Text style={styles.doneBtnText}>Tamam</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Modal>

                        {/* Android Specific Date Picker */}
                        {Platform.OS === 'android' && showAdminPicker && (
                            <DateTimePicker
                                value={dateAdministered}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowAdminPicker(false);
                                    if (date) setDateAdministered(date);
                                }}
                            />
                        )}

                        {Platform.OS === 'android' && showDuePicker && (
                            <DateTimePicker
                                value={nextDueDate || new Date()}
                                mode="date"
                                display="default"
                                onChange={(event, date) => {
                                    setShowDuePicker(false);
                                    if (date) setNextDueDate(date);
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    header: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 0, 127, 0.2)'
    },
    title: { color: '#FFD700', fontSize: 24, fontWeight: '900', textShadowColor: '#FF007F', textShadowRadius: 10 },
    addButton: { padding: 5 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContent: { padding: 20 },
    card: {
        backgroundColor: '#1A0B2E',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    petName: { color: '#00FFFF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
    vaccineName: { color: 'white', fontSize: 18, fontWeight: '900' },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
    dateBox: { flex: 1 },
    dateLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 'bold' },
    dateValue: { color: 'white', fontSize: 14, fontWeight: 'bold', marginTop: 2 },
    notesText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 10, fontStyle: 'italic' },
    emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
    emptyText: { color: 'rgba(255,255,255,0.3)', fontSize: 16, marginTop: 10, fontWeight: 'bold' },
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { 
        backgroundColor: '#1A0B2E', 
        borderTopLeftRadius: 30, 
        borderTopRightRadius: 30, 
        padding: 20, 
        height: '80%',
        borderWidth: 1,
        borderColor: '#FF007F',
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#FFD700', fontSize: 22, fontWeight: '900' },
    form: { flex: 1 },
    inputLabel: { color: 'white', fontSize: 12, fontWeight: 'bold', marginBottom: 5, opacity: 0.8 },
    input: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 12,
        color: 'white',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)'
    },
    dateRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    datePickerBtnContainer: { flex: 0.48 },
    datePickerBtn: { 
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 10,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 127, 0.3)',
        marginTop: 5
    },
    dateText: { color: 'white', fontSize: 14, fontWeight: 'bold' },
    saveBtn: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
    saveBtnGradient: { padding: 15, alignItems: 'center' },
    saveBtnText: { color: 'white', fontSize: 18, fontWeight: '900' },
    doneBtn: { 
        backgroundColor: '#FF007F', 
        padding: 12, 
        borderRadius: 10, 
        alignItems: 'center', 
        marginTop: 10 
    },
    doneBtnText: { color: 'white', fontWeight: 'bold' },
    pickerModalOverlay: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    pickerModalContent: {
        backgroundColor: '#1A0B2E',
        borderRadius: 25,
        padding: 20,
        width: '95%',
        borderWidth: 1,
        borderColor: '#FF007F',
        alignItems: 'center'
    },
    pickerTitle: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15
    }
});
