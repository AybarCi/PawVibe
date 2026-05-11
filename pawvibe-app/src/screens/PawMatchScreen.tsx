import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import PawMatchGate from '../components/PawMatchGate';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function PawMatchScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [isPremium, setIsPremium] = useState(false);
    const [isAnonymous, setIsAnonymous] = useState(true);

    const [pets, setPets] = useState<any[]>([]);

    const checkStatus = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Check if anonymous
            setIsAnonymous(!!user.is_anonymous || !user.email);

            // Fetch profile for premium status
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', user.id)
                .single();
            
            setIsPremium(profile?.is_premium || false);

            // Check if they have pets
            const { data: myPets } = await supabase
                .from('pets')
                .select('id')
                .eq('owner_id', user.id);
            
            setPets(myPets || []);

        } catch (error) {
            console.error('[PawMatch] Status check error:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            checkStatus();
        }, [checkStatus])
    );

    return (
        <PawMatchGate
            isPremium={isPremium}
            isAnonymous={isAnonymous}
            onUpgrade={() => navigation.navigate('Profile')}
            onLinkAccount={() => navigation.navigate('Profile', { screen: 'Account' })}
        >
            <SafeAreaView style={styles.container}>
                {/* Header - Always Static */}
                <View style={styles.header}>
                    <Text style={styles.headerText}>PawMatch</Text>
                    {pets.length > 0 && (
                        <TouchableOpacity 
                            style={styles.matchesIcon}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('MatchesList');
                            }}
                        >
                            <Ionicons name="chatbubbles" size={26} color="#FF007F" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading && pets.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF007F" />
                    </View>
                ) : (
                    <View style={styles.content}>
                        <Ionicons name="heart-circle" size={100} color="#FF007F" style={{ marginBottom: 20 }} />
                        <Text style={styles.placeholderText}>
                            {pets.length > 0 ? t('pawmatch.ready', 'Ready for Matching!') : t('pawmatch.welcome', 'Welcome to PawMatch!')}
                        </Text>
                        <Text style={styles.subText}>
                            {pets.length > 0 
                                ? t('pawmatch.ready_desc', 'You have pets ready for matching. Start discovering local pets now.')
                                : t('pawmatch.no_pets_desc', 'To start matching, you first need to add your personal pet profile.')
                            }
                        </Text>

                        <TouchableOpacity 
                            style={styles.manageBtn}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                navigation.navigate('MyPets');
                            }}
                        >
                            <Text style={styles.manageBtnText}>
                                {pets.length > 0 ? t('pawmatch.manage_pets', 'Manage My Pets') : t('pawmatch.add_pet_now', 'Add My Pet Now')}
                            </Text>
                            <Ionicons name="paw" size={18} color="white" />
                        </TouchableOpacity>

                        {pets.length > 0 && (
                            <TouchableOpacity 
                                style={styles.discoverBtn}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                                    navigation.navigate('Discovery');
                                }}
                            >
                                <Text style={styles.discoverBtnText}>{t('pawmatch.start_discovery', 'Start Discovery')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </SafeAreaView>
        </PawMatchGate>
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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerText: {
        color: '#FFD700',
        fontSize: 32,
        fontWeight: '900',
        marginBottom: 10,
        marginTop: 10,
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    matchesIcon: {
        padding: 5,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0A001A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    placeholderText: {
        color: 'white',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    subText: {
        color: '#6A4C93',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 40,
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1A0B2E',
        borderWidth: 1,
        borderColor: '#FFD700',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 20,
        gap: 10,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 15,
    },
    manageBtnText: {
        color: '#FFD700',
        fontWeight: '900',
        fontSize: 16,
    },
    discoverBtn: {
        backgroundColor: '#FF007F',
        paddingHorizontal: 25,
        paddingVertical: 18,
        borderRadius: 20,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
    },
    discoverBtnText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 18,
    }
});
