import React, { useState, useEffect, useCallback } from 'react';
import { 
    StyleSheet, Text, View, TouchableOpacity, 
    FlatList, Image, ActivityIndicator, RefreshControl, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Match {
    id: string;
    target_pet: {
        id: string;
        name: string;
        image_url: string | null;
        breed: string | null;
    };
    last_message?: string;
}

export default function MatchesListScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [matches, setMatches] = useState<Match[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const fetchMatches = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get user's pets
            const { data: myPets } = await supabase.from('pets').select('id').eq('owner_id', user.id);
            const myPetIds = myPets?.map(p => p.id) || [];

            if (myPetIds.length === 0) {
                setMatches([]);
                return;
            }

            // 2. Fetch matches where my pet is the "sender"
            // Since every match has two rows (A->B and B->A), 
            // fetching only one direction prevents duplicates.
            const { data, error } = await supabase
                .from('matches')
                .select(`
                    id,
                    pet_from,
                    pet_to,
                    status,
                    target_pet: pets!matches_pet_to_fkey (id, name, image_url, breed)
                `)
                .eq('status', 'match')
                .in('pet_from', myPetIds);

            if (error) throw error;

            // 3. Format matches
            const formattedMatches: Match[] = (data || []).map(m => ({
                id: m.id,
                target_pet: m.target_pet as any
            }));

            setMatches(formattedMatches);
        } catch (error) {
            console.error('[MatchesList] Error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchMatches();
        }, [fetchMatches])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchMatches();
        setRefreshing(false);
    };

    const renderMatchItem = ({ item }: { item: Match }) => (
        <TouchableOpacity 
            style={styles.matchCard}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Chat', { matchId: item.id, targetPet: item.target_pet });
            }}
        >
            <View style={styles.avatarContainer}>
                {item.target_pet.image_url ? (
                    <Image source={{ uri: item.target_pet.image_url }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Ionicons name="paw" size={24} color="#6A4C93" />
                    </View>
                )}
            </View>
            <View style={styles.details}>
                <Text style={styles.petName}>{item.target_pet.name}</Text>
                <Text style={styles.petBreed}>{item.target_pet.breed || 'Unknown Breed'}</Text>
            </View>
            <Ionicons name="chatbubble-outline" size={22} color="#FF007F" />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('pawmatch.my_matches', 'Matches')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {loading && !refreshing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF007F" />
                </View>
            ) : (
                <FlatList
                    data={matches}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMatchItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF007F" />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="heart-dislike-outline" size={80} color="#1A0B2E" />
                            <Text style={styles.emptyTitle}>{t('pawmatch.no_matches', 'No Matches Yet')}</Text>
                            <Text style={styles.emptyDesc}>Keep swiping! Your pet's soulmate is out there somewhere.</Text>
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
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 10 : 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        color: '#FFD700',
        fontSize: 32,
        fontWeight: '900',
        marginTop: 10,
        marginBottom: 10,
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    listContent: {
        padding: 20,
    },
    matchCard: {
        backgroundColor: '#15002C',
        borderRadius: 20,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    avatarContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FF007F',
        backgroundColor: '#0A001A',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    details: {
        flex: 1,
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
    },
    emptyDesc: {
        color: '#6A4C93',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 20,
    }
});
