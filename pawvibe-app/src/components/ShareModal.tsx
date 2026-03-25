import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Linking,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useTranslation } from 'react-i18next';

const FACEBOOK_APP_ID = '957695596607763';

interface ShareModalProps {
    visible: boolean;
    imageUri: string | null;
    onClose: () => void;
}

interface ShareOption {
    id: string;
    labelKey: string;
    icon: string;
    colors: [string, string];
    urlScheme: string;
    queryScheme: string;
}

const SHARE_OPTIONS: ShareOption[] = [
    {
        id: 'instagram',
        labelKey: 'app.share_instagram',
        icon: 'instagram',
        colors: ['#833AB4', '#E1306C'],
        urlScheme: `instagram-stories://share?source_application=${FACEBOOK_APP_ID}`,
        queryScheme: 'instagram-stories://',
    },
    {
        id: 'facebook',
        labelKey: 'app.share_facebook',
        icon: 'facebook',
        colors: ['#1877F2', '#4267B2'],
        urlScheme: 'fb://',
        queryScheme: 'fb://',
    },
    {
        id: 'whatsapp',
        labelKey: 'app.share_whatsapp',
        icon: 'whatsapp',
        colors: ['#25D366', '#128C7E'],
        urlScheme: 'whatsapp://send',
        queryScheme: 'whatsapp://',
    },
    {
        id: 'tiktok',
        labelKey: 'app.share_tiktok',
        icon: 'music-note',
        colors: ['#010101', '#69C9D0'],
        urlScheme: 'snssdk1233://',
        queryScheme: 'snssdk1233://',
    },
];

export default function ShareModal({ visible, imageUri, onClose }: ShareModalProps) {
    const { t } = useTranslation();
    const [appAvailability, setAppAvailability] = useState<Record<string, boolean>>({});
    const [savingToGallery, setSavingToGallery] = useState(false);

    useEffect(() => {
        if (visible) {
            checkAppAvailability();
        }
    }, [visible]);

    const checkAppAvailability = async () => {
        const availability: Record<string, boolean> = {};
        for (const option of SHARE_OPTIONS) {
            try {
                availability[option.id] = await Linking.canOpenURL(option.queryScheme);
            } catch {
                availability[option.id] = false;
            }
        }
        setAppAvailability(availability);
    };

    const handleShareToApp = async (option: ShareOption) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (!imageUri) return;

        // If the app is available and we can deep-link (production build), try direct sharing
        if (appAvailability[option.id]) {
            try {
                // For Instagram Stories, we need special handling via pasteboard on iOS
                // For now, all direct app shares go through the native share sheet
                // filtered to the target app, since URL scheme sharing requires
                // native module bridging for pasteboard access
                await Sharing.shareAsync(imageUri, {
                    mimeType: 'image/jpeg',
                    UTI: 'public.jpeg',
                });
            } catch (error) {
                console.error(`Share to ${option.id} failed:`, error);
                // Fallback to native share sheet
                await fallbackShare();
            }
        } else {
            // App not installed or we're in Expo Go — use native share sheet
            await fallbackShare();
        }

        onClose();
    };

    const fallbackShare = async () => {
        if (!imageUri) return;
        try {
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(imageUri, {
                    mimeType: 'image/jpeg',
                    UTI: 'public.jpeg',
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: t('app.sharing_unavailable'),
                    text2: t('app.sharing_not_supported'),
                });
            }
        } catch (error) {
            console.error('Fallback share failed:', error);
            Toast.show({
                type: 'error',
                text1: t('app.error'),
                text2: t('app.could_not_share'),
            });
        }
    };

    const handleSaveToGallery = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!imageUri) return;

        setSavingToGallery(true);
        try {
            const { status } = await MediaLibrary.requestPermissionsAsync();
            if (status === 'granted') {
                await MediaLibrary.saveToLibraryAsync(imageUri);
                Toast.show({
                    type: 'success',
                    text1: '✅',
                    text2: t('app.share_saved_to_gallery'),
                });
            } else {
                Toast.show({
                    type: 'error',
                    text1: t('app.error'),
                    text2: t('app.share_gallery_permission'),
                });
            }
        } catch (error) {
            console.error('Save to gallery failed:', error);
            Toast.show({
                type: 'error',
                text1: t('app.error'),
                text2: t('app.could_not_share'),
            });
        } finally {
            setSavingToGallery(false);
            onClose();
        }
    };

    const handleOtherShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await fallbackShare();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.overlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            </TouchableOpacity>

            <View style={styles.bottomSheet}>
                <LinearGradient
                    colors={['#1A0A2E', '#0A001A']}
                    style={styles.sheetContent}
                >
                    {/* Handle bar */}
                    <View style={styles.handleBar} />

                    {/* Title */}
                    <Text style={styles.title}>{t('app.share_modal_title')} 🚀</Text>

                    {/* App share options - horizontal row */}
                    <View style={styles.optionsRow}>
                        {SHARE_OPTIONS.map((option) => (
                            <TouchableOpacity
                                key={option.id}
                                style={styles.optionButton}
                                onPress={() => handleShareToApp(option)}
                                activeOpacity={0.7}
                            >
                                <LinearGradient
                                    colors={option.colors}
                                    style={styles.optionIconWrap}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <MaterialCommunityIcons
                                        name={option.icon as any}
                                        size={28}
                                        color="#FFFFFF"
                                    />
                                </LinearGradient>
                                <Text style={styles.optionLabel} numberOfLines={1}>
                                    {t(option.labelKey)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Save to Gallery */}
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={handleSaveToGallery}
                        activeOpacity={0.7}
                        disabled={savingToGallery}
                    >
                        <View style={[styles.actionIconWrap, { backgroundColor: '#2D1B4E' }]}>
                            {savingToGallery ? (
                                <ActivityIndicator size="small" color="#E0AAFF" />
                            ) : (
                                <MaterialCommunityIcons name="download" size={22} color="#E0AAFF" />
                            )}
                        </View>
                        <Text style={styles.actionLabel}>{t('app.share_save_gallery')}</Text>
                    </TouchableOpacity>

                    {/* Other / More */}
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={handleOtherShare}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.actionIconWrap, { backgroundColor: '#2D1B4E' }]}>
                            <MaterialCommunityIcons name="dots-horizontal" size={22} color="#E0AAFF" />
                        </View>
                        <Text style={styles.actionLabel}>{t('app.share_other')}</Text>
                    </TouchableOpacity>

                    {/* Cancel */}
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelText}>{t('app.cancel_btn')}</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
    },
    bottomSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
    },
    sheetContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(224, 170, 255, 0.2)',
    },
    handleBar: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(224, 170, 255, 0.3)',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 20,
    },
    optionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 20,
    },
    optionButton: {
        alignItems: 'center',
        width: 72,
    },
    optionIconWrap: {
        width: 56,
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        // Glow effect
        shadowColor: '#E0AAFF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    optionLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(224, 170, 255, 0.1)',
        marginVertical: 8,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    actionIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    actionLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#FFFFFF',
    },
    cancelButton: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 16,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
    },
});
