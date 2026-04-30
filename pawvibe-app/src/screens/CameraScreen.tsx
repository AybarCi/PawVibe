import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Image, ScrollView, Dimensions, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import i18n from '../../lib/i18n';
import * as Sharing from 'expo-sharing';
import ShareModal from '../components/ShareModal';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    Easing, 
    withSequence, 
    withDelay,
    interpolate,
    Extrapolate,
    SharedValue,
    useAnimatedProps
} from 'react-native-reanimated';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import ViewShot from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useIAPContext } from '../context/IAPContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { logMetaEvent } from '../../lib/metaTracking';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SCAN_BOX_SIZE = 280;

// Instagram Story/Reels Ratio (9:16)
const POSTER_WIDTH = SCREEN_WIDTH * 0.9;
const POSTER_HEIGHT = POSTER_WIDTH * (16 / 9);

const AnimatedCameraView = Animated.createAnimatedComponent(CameraView);

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

// Sub-component for holographic scanning grid
const ScanningGrid = () => {
    return (
        <View style={styles.gridContainer}>
            {[...Array(10)].map((_, i) => (
                <View key={`v-${i}`} style={[styles.gridLineV, { left: `${(i + 1) * 10}%` }]} />
            ))}
            {[...Array(10)].map((_, i) => (
                <View key={`h-${i}`} style={[styles.gridLineH, { top: `${(i + 1) * 10}%` }]} />
            ))}
        </View>
    );
};

// Sub-component for COMPLEX, mechanical intertwined scanning glyphs
const ScanningGlyphs = () => {
    const rot1 = useSharedValue(0);
    const rot2 = useSharedValue(0);
    const rot3 = useSharedValue(0);
    const pulse = useSharedValue(1);

    useEffect(() => {
        rot1.value = withRepeat(withTiming(360, { duration: 10000, easing: Easing.linear }), -1);
        rot2.value = withRepeat(withTiming(-360, { duration: 15000, easing: Easing.linear }), -1);
        rot3.value = withRepeat(withTiming(360, { duration: 6000, easing: Easing.linear }), -1);
        pulse.value = withRepeat(withSequence(withTiming(1.1, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
    }, []);

    const s1 = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot1.value}deg` }, { scale: pulse.value }] as any }));
    const s2 = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot2.value}deg` }] as any }));
    const s3 = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot3.value}deg` }, { scale: 0.8 }] as any }));

    return (
        <View style={styles.ringContainer}>
            {/* Outer Thick Ring */}
            <Animated.View style={[styles.glyphCircle, { width: SCAN_BOX_SIZE * 0.9, height: SCAN_BOX_SIZE * 0.9, borderStyle: 'dashed', borderColor: '#00FFFF' }, s1]} />
            {/* Middle Thin Pink Ring */}
            <Animated.View style={[styles.glyphCircle, { width: SCAN_BOX_SIZE * 0.7, height: SCAN_BOX_SIZE * 0.7, borderColor: '#FF007F', borderLeftWidth: 0, borderRightWidth: 5 }, s2]} />
            {/* Inner Gold Ring with gaps */}
            <Animated.View style={[styles.glyphCircle, { width: SCAN_BOX_SIZE * 0.5, height: SCAN_BOX_SIZE * 0.5, borderColor: '#FFD700', borderTopWidth: 0, borderBottomWidth: 8 }, s3]} />
            {/* Center Target */}
            <View style={styles.centerTarget} />
        </View>
    );
};

// Sub-component for SEQUENTIAL data callouts
const DataCallouts = ({ isVisible }: { isVisible: boolean }) => {
    const c1 = useSharedValue(0);
    const c2 = useSharedValue(0);
    const c3 = useSharedValue(0);
    const c4 = useSharedValue(0);
    
    useEffect(() => {
        if (isVisible) {
            c1.value = withDelay(200, withTiming(1, { duration: 600 }));
            c2.value = withDelay(1000, withTiming(1, { duration: 600 }));
            c3.value = withDelay(1800, withTiming(1, { duration: 600 }));
            c4.value = withDelay(2600, withTiming(1, { duration: 600 }));
        } else {
            c1.value = 0; c2.value = 0; c3.value = 0; c4.value = 0;
        }
    }, [isVisible]);

    const getStyle = (val: SharedValue<number>) => useAnimatedStyle(() => ({
        opacity: val.value,
        transform: [{ translateX: interpolate(val.value, [0, 1], [-20, 0]) }]
    }));
    const getStyleR = (val: SharedValue<number>) => useAnimatedStyle(() => ({
        opacity: val.value,
        transform: [{ translateX: interpolate(val.value, [0, 1], [20, 0]) }]
    }));

    return (
        <Animated.View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Animated.View style={[styles.callout, { top: '15%', left: '5%' }, getStyle(c1)]}>
                <View style={styles.calloutLineH} />
                <View style={styles.calloutBox}><Text style={styles.calloutText}>BIO_SIG: DETECTED</Text></View>
            </Animated.View>

            <Animated.View style={[styles.callout, { top: '35%', right: '5%', flexDirection: 'row-reverse' }, getStyleR(c2)]}>
                <View style={styles.calloutLineH} />
                <View style={styles.calloutBox}><Text style={styles.calloutText}>KAOS_MATRIX: SYNC</Text></View>
            </Animated.View>

            <Animated.View style={[styles.callout, { bottom: '30%', left: '8%' }, getStyle(c3)]}>
                <View style={styles.calloutLineH} />
                <View style={styles.calloutBox}><Text style={styles.calloutText}>VIBE_LVL: CALCULATING</Text></View>
            </Animated.View>

            <Animated.View style={[styles.callout, { bottom: '15%', right: '8%', flexDirection: 'row-reverse' }, getStyleR(c4)]}>
                <View style={styles.calloutLineH} />
                <View style={styles.calloutBox}><Text style={styles.calloutText}>CUTE_ERR: 0.00%</Text></View>
            </Animated.View>
        </Animated.View>
    );
};

// Sub-component for the advanced laser
const ScanningLaser = ({ progress }: { progress: SharedValue<number> }) => {
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(progress.value, [0, 1], [0, SCAN_BOX_SIZE]) }],
        opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
        height: interpolate(progress.value, [0, 0.5, 1], [2, 15, 2]),
    }));

    return (
        <Animated.View style={[styles.laserContainer, animatedStyle]}>
            <LinearGradient
                colors={['transparent', 'rgba(0, 255, 255, 0.8)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.laserGradient}
            />
            <View style={styles.laserLine} />
        </Animated.View>
    );
};

// Sub-component for animated stat pills
const StatPill = ({ label, score, emoji, color, delay = 0 }: { label: string, score: number, emoji: string, color: string, delay?: number }) => {
    const animatedWidth = useSharedValue(0);

    useEffect(() => {
        animatedWidth.value = withDelay(
            delay,
            withTiming(score, {
                duration: 1500,
                easing: Easing.out(Easing.exp),
            })
        );
    }, [score, delay]);

    const animatedStyle = useAnimatedStyle(() => ({
        width: `${animatedWidth.value}%`,
        backgroundColor: color,
    }));

    return (
        <View style={styles.cuteStatPill}>
            <View style={styles.pillHeader}>
                <Text style={styles.pillEmoji}>{emoji}</Text>
                <Text style={styles.pillLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.pillScore}>{score}</Text>
            </View>
            <View style={styles.progressBarBg}>
                <Animated.View style={[styles.progressBarFill, animatedStyle]} />
            </View>
        </View>
    );
};

export default function CameraScreen({ navigation }: any) {
    const { t } = useTranslation();
    const [permission, requestPermission] = useCameraPermissions();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [photoUri, setPhotoUri] = useState<string | null>(null);
    const [scanningTextIndex, setScanningTextIndex] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareImageUri, setShareImageUri] = useState<string | null>(null);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const insets = useSafeAreaInsets();
    const { isConfigured } = useIAPContext();
    const [isPremium, setIsPremium] = useState(false);

    const cameraRef = useRef<CameraView>(null);
    const viewShotRef = useRef<any>(null);

    // Zoom State
    const zoom = useSharedValue(0);
    const startZoom = useSharedValue(0);

    // Scanner Animation
    const scanProgress = useSharedValue(0);
    
    // UI Feedback States
    const [isScrollable, setIsScrollable] = useState(false);
    const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
    const [scrollViewHeight, setScrollViewHeight] = useState(0);
    const [contentHeight, setContentHeight] = useState(0);
    const glowOpacity = useSharedValue(0);

    // Gestures
    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            startZoom.value = zoom.value;
        })
        .onUpdate((event) => {
            const scale = event.scale;
            // More sensitive zoom: 0.8
            const nextZoom = startZoom.value + (scale - 1) * 0.8;
            zoom.value = Math.max(0, Math.min(nextZoom, 1));
        });

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const animatedZoomProps = useAnimatedProps(() => ({
        zoom: zoom.value,
    }));

    const zoomIndicatorStyle = useAnimatedStyle(() => ({
        left: `${zoom.value * 100}%`,
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
            scanProgress.value = withRepeat(
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
                -1,
                true
            );

            interval = setInterval(() => {
                setScanningTextIndex((prev) => (prev + 1) % 3);
            }, 1500);
        } else {
            scanProgress.value = 0;
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

    const cameraAnimatedStyle = useAnimatedStyle(() => ({
        // We can add subtle zoom scale if we want visual feedback on pinch
    }));

    if (!permission) return <View style={styles.container} />;

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
            const { data: { session } } = await supabase.auth.getSession();
            let authSession = session;

            if (!authSession) {
                await supabase.auth.signInAnonymously();
                const sessionRes = await supabase.auth.getSession();
                authSession = sessionRes.data.session;
            }

            if (!authSession) {
                showCustomAlert(t('app.error'), t('app.waiting_auth'));
                setIsAnalyzing(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', authSession.user.id)
                .maybeSingle();

            const photo = await cameraRef.current.takePictureAsync({
                quality: 0.5,
                base64: false
            });

            if (!photo) throw new Error("Could not capture photo.");
            setPhotoUri(photo.uri);
            logMetaEvent('photo_captured', { source: 'camera' });

            const manipResult = await ImageManipulator.manipulateAsync(
                photo.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.WEBP, base64: true }
            );

            if (!manipResult.base64) throw new Error("Could not compress photo.");

            logMetaEvent('ai_analysis_started');
            const { data, error } = await supabase.functions.invoke('analyze-pet-vibe', {
                body: {
                    user_id: authSession.user.id,
                    image_base64: manipResult.base64,
                    language: i18n.language
                }
            });

            if (error) {
                if (error.message?.includes('Insufficient credits') || error.status === 402 || (error.context?.status === 402)) {
                    showCustomAlert(t('app.out_of_credits'), t('app.out_of_credits_msg'), () => navigation.navigate('Profile'));
                } else {
                    showCustomAlert(t('app.analysis_failed'), t('app.analysis_failed_msg'));
                }
                return;
            }

            setResult(data);
            logMetaEvent('fb_mobile_content_view', { content_type: 'vibe_result' });

        } catch (error) {
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
                logMetaEvent('fb_mobile_share', { content_type: 'vibe_card' });
            }
        } catch (error) {
            showCustomAlert(t('app.error', 'Error'), t('app.could_not_share', 'Could not share image.'));
        }
    };



    return (
        <SafeAreaView style={styles.container}>
            {result && photoUri ? (
                <View style={{ flex: 1, width: '100%' }}>
                    <ScrollView
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        onLayout={(e) => setScrollViewHeight(e.nativeEvent.layout.height)}
                        onContentSizeChange={(_, h) => setContentHeight(h)}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                    >
                        <Text style={[styles.title, { fontSize: 24, textAlign: 'center' }]}>{t('app.vibe_check_complete')}</Text>

                        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }}>
                            <View style={styles.shareablePoster}>
                                <LinearGradient colors={['#1A0B2E', '#0A001A']} style={StyleSheet.absoluteFill} />
                                
                                <View style={styles.posterHeader}>
                                    <Text style={styles.posterTitle}>PAWVIBE</Text>
                                    <Text style={styles.posterSubtitle}>COSMIC ANALYSIS REPORT</Text>
                                </View>

                                <View style={styles.posterImageContainer}>
                                    <Image source={{ uri: photoUri }} style={styles.posterPetImage} resizeMode="cover" />
                                    <View style={[styles.cornerTL, { borderColor: '#00FFFF' }]} />
                                    <View style={[styles.cornerTR, { borderColor: '#00FFFF' }]} />
                                    <View style={[styles.cornerBL, { borderColor: '#00FFFF' }]} />
                                    <View style={[styles.cornerBR, { borderColor: '#00FFFF' }]} />
                                </View>

                                <View style={styles.posterContent}>
                                    <Text style={styles.posterMoodTitle} numberOfLines={2} adjustsFontSizeToFit>{result.mood_title}</Text>
                                    
                                    {result.is_pet !== false && (
                                        <View style={styles.posterStatsGrid}>
                                            <View style={styles.statColumn}>
                                                <StatPill label={t('app.chaos')} score={result.chaos_score ?? 0} emoji="🌪️" color="#FF007F" delay={300} />
                                                <StatPill label={t('app.energy')} score={result.energy_level ?? 0} emoji="⚡" color="#FFD700" delay={500} />
                                                <StatPill label={t('app.sweetness')} score={result.sweetness_score ?? 0} emoji="🍬" color="#00FFFF" delay={700} />
                                            </View>
                                            <View style={styles.statColumn}>
                                                <StatPill label={t('app.judgment')} score={result.judgment_level ?? 0} emoji="😒" color="#FF4500" delay={400} />
                                                <StatPill label={t('app.cuddle')} score={result.cuddle_o_meter ?? 0} emoji="🤗" color="#FF1493" delay={600} />
                                                <StatPill label={t('app.derp')} score={result.derp_factor ?? 0} emoji="🤪" color="#32CD32" delay={800} />
                                            </View>
                                        </View>
                                    )}

                                    {result.is_pet === false && result.explanation && (
                                        <Text style={styles.funnyExplanation}>{result.explanation}</Text>
                                    )}
                                </View>

                                <View style={styles.posterFooter}>
                                    <Text style={styles.watermark}>WWW.PAWVIBE.APP</Text>
                                </View>
                            </View>
                        </ViewShot>

                        <View style={styles.actionButtons}>
                            <TouchableOpacity 
                                style={[styles.btn, { flex: 1, marginRight: 10 }]} 
                                onPress={() => { 
                                    Haptics.selectionAsync(); 
                                    setResult(null); 
                                    zoom.value = 0; // Reset Zoom
                                }}
                            >
                                <Text style={styles.btnText}>{t('app.scan_another')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: '#6A4C93', borderColor: '#FF007F', borderWidth: 1 }]} onPress={captureAndShare}>
                                <Text style={styles.btnText}>{t('app.share')} 🚀</Text>
                            </TouchableOpacity>
                        </View>

                        <ShareModal visible={showShareModal} imageUri={shareImageUri} onClose={() => setShowShareModal(false)} />
                    </ScrollView>

                    {isScrollable && !hasScrolledToBottom && (
                        <Animated.View style={[styles.neonGlowContainer, animatedGlowStyle]} pointerEvents="none">
                            <LinearGradient colors={['transparent', 'rgba(10, 0, 26, 0.4)', 'rgba(255, 0, 127, 0.6)']} style={styles.neonGradient}>
                                <MaterialCommunityIcons name="chevron-double-down" size={28} color="#FFFFFF" />
                                <Text style={styles.neonGlowText}>{t('app.scroll_down')}</Text>
                            </LinearGradient>
                        </Animated.View>
                    )}
                </View>
            ) : (
            <GestureDetector gesture={pinchGesture}>
                <View style={{ flex: 1, width: '100%' }}>
                    {isAnalyzing && photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.camera} resizeMode="cover" />
                    ) : (
                        <AnimatedCameraView 
                            style={styles.camera} 
                            facing="back" 
                            ref={cameraRef}
                            animatedProps={animatedZoomProps}
                        />
                    )}

                    {/* Scanner UI */}
                    <View style={[StyleSheet.absoluteFill, styles.scannerUI]}>
                            {/* Visual Guide Borders */}
                            <View style={styles.viewfinderContainer}>
                                <View style={styles.scanBox}>
                                    {isAnalyzing && (
                                        <>
                                            <ScanningGrid />
                                            <ScanningGlyphs />
                                            <ScanningLaser progress={scanProgress} />
                                            <DataCallouts isVisible={isAnalyzing} />
                                        </>
                                    )}
                                    <View style={styles.cornerTL} />
                                    <View style={styles.cornerTR} />
                                    <View style={styles.cornerBL} />
                                    <View style={styles.cornerBR} />
                                </View>
                            </View>

                            {/* Status and Controls */}
                            <View style={styles.cameraBottomControls}>
                                {isAnalyzing ? (
                                    <View style={styles.analyzingTextContainer}>
                                        <ActivityIndicator color="#00FFFF" style={{ marginBottom: 10 }} />
                                        <Text style={styles.scanText}>{getScanningText()}</Text>
                                    </View>
                                ) : (
                                    <>
                                        {/* Zoom Indicator */}
                                        <View style={styles.zoomControl}>
                                            <MaterialCommunityIcons name="magnify-minus" size={20} color="#FFFFFF" />
                                            <View style={styles.zoomTrack}>
                                                <Animated.View style={[styles.zoomIndicator, zoomIndicatorStyle]} />
                                            </View>
                                            <MaterialCommunityIcons name="magnify-plus" size={20} color="#FFFFFF" />
                                        </View>

                                        <TouchableOpacity style={styles.captureBtn} onPress={takePictureAndAnalyze}>
                                            <View style={styles.captureInner} />
                                        </TouchableOpacity>
                                        <Text style={styles.captureHint}>{t('app.pinch_to_zoom', 'Pinch to Zoom')}</Text>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                </GestureDetector>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    camera: { flex: 1, width: '100%' },
    scannerUI: {
        justifyContent: 'space-between',
        paddingVertical: 40,
    },
    viewfinderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanBox: {
        width: SCAN_BOX_SIZE,
        height: SCAN_BOX_SIZE,
        borderRadius: 30,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(26, 11, 46, 0.2)',
    },
    cameraBottomControls: {
        alignItems: 'center',
        paddingBottom: 20,
        backgroundColor: 'rgba(10, 0, 26, 0.5)',
        paddingTop: 20,
    },
    zoomControl: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '60%',
        marginBottom: 25,
        gap: 10,
    },
    zoomTrack: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        position: 'relative',
    },
    zoomIndicator: {
        position: 'absolute',
        top: -4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00FFFF',
        shadowColor: '#00FFFF',
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF007F',
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    captureInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF007F',
    },
    captureHint: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 10,
        opacity: 0.7,
    },
    analyzingTextContainer: {
        alignItems: 'center',
    },
    gridContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    gridLineV: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
    },
    gridLineH: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
    },
    laserContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 40,
        zIndex: 5,
    },
    laserGradient: {
        height: '100%',
        width: '100%',
    },
    laserLine: {
        height: 2,
        backgroundColor: '#00FFFF',
        shadowColor: '#00FFFF',
        shadowOpacity: 1,
        shadowRadius: 8,
    },
    scanText: {
        color: '#00FFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1.5,
        textAlign: 'center',
        textShadowColor: '#00FFFF',
        textShadowRadius: 10,
    },
    ringContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glyphCircle: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 2,
    },
    centerTarget: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#00FFFF',
        shadowColor: '#00FFFF',
        shadowOpacity: 1,
        shadowRadius: 10,
    },
    callout: {
        position: 'absolute',
        flexDirection: 'row',
        alignItems: 'center',
    },
    calloutLineH: {
        width: 40,
        height: 2,
        backgroundColor: '#00FFFF',
        shadowColor: '#00FFFF',
        shadowOpacity: 1,
        shadowRadius: 5,
    },
    calloutBox: {
        backgroundColor: 'rgba(0, 255, 255, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: '#00FFFF',
        borderRadius: 4,
    },
    calloutText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    // Common styles
    scrollContent: { alignItems: 'center', paddingTop: 20, paddingBottom: 50 },
    btn: { backgroundColor: '#FF007F', padding: 15, borderRadius: 10, marginTop: 20, shadowColor: '#FF007F', shadowOpacity: 0.8, shadowRadius: 10 },
    btnText: { color: 'white', fontWeight: '900', fontSize: 18 },
    title: { color: '#FFD700', fontSize: 28, fontWeight: '900', marginBottom: 20, textShadowColor: '#FF007F', textShadowRadius: 10 },
    moodTitle: { color: '#FF007F', fontSize: 32, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
    funnyExplanation: { color: 'white', fontSize: 16, fontStyle: 'italic', textAlign: 'center', marginTop: 10, paddingHorizontal: 15 },
    shareablePoster: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        backgroundColor: '#1A0B2E',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FF007F',
        paddingVertical: 20,
        alignItems: 'center',
    },
    posterHeader: {
        alignItems: 'center',
        marginBottom: 15,
    },
    posterTitle: {
        color: '#FFD700',
        fontSize: 28,
        fontWeight: '900',
        letterSpacing: 5,
    },
    posterSubtitle: {
        color: '#00FFFF',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 2,
    },
    posterImageContainer: {
        width: '85%',
        aspectRatio: 1,
        borderRadius: 15,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255, 0, 127, 0.3)',
        marginBottom: 20,
    },
    posterPetImage: {
        width: '100%',
        height: '100%',
    },
    posterContent: {
        flex: 1,
        width: '100%',
        paddingHorizontal: 15,
    },
    posterMoodTitle: {
        color: '#FF007F',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        marginBottom: 15,
        textShadowColor: '#000',
        textShadowRadius: 4,
    },
    posterStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    posterFooter: {
        marginTop: 10,
        opacity: 0.6,
    },
    // Watermark/Common
    shareableCard: { width: '90%', backgroundColor: '#1A0B2E', borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#FF007F', shadowColor: '#FF007F', shadowOpacity: 0.8, shadowRadius: 15, marginBottom: 30 },
    imageContainer: { width: '100%', aspectRatio: 14 / 9, backgroundColor: '#333' },
    petImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    statsOverlay: { paddingVertical: 15, paddingHorizontal: 12, backgroundColor: '#1A0B2E', alignItems: 'center' },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
    statColumn: { flex: 1, gap: 12, alignItems: 'center' },
    cuteStatPill: { backgroundColor: 'rgba(26, 11, 46, 0.85)', width: '98%', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 25, borderWidth: 2, borderColor: '#6A4C93', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
    pillHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 6, gap: 5 },
    pillEmoji: { fontSize: 18, width: 24, textAlign: 'center' },
    pillLabel: { color: '#D3C4E5', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 1 },
    pillScore: { color: '#FFD700', fontSize: 14, fontWeight: '900', marginLeft: 2 },
    progressBarBg: { width: '100%', height: 6, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 4, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    neonGlowContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120, justifyContent: 'flex-end', alignItems: 'center' },
    neonGradient: { width: '100%', height: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
    neonGlowText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 3, textShadowColor: '#FF007F', textShadowRadius: 8, marginTop: 2 },
    watermark: { paddingTop: 10, color: '#6A4C93', fontSize: 12, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' },
    actionButtons: { flexDirection: 'row', width: '90%', justifyContent: 'space-between' },
    cornerTL: { position: 'absolute', top: 0, left: 0, width: 20, height: 20, borderTopWidth: 3, borderLeftWidth: 3, borderColor: '#FF007F', borderTopLeftRadius: 20 },
    cornerTR: { position: 'absolute', top: 0, right: 0, width: 20, height: 20, borderTopWidth: 3, borderRightWidth: 3, borderColor: '#FF007F', borderTopRightRadius: 20 },
    cornerBL: { position: 'absolute', bottom: 0, left: 0, width: 20, height: 20, borderBottomWidth: 3, borderLeftWidth: 3, borderColor: '#FF007F', borderBottomLeftRadius: 20 },
    cornerBR: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderBottomWidth: 3, borderRightWidth: 3, borderColor: '#FF007F', borderBottomRightRadius: 20 },
});
