import React, { useState, useEffect, useCallback } from 'react';
import { 
    StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
    FlatList, Image, ActivityIndicator, RefreshControl 
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Pet {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    gender: string;
    image_url: string | null;
    is_searching: boolean;
}

export default function MyPetsScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [pets, setPets] = useState<Pet[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchPets = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('pets')
                .select('*')
                .eq('owner_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPets(data || []);
        } catch (error: any) {
            console.error('[MyPets] Error:', error.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchPets();
        }, [fetchPets])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPets();
        setRefreshing(false);
    };

    const renderPetItem = ({ item }: { item: Pet }) => (
        <TouchableOpacity 
            style={styles.petCard}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('PetDetails', { pet: item });
            }}
        >
            <View style={styles.petInfo}>
                <View style={styles.imageContainer}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.petImage} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Ionicons name={item.species === 'dog' ? 'paw' : 'logo-octocat'} size={30} color="#6A4C93" />
                        </View>
                    )}
                </View>
                <View style={styles.details}>
                    <Text style={styles.petName}>{item.name}</Text>
                    <Text style={styles.petBreed}>{item.breed || t('app.unknown_breed')}</Text>
                    <View style={styles.badgeRow}>
                        <View style={[styles.genderBadge, { backgroundColor: item.gender === 'male' ? '#4285F422' : '#FF007F22' }]}>
                            <Ionicons 
                                name={item.gender === 'male' ? 'male' : 'female'} 
                                size={12} 
                                color={item.gender === 'male' ? '#4285F4' : '#FF007F'} 
                            />
                            <Text style={[styles.badgeText, { color: item.gender === 'male' ? '#4285F4' : '#FF007F' }]}>
                                {item.gender.toUpperCase()}
                            </Text>
                        </View>
                        {item.is_searching && (
                            <View style={styles.searchingBadge}>
                                <Text style={styles.searchingText}>PAWMATCH ON</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#2D005A" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('app.my_pets', 'My Pets')}</Text>
                <TouchableOpacity 
                    style={styles.addBtn}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        navigation.navigate('AddPet');
                    }}
                >
                    <Ionicons name="add" size={28} color="#FFD700" />
                </TouchableOpacity>
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF007F" />
                </View>
            ) : (
                <FlatList
                    data={pets}
                    keyExtractor={(item) => item.id}
                    renderItem={renderPetItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF007F" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="paw-off" size={80} color="#1A0B2E" />
                            <Text style={styles.emptyTitle}>{t('app.no_pets_yet', 'No pets added')}</Text>
                            <Text style={styles.emptyDesc}>
                                {t('app.no_pets_desc', 'Add your pets to start tracking their health and finding matches.')}
                            </Text>
                            <TouchableOpacity 
                                style={styles.createBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    navigation.navigate('AddPet');
                                }}
                            >
                                <Text style={styles.createBtnText}>{t('app.add_first_pet', 'Add My First Pet')}</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A001A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#1A0B2E',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFD700',
        textTransform: 'uppercase',
    },
    addBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    listContent: {
        padding: 20,
        paddingBottom: 40,
    },
    petCard: {
        backgroundColor: '#15002C',
        borderRadius: 25,
        padding: 15,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    petInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    imageContainer: {
        width: 70,
        height: 70,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0A001A',
        borderWidth: 2,
        borderColor: '#2D005A',
    },
    petImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    details: {
        marginLeft: 15,
    },
    petName: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
    },
    petBreed: {
        color: '#6A4C93',
        fontSize: 14,
        marginBottom: 5,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 8,
    },
    genderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        gap: 4,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '900',
    },
    searchingBadge: {
        backgroundColor: '#FFD70022',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    searchingText: {
        color: '#FFD700',
        fontSize: 8,
        fontWeight: '900',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
        marginTop: 20,
        textTransform: 'uppercase',
    },
    emptyDesc: {
        color: '#6A4C93',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    },
    createBtn: {
        marginTop: 30,
        backgroundColor: '#FF007F',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 20,
    },
    createBtnText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 16,
    }
});
