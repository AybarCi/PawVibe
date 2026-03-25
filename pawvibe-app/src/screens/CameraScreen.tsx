import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n'; // Correctly import the i18n instance
import * as Sharing from 'expo-sharing';
import ShareModal from '../components/ShareModal';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useIAPContext } from '../context/IAPContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface AnalysisResult {
    mood_title?: string;
    chaos_score?: number;
    energy_level?: number;
    sweetness_score?: number;
    judgment_level?: number;
    cuddle_o_meter?: number;
    derp_factor?: number;
    is_pet?: boolean;
    explanation?: string;
}

export default function CameraScreen({ navigation }: any) {
    const { t } = useTranslation();
    const [permission, requestPermission] = useCameraPermissions();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [scanningTextIndex, setScanningTextIndex] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareImageUri, setShareImageUri] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null); // Updated type for result
    const insets = useSafeAreaInsets();

    // Using IAPContext to get premium status, avoiding local state
    const { isConfigured } = useIAPContext();
    // `isPremium` isn't strictly provided by IAPContext state directly in this snippet, 
    // it usually comes from user profile in PawVibe. I will re-add a basic `isPremium` local state 
    // since `useIAPContext` only returns products, etc.
    const [isPremium, setIsPremium] = useState(false);

    const cameraRef = useRef<CameraView>(null);
    const viewShotRef = useRef<any>(null);

    // Laser Animation for Scanner
    const laserY = useSharedValue(0);
    const animatedLaserStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: laserY.value }],
    }));

    // Dynamic Scroll Indicator State
    const [isScrollable, setIsScrollable] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);

    const glowOpacity = useSharedValue(0);
    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    useEffect(() => {
        if (contentHeight > scrollViewHeight && scrollViewHeight > 0) {
            setIsScrollable(true);
            setHasScrolledToBottom(contentHeight - scrollViewHeight < 20);
        } else {
            setIsScrollable(false);
            setHasScrolledToBottom(true);
        }
    }, [contentHeight, scrollViewHeight]);

    useEffect(() => {
        if (result && isScrollable && !hasScrolledToBottom) {
            glowOpacity.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
                    withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            glowOpacity.value = withTiming(0, { duration: 400 });
        }
    }, [result, isScrollable, hasScrolledToBottom]);

    const handleScroll = (event: any) => {
        const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
        const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
        setHasScrolledToBottom(isCloseToBottom);
    };

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isAnalyzing) {
            laserY.value = withRepeat(
                withSequence(
                    withTiming(297, { duration: 1500, easing: Easing.inOut(Easing.ease) }), // Adjusted target height for scan box
                    withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1
            );

            interval = setInterval(() => {
                setScanningTextIndex((prev) => (prev + 1) % 3);
            }, 1500);
        } else {
            laserY.value = 0;
            setScanningTextIndex(0);
        }
        return () => clearInterval(interval);
    }, [isAnalyzing]);

    const getScanningText = () => {
        switch (scanningTextIndex) {
            case 0: return t('app.analyzing_aura', 'Analyzing Aura Katmanları...');
            case 1: return t('app.calculating_chaos', 'Calculating Chaos Matrix...');
            default: return t('app.summoning_energy', 'Summoning Cosmic Energy...');
        }
    }

    const showCustomAlert = (title: string, message: string, onClose?: () => void) => {
        Toast.show({
            type: 'error',
            text1: title,
            text2: message,
            onHide: onClose
        });
    };

    // Prompt user for camera permission
    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={{ textAlign: 'center', marginBottom: 20, color: 'white' }}>{t('app.camera_permission')}</Text>
                <TouchableOpacity style={styles.btn} onPress={() => { Haptics.selectionAsync(); requestPermission(); }}>
                    <Text style={styles.btnText}>{t('app.grant_permission')}</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    const takePictureAndAnalyze = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (!cameraRef.current) return;

        setIsAnalyzing(true);
        setResult(null);
        setPhotoUri(null);

        try {
            // Session is created in App.tsx on startup. Just verify it exists.
            const { data: { session } } = await supabase.auth.getSession();
            let authSession = session;

            if (!authSession) {
                // Fallback: if session somehow expired, try to recreate
                console.log("[Camera] No session, attempting anonymous sign-in...");
                await supabase.auth.signInAnonymously();
                const sessionRes = await supabase.auth.getSession();
                authSession = sessionRes.data.session;
            }

            if (!authSession) {
                showCustomAlert(t('app.error'), t('app.waiting_auth'));
                setIsAnalyzing(false);
                return;
            }

            // Check premium status to hide watermark
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', authSession.user.id)
                .maybeSingle();

            // 1. Take Picture
            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: false
            });

            if (!photo) throw new Error("Could not capture photo.");
            setPhotoUri(photo.uri);

            // 2. Resize and Compress Image
            const manipResult = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.WEBP, base64: true }
            );

            if (!manipResult.base64) throw new Error("Could not compress photo.");

            // 3. Call Edge Function
            const { data, error } = await supabase.functions.invoke('analyze-pet-vibe', {
                body: {
                    user_id: authSession.user.id,
                    image_base64: manipResult.base64,
                    language: i18n.language // Send actual language code (e.g., 'tr' or 'en')
                }
            });

            if (error) {
                if (error.message?.includes('Insufficient credits') || error.status === 402 ||
                    (error.context?.status === 402)) {
                    showCustomAlert(t('app.out_of_credits'), t('app.out_of_credits_msg'), () => navigation.navigate('Profile'));
                } else {
                    console.error("Edge function error:", error);
                    showCustomAlert(t('app.analysis_failed'), t('app.analysis_failed_msg'));
                }
                return;
            }

            // 4. Set Result
            setResult(data);

        } catch (error) {
            console.error("Analysis Error:", error);
            showCustomAlert(t('app.error'), t('app.analysis_failed_msg'));
        } finally {
            setIsAnalyzing(false);
        }
    };

    const captureAndShare = async () => {
        Haptics.selectionAsync();
        try {
            if (viewShotRef.current) {
                const uri = await viewShotRef.current.capture();
                setShareImageUri(uri);
                setShowShareModal(true);
            }
        } catch (error) {
            console.error(error);
            showCustomAlert(t('app.error', 'Error'), t('app.could_not_share', 'Could not share image.'));
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A001A' }}>
            {/* Show Result OR Camera */}
            {result && photoUri ? (
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView
                        style={{ flex: 1, width: '100%' }}
                        contentContainerStyle={{ alignItems: 'center', paddingTop: 20, paddingBottom: 50 }}
                        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                        onContentSizeChange={(_, h) => setContentHeight(h)}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        <Text style={[styles.title, { fontSize: 24, textAlign: 'center' }]}>{t('app.vibe_check_complete')}</Text>

                        {/* Shareable Card wrapped in ViewShot */}
                        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1.0 }} style={styles.shareableCard}>
                            {/* Pet Photo */}
                            <View style={styles.imageContainer}>
                                <Image
                                    source={{ uri: photoUri }}
                                    style={styles.petImage}
                                    resizeMode="cover"
                                />
                            </View>

                            {/* Stats Overlay */}
                            <View style={styles.statsOverlay}>
                                <Text style={styles.moodTitle} numberOfLines={2} adjustsFontSizeToFit>{result.mood_title}</Text>
                                {result.is_pet !== false && (
                                    <View style={styles.statsGrid}>
                                        <View style={styles.statColumn}>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>🌪️</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.chaos')}</Text>
                                                    <Text style={styles.pillScore}>{result.chaos_score ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.chaos_score ?? 0}%`, backgroundColor: '#FF007F' }]} />
                                                </View>
                                            </View>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>⚡</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.energy')}</Text>
                                                    <Text style={styles.pillScore}>{result.energy_level ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.energy_level ?? 0}%`, backgroundColor: '#FFD700' }]} />
                                                </View>
                                            </View>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>🍬</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.sweetness')}</Text>
                                                    <Text style={styles.pillScore}>{result.sweetness_score ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.sweetness_score ?? 0}%`, backgroundColor: '#00FFFF' }]} />
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.statColumn}>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>😒</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.judgment')}</Text>
                                                    <Text style={styles.pillScore}>{result.judgment_level ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.judgment_level ?? 0}%`, backgroundColor: '#FF4500' }]} />
                                                </View>
                                            </View>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>🤗</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.cuddle')}</Text>
                                                    <Text style={styles.pillScore}>{result.cuddle_o_meter ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.cuddle_o_meter ?? 0}%`, backgroundColor: '#FF1493' }]} />
                                                </View>
                                            </View>
                                            <View style={styles.cuteStatPill}>
                                                <View style={styles.pillHeader}>
                                                    <Text style={styles.pillEmoji}>�</Text>
                                                    <Text style={styles.pillLabel} numberOfLines={1}>{t('app.derp')}</Text>
                                                    <Text style={styles.pillScore}>{result.derp_factor ?? 0}</Text>
                                                </View>
                                                <View style={styles.progressBarBg}>
                                                    <View style={[styles.progressBarFill, { width: `${result.derp_factor ?? 0}%`, backgroundColor: '#32CD32' }]} />
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                )}
                                {result.is_pet === false && result.explanation && (
                                    <Text style={styles.funnyExplanation}>{result.explanation}</Text>
                                )}
                                {!isPremium && <Text style={styles.watermark}>PawVibe</Text>}
                            </View>
                        </ViewShot>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity style={[styles.btn, { flex: 1, marginRight: 10 }]} onPress={() => { Haptics.selectionAsync(); setResult(null); }}>
                                <Text style={styles.btnText}>{t('app.scan_another')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#6A4C93', borderColor: '#FF007F', borderWidth: 1 }]} onPress={captureAndShare}>
                                <Text style={styles.btnText}>{t('app.share')} 🚀</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Custom Share Modal */}
                        <ShareModal
                            visible={showShareModal}
                            imageUri={shareImageUri}
                            onClose={() => setShowShareModal(false)}
                        />
                    </ScrollView>

                    {/* Advanced Dynamic Scroll Indicator (Neon Glow) */}
                    {isScrollable && !hasScrolledToBottom && (
                        <Animated.View style={[styles.neonGlowContainer, animatedGlowStyle]} pointerEvents="none">
                            <LinearGradient
                                colors={['transparent', 'rgba(10, 0, 26, 0.4)', 'rgba(255, 0, 127, 0.6)']}
                                style={styles.neonGradient}
                            >
                                <MaterialCommunityIcons name="chevron-double-down" size={28} color="#FFFFFF" />
                                <Text style={styles.neonGlowText}>{t('app.scroll_down')}</Text>
                            </LinearGradient>
                        </Animated.View>
                    )}
                </View>
            ) : (
                <View style={{ flex: 1, width: '100%' }}>
                    <CameraView style={styles.camera} facing="back" ref={cameraRef} />

                    {/* Hologram Scanner Overlay */}
                    {isAnalyzing && (
                        <BlurView intensity={80} tint="dark" style={[StyleSheet.absoluteFill, styles.scannerOverlay]}>
                            <View style={styles.scanBox}>
                                {photoUri && (
                                    <Image source={{ uri: photoUri }} style={styles.scanImage} />
                                )}
                                <Animated.View style={[styles.laser, animatedLaserStyle]} />
                                <View style={styles.cornerTL} />
                                <View style={styles.cornerTR} />
                                <View style={styles.cornerBL} />
                                <View style={styles.cornerBR} />
                            </View>
                            <Text style={styles.scanText}>{getScanningText()}</Text>
                        </BlurView>
                    )}

                    {!isAnalyzing && (
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.captureBtn}
                                onPress={takePictureAndAnalyze}
                            >
                                <Text style={styles.btnText}>{t('app.analyze_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )
            }
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A', justifyContent: 'center', alignItems: 'center' },
    camera: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 30,
        paddingBottom: 50,
        backgroundColor: 'rgba(10, 0, 26, 0.7)', // Dark purple transparent 
        alignItems: 'center'
    },
    captureBtn: {
        backgroundColor: '#FF007F', // Neon Pink
        paddingVertical: 15,
        paddingHorizontal: 30,
        borderRadius: 30,
        width: '80%',
        alignItems: 'center',
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15
    },
    btn: {
        backgroundColor: '#FF007F',
        padding: 15,
        borderRadius: 10,
        marginTop: 20,
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 10
    },
    btnText: { color: 'white', fontWeight: '900', fontSize: 18 },

    // Results view styles
    title: {
        color: '#FFD700', // Neon Yellow
        fontSize: 28,
        fontWeight: '900',
        marginBottom: 20,
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
    },
    card: {
        backgroundColor: '#1A0B2E', // Dark Violet card
        padding: 20,
        borderRadius: 15,
        width: '90%',
        borderWidth: 1,
        borderColor: '#FF007F' // Neon Pink border
    },
    moodTitle: {
        color: '#FF007F',
        fontSize: 32,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 20
    },
    funnyExplanation: { color: 'white', fontSize: 16, fontStyle: 'italic', textAlign: 'center', marginTop: 10, paddingHorizontal: 15 },

    // Original Shareable Trading Card Styles
    shareableCard: {
        width: '90%',
        backgroundColor: '#1A0B2E',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FF007F',
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
        marginBottom: 30,
    },
    imageContainer: {
        width: '100%',
        aspectRatio: 14 / 9, // Reduced height further as requested
        backgroundColor: '#333',
    },
    petImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    statsOverlay: {
        paddingVertical: 15,
        paddingHorizontal: 25, // Adjusted to match new pill layout perfectly
        backgroundColor: '#1A0B2E',
        alignItems: 'center',
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 0,
    },
    statColumn: {
        flex: 1,
        gap: 12,
        alignItems: 'center', // Center pills in column
    },

    /* Cute Pill Badges & Progress Bars */
    cuteStatPill: {
        backgroundColor: 'rgba(26, 11, 46, 0.85)',
        width: '95%',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 25,
        borderWidth: 2,
        borderColor: '#6A4C93',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    pillHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        gap: 5,
    },
    pillEmoji: {
        fontSize: 18,
    },
    pillLabel: {
        color: '#D3C4E5',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    pillScore: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: '900',
        marginLeft: 2,
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },

    neonGlowContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 120, // Tall enough for a smooth gradient fade
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    neonGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 20, // Push slightly above the true bottom boundary
    },
    neonGlowText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 3,
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 8,
        marginTop: 2,
    },

    watermark: {
        color: '#6A4C93',
        fontSize: 12,
        fontWeight: '800',
        marginTop: 15,
        letterSpacing: 3,
        textTransform: 'uppercase',
    },
    actionButtons: {
        flexDirection: 'row',
        width: '90%',
        justifyContent: 'space-between',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#1A0B2E',
        padding: 25,
        borderRadius: 15,
        width: '85%',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FF007F',
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
    },
    modalTitle: {
        color: '#FFD700',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 15,
        textAlign: 'center',
    },
    modalMessage: {
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 25,
    },
    modalCloseBtn: {
        backgroundColor: '#FF007F',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 10,
    },
    scannerOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    scanBox: {
        width: 300,
        height: 300,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 127, 0.3)',
        position: 'relative'
    },
    scanImage: {
        width: '100%',
        height: '100%',
        opacity: 0.5
    },
    laser: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: 3,
        backgroundColor: '#00FFFF',
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 10,
    },
    scanText: {
        color: '#00FFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginTop: 30,
        letterSpacing: 2,
        textShadowColor: '#00FFFF',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10
    },
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FF007F', borderTopLeftRadius: 20 },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FF007F', borderTopRightRadius: 20 },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FF007F', borderBottomLeftRadius: 20 },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FF007F', borderBottomRightRadius: 20 },
});
