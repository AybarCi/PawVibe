import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    StyleSheet, Text, View, TouchableOpacity,
    Image, ActivityIndicator, Dimensions, Animated, PanResponder, Alert
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import MatchModal from '../components/MatchModal';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.65;
const SWIPE_THRESHOLD = 0.25 * width;

interface DiscoveryPet {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    gender: string;
    image_url: string | null;
    bio: string | null;
    owner_id: string;
    vibe_scan_id: string | null;
    has_vaccines?: boolean;
}

export default function DiscoveryScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState<string | null>(null);
    const [queue, setQueue] = useState<DiscoveryPet[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [myPet, setMyPet] = useState<any>(null);

    // Match Modal State
    const [showMatch, setShowMatch] = useState(false);
    const [matchedPet, setMatchedPet] = useState<DiscoveryPet | null>(null);

    // Animation values
    const position = new Animated.ValueXY();

    useEffect(() => {
        setupLocationAndFetch();
    }, []);

    const setupLocationAndFetch = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setLocationError('Permission to access location was denied');
                fetchQueue();
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Update user's pets with current location
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from('pets')
                    .update({ latitude, longitude })
                    .eq('owner_id', user.id);
            }

            fetchQueue(latitude, longitude);
        } catch (error) {
            console.error('[Location] Error:', error);
            fetchQueue();
        }
    };
    const rotate = position.x.interpolate({
        inputRange: [-width / 2, 0, width / 2],
        outputRange: ['-10deg', '0deg', '10deg'],
        extrapolate: 'clamp'
    });
    const likeOpacity = position.x.interpolate({
        inputRange: [0, width / 4],
        outputRange: [0, 1],
        extrapolate: 'clamp'
    });
    const dislikeOpacity = position.x.interpolate({
        inputRange: [-width / 4, 0],
        outputRange: [1, 0],
        extrapolate: 'clamp'
    });

    const fetchQueue = useCallback(async (userLat?: number, userLng?: number) => {
        try {
            // Only show full-screen loading if the queue is currently empty
            if (queue.length === 0) {
                setLoading(true);
            }
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get user's active pet
            const { data: myPets } = await supabase
                .from('pets')
                .select('*')
                .eq('owner_id', user.id)
                .eq('is_searching', true);

            if (!myPets || myPets.length === 0) {
                setMyPet(null);
                setLoading(false);
                return;
            }
            const activePet = myPets[0];
            setMyPet(activePet);

            // 2. Fetch swiped IDs
            const { data: seenPets } = await supabase
                .from('matches')
                .select('pet_to')
                .eq('pet_from', activePet.id);

            const excludedIds = seenPets?.map(s => s.pet_to) || [];
            excludedIds.push(activePet.id);

            // 3. Fetch candidates with distance filter (Bounding Box)
            let query = supabase
                .from('pets')
                .select('*')
                .neq('owner_id', user.id)
                .eq('species', activePet.species)
                .eq('gender', activePet.gender === 'male' ? 'female' : 'male')
                .eq('is_searching', true)
                .not('id', 'in', `(${excludedIds.join(',')})`);

            // Apply bounding box if we have location (roughly 50km)
            if (userLat && userLng) {
                const delta = 0.5; // ~50km range
                query = query
                    .gte('latitude', userLat - delta)
                    .lte('latitude', userLat + delta)
                    .gte('longitude', userLng - delta)
                    .lte('longitude', userLng + delta);
            }

            const { data: candidates, error } = await query.limit(20);

            if (error) throw error;
            setQueue(candidates || []);
            setCurrentIndex(0);
        } catch (error: any) {
            console.error('[Discovery] Fetch error:', error.message);
        } finally {
            setLoading(false);
        }
    }, [queue.length, myPet?.id, t]);

    useEffect(() => {
        // setupLocationAndFetch handles initial fetch
    }, [fetchQueue]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (evt, gestureState) => {
            position.setValue({ x: gestureState.dx, y: gestureState.dy });
        },
        onPanResponderRelease: (evt, gestureState) => {
            if (gestureState.dx > SWIPE_THRESHOLD) {
                forceSwipe('right');
            } else if (gestureState.dx < -SWIPE_THRESHOLD) {
                forceSwipe('left');
            } else {
                resetPosition();
            }
        }
    }), [currentIndex, queue]);

    const forceSwipe = (direction: 'right' | 'left') => {
        const x = direction === 'right' ? width : -width;
        Animated.timing(position, {
            toValue: { x, y: 0 },
            duration: 250,
            useNativeDriver: false
        }).start(() => onSwipeComplete(direction));
    };

    const onSwipeComplete = async (direction: 'right' | 'left') => {
        const targetPet = queue[currentIndex];
        const status = direction === 'right' ? 'like' : 'dislike';

        try {
            // 1. Save swipe to DB
            const { error } = await supabase
                .from('matches')
                .upsert({
                    pet_from: myPet.id,
                    pet_to: targetPet.id,
                    status: status
                });

            if (error) throw error;

            // 2. If it was a 'like', check if it's a match!
            if (status === 'like') {
                const { data: otherSwipe } = await supabase
                    .from('matches')
                    .select('status')
                    .eq('pet_from', targetPet.id)
                    .eq('pet_to', myPet.id)
                    .eq('status', 'like')
                    .single();

                if (otherSwipe) {
                    // 🎉 IT'S A PAWMATCH!
                    setMatchedPet(targetPet);
                    setShowMatch(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                    // Update match status in DB for both
                    await supabase.from('matches').update({ status: 'match' }).match({ pet_from: myPet.id, pet_to: targetPet.id });
                    await supabase.from('matches').update({ status: 'match' }).match({ pet_from: targetPet.id, pet_to: myPet.id });
                }
            }

            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            console.error('[Discovery] Swipe error:', error);
        }

        position.setValue({ x: 0, y: 0 });
        setCurrentIndex(prev => prev + 1);
    };

    const resetPosition = () => {
        Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 4,
            useNativeDriver: false
        }).start();
    };

    const renderCard = (item: DiscoveryPet, index: number) => {
        if (index < currentIndex) return null;

        const isCurrent = index === currentIndex;
        const animatedStyle = isCurrent ? {
            transform: [...position.getTranslateTransform(), { rotate }]
        } : {};

        return (
            <Animated.View
                key={item.id}
                style={[styles.card, animatedStyle, { zIndex: queue.length - index }]}
                {...(isCurrent ? panResponder.panHandlers : {})}
            >
                <Image
                    source={item.image_url ? { uri: item.image_url } : require('../../assets/icon.png')}
                    style={styles.cardImage}
                />

                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.9)']}
                    style={styles.cardGradient}
                >
                    <View style={styles.cardInfo}>
                        <View style={styles.nameRow}>
                            <Text style={styles.cardName}>{item.name}</Text>
                            <Ionicons
                                name={item.gender === 'male' ? 'male' : 'female'}
                                size={20}
                                color="white"
                            />
                        </View>
                        <Text style={styles.cardBreed}>{item.breed || t('app.unknown_breed', 'Unknown Breed')}</Text>
                        <View style={styles.vibeTag}>
                            <MaterialCommunityIcons name="auto-fix" size={14} color="#FFD700" />
                            <Text style={styles.vibeText}>ENERGETIC VIBE</Text>
                        </View>
                    </View>
                </LinearGradient>

                {isCurrent && (
                    <>
                        <Animated.View style={[styles.statusBadge, styles.likeBadge, { opacity: likeOpacity }]}>
                            <Text style={styles.statusText}>PAW!</Text>
                        </Animated.View>
                        <Animated.View style={[styles.statusBadge, styles.dislikeBadge, { opacity: dislikeOpacity }]}>
                            <Text style={styles.statusText}>MEH</Text>
                        </Animated.View>
                    </>
                )}
            </Animated.View>
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top || 44 }]}>
            {/* Header - Always Fixed */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('pawmatch.discovery_title', 'Discovery')}</Text>
                <View style={{ width: 45 }} />
            </View>

            <View style={styles.content}>
                {loading && queue.length === 0 ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FF007F" />
                    </View>
                ) : !myPet ? (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="heart-off-outline" size={80} color="#1A0B2E" />
                        <Text style={styles.emptyTitle}>{t('pawmatch.no_active_pet', 'No Active Pet')}</Text>
                        <Text style={styles.emptyDesc}>
                            {t('pawmatch.no_active_pet_desc', 'You need to activate at least one pet to start discovering matches.')}
                        </Text>
                        <TouchableOpacity 
                            style={styles.emptyActionBtn}
                            onPress={() => navigation.navigate('MyPets')}
                        >
                            <Text style={styles.actionBtnText}>{t('pawmatch.go_to_my_pets', 'Go to My Pets')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : queue.length === 0 || currentIndex >= queue.length ? (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="paw-outline" size={80} color="#1A0B2E" />
                        <Text style={styles.emptyTitle}>{t('pawmatch.no_more_pets', 'No More Pets')}</Text>
                        <Text style={styles.emptyDesc}>
                            {t('pawmatch.no_more_pets_desc', 'Try expanding your search distance or check back later.')}
                        </Text>
                        <TouchableOpacity 
                            style={styles.emptyActionBtn}
                            onPress={() => setupLocationAndFetch()}
                        >
                            <Text style={styles.actionBtnText}>{t('pawmatch.refresh_queue', 'Refresh List')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <View style={styles.cardContainer}>
                            {queue.map((item, i) => renderCard(item, i)).reverse()}
                        </View>
                        <View style={styles.bottomActions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => forceSwipe('left')}>
                                <Ionicons name="close" size={30} color="#FF007F" />
                            </TouchableOpacity>
                            
                            <TouchableOpacity style={[styles.actionBtn, styles.superBtn]}>
                                <Ionicons name="star" size={25} color="#00FFFF" />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.actionBtn} onPress={() => forceSwipe('right')}>
                                <Ionicons name="heart" size={30} color="#00FF00" />
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            <MatchModal
                visible={showMatch}
                onClose={() => setShowMatch(false)}
                onMessage={() => {
                    setShowMatch(false);
                    navigation.navigate('MatchesList');
                }}
                myPetImage={myPet?.image_url}
                targetPetImage={matchedPet?.image_url}
                targetPetName={matchedPet?.name || ''}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A001A',
    },
    header: {
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        backgroundColor: 'transparent',
        zIndex: 100,
    },
    backBtn: {
        width: 45,
        height: 45,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(26, 11, 46, 0.6)',
        borderRadius: 23,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFD700',
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    content: {
        flex: 1,
    },
    filterBtn: {
        padding: 8,
    },
    cardContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    card: {
        position: 'absolute',
        width: width * 0.9,
        height: CARD_HEIGHT,
        borderRadius: 30,
        overflow: 'hidden',
        backgroundColor: '#15002C',
        borderWidth: 1,
        borderColor: '#2D005A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    cardGradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '40%',
        padding: 20,
        justifyContent: 'flex-end',
    },
    cardInfo: {
        marginBottom: 10,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    cardName: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
    },
    verifiedBadge: {
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        padding: 4,
        borderRadius: 8,
    },
    cardBreed: {
        color: '#D3C4E5',
        fontSize: 18,
        fontWeight: '500',
        marginTop: 4,
    },
    vibeTag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
        marginTop: 12,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)',
    },
    vibeText: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
    },
    statusBadge: {
        position: 'absolute',
        top: 40,
        borderWidth: 4,
        paddingHorizontal: 15,
        paddingVertical: 5,
        borderRadius: 10,
        transform: [{ rotate: '-15deg' }],
    },
    likeBadge: {
        left: 30,
        borderColor: '#00FF00',
    },
    dislikeBadge: {
        right: 30,
        borderColor: '#FF007F',
        transform: [{ rotate: '15deg' }],
    },
    statusText: {
        fontSize: 32,
        fontWeight: '900',
        color: 'white',
    },
    bottomActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 40,
        gap: 25,
    },
    actionBtn: {
        width: 65,
        height: 65,
        borderRadius: 35,
        backgroundColor: '#15002C',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2D005A',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    superBtn: {
        width: 55,
        height: 55,
        borderColor: '#00FFFF',
    },
    dislikeBtn: {
        borderColor: '#FF007F',
    },
    likeBtn: {
        borderColor: '#00FF00',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: 'white',
        marginTop: 20,
        textTransform: 'uppercase',
    },
    emptyDesc: {
        fontSize: 16,
        color: '#6A4C93',
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 24,
    },
    emptyActionBtn: {
        marginTop: 30,
        backgroundColor: '#FF007F',
        paddingHorizontal: 30,
        paddingVertical: 15,
        borderRadius: 20,
    },
    actionBtnText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 16,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0A001A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    refreshBtn: {
        marginTop: 30,
        backgroundColor: '#FFD700',
        paddingHorizontal: 25,
        paddingVertical: 15,
        borderRadius: 20,
    },
    refreshBtnText: {
        color: 'black',
        fontWeight: '900',
        fontSize: 16,
    }
});
