import React, { useState } from 'react';
import { 
    StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
    Image, ScrollView, Alert, ActivityIndicator, Dimensions,
    Switch
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function PetDetailsScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { pet: initialPet } = route.params;
    const [pet, setPet] = useState(initialPet);
    const [loading, setLoading] = useState(false);
    const [statusLoading, setStatusLoading] = useState(false);

    const toggleStatus = async () => {
        try {
            setStatusLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not found');

            console.log('[DEBUG] Current User ID:', user.id);
            console.log('[DEBUG] Pet Owner ID:', pet.owner_id);
            console.log('[DEBUG] Pet ID:', pet.id);

            const newStatus = !pet.is_searching;
            const { error, data } = await supabase
                .from('pets')
                .update({ is_searching: newStatus })
                .eq('id', pet.id)
                .eq('owner_id', user.id)
                .select();

            if (error) {
                console.error('[DEBUG] Update Failed Error:', error);
                console.error('[DEBUG] Update Error Message:', error.message);
                console.error('[DEBUG] Update Error Details:', error.details);
                console.error('[DEBUG] Update Error Hint:', error.hint);
                throw error;
            }

            console.log('[DEBUG] Update Success, Data:', data);
            
            setPet({ ...pet, is_searching: newStatus });
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setStatusLoading(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            t('app.delete_pet_confirm_title', 'Delete Pet?'),
            t('app.delete_pet_confirm_desc', 'Are you sure you want to delete this pet profile? This cannot be undone.'),
            [
                { text: t('app.cancel_btn', 'Cancel'), style: 'cancel' },
                { 
                    text: t('app.delete_confirm_btn', 'Delete'), 
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('pets')
                                .delete()
                                .eq('id', pet.id);

                            if (error) throw error;
                            
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            navigation.goBack();
                        } catch (error: any) {
                            Alert.alert('Error', error.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const calculateAge = (birthDate: string) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    return (
        <View style={styles.container}>
            {/* Fixed Header Overlay */}
            <SafeAreaView style={styles.fixedHeader}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
            </SafeAreaView>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    {pet.image_url ? (
                        <Image source={{ uri: pet.image_url }} style={styles.image} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Ionicons name={pet.species === 'dog' ? 'paw' : 'logo-octocat'} size={80} color="#2D005A" />
                        </View>
                    )}
                    <LinearGradient 
                        colors={['rgba(10,0,26,0.6)', 'transparent', 'rgba(10,0,26,1)']} 
                        style={styles.gradient} 
                    />
                    
                    <View style={styles.heroInfo}>
                        <Text style={styles.name}>{pet.name}</Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.genderBadge, { backgroundColor: pet.gender === 'male' ? '#4285F4' : '#FF007F' }]}>
                                <Ionicons 
                                    name={pet.gender === 'male' ? 'male' : 'female'} 
                                    size={14} 
                                    color="white" 
                                />
                                <Text style={styles.badgeText}>{pet.gender.toUpperCase()}</Text>
                            </View>
                            <View style={styles.speciesBadge}>
                                <Text style={styles.badgeText}>{pet.species.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Details Section */}
                <View style={styles.content}>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>{t('app.breed', 'BREED')}</Text>
                            <Text style={styles.infoValue}>{pet.breed || t('app.unknown_breed', 'Unknown')}</Text>
                        </View>
                        <View style={styles.infoCard}>
                            <Text style={styles.infoLabel}>{t('app.age', 'AGE')}</Text>
                            <Text style={styles.infoValue}>{calculateAge(pet.birth_date)} {t('app.years_old', 'Years')}</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{t('app.status', 'STATUS')}</Text>
                            {statusLoading && <ActivityIndicator size="small" color="#FFD700" />}
                        </View>
                        <View style={styles.statusBox}>
                            <MaterialCommunityIcons 
                                name={pet.is_searching ? "heart-multiple" : "heart-off"} 
                                size={24} 
                                color={pet.is_searching ? "#FFD700" : "#6A4C93"} 
                            />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.statusTitle, { color: pet.is_searching ? "#FFD700" : "#6A4C93" }]}>
                                    {pet.is_searching ? "PAWMATCH ACTIVE" : "PAWMATCH INACTIVE"}
                                </Text>
                                <Text style={styles.statusDesc}>
                                    {pet.is_searching 
                                        ? "This pet is visible to local owners for matching." 
                                        : "This pet is currently hidden from discovery."}
                                </Text>
                            </View>
                            <Switch
                                value={pet.is_searching}
                                onValueChange={toggleStatus}
                                trackColor={{ false: '#1A0B2E', true: '#FFD700' }}
                                thumbColor={pet.is_searching ? '#FFF' : '#6A4C93'}
                                ios_backgroundColor="#1A0B2E"
                            />
                        </View>
                    </View>

                    {/* Danger Zone */}
                    <View style={[styles.section, { marginTop: 40 }]}>
                        <TouchableOpacity 
                            style={styles.deleteBtn} 
                            onPress={handleDelete}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <>
                                    <Ionicons name="trash-outline" size={20} color="white" />
                                    <Text style={styles.deleteBtnText}>{t('app.delete_pet', 'Delete Pet Profile')}</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <Text style={styles.dangerNote}>
                            {t('app.delete_pet_note', 'This action will permanently remove this pet profile from your account and all associated matches.')}
                        </Text>
                    </View>
                </View>

                <View style={{ height: 50 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A001A',
    },
    imageContainer: {
        width: width,
        height: width * 1.2,
        backgroundColor: '#1A0B2E',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    fixedHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    backBtn: {
        width: 45,
        height: 45,
        borderRadius: 23,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 20,
        marginTop: 10,
    },
    heroInfo: {
        position: 'absolute',
        bottom: 30,
        left: 25,
        right: 25,
    },
    name: {
        fontSize: 36,
        fontWeight: '900',
        color: 'white',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 10,
    },
    genderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
    },
    speciesBadge: {
        backgroundColor: '#2D005A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    badgeText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '900',
    },
    content: {
        padding: 25,
    },
    infoGrid: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 30,
    },
    infoCard: {
        flex: 1,
        backgroundColor: '#15002C',
        padding: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    infoLabel: {
        color: '#6A4C93',
        fontSize: 10,
        fontWeight: '900',
        marginBottom: 5,
    },
    infoValue: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    section: {
        marginBottom: 25,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    statusBox: {
        flexDirection: 'row',
        backgroundColor: '#15002C',
        padding: 20,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#2D005A',
        alignItems: 'center',
        gap: 15,
    },
    statusTitle: {
        fontSize: 14,
        fontWeight: '900',
    },
    statusDesc: {
        color: '#6A4C93',
        fontSize: 12,
        marginTop: 2,
        lineHeight: 18,
    },
    deleteBtn: {
        backgroundColor: '#FF0033',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        borderRadius: 20,
        gap: 10,
    },
    deleteBtnText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
    },
    dangerNote: {
        color: '#444',
        fontSize: 11,
        textAlign: 'center',
        marginTop: 15,
        paddingHorizontal: 20,
    }
});
