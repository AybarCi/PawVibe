import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Dimensions, Animated } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

const { width, height } = Dimensions.get('window');

interface MatchModalProps {
    visible: boolean;
    onClose: () => void;
    onMessage: () => void;
    myPetImage: string | null;
    targetPetImage: string | null;
    targetPetName: string;
}

export default function MatchModal({ visible, onClose, onMessage, myPetImage, targetPetImage, targetPetName }: MatchModalProps) {
    const { t } = useTranslation();
    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <BlurView intensity={90} tint="dark" style={styles.container}>
                <LinearGradient colors={['rgba(255,0,127,0.2)', 'transparent']} style={styles.glow} />
                
                <View style={styles.content}>
                    <Text style={styles.title}>{t('pawmatch.its_a_match', "IT'S A PAWMATCH!")}</Text>
                    <Text style={styles.subTitle}>{t('pawmatch.match_desc', 'You and {{name}} have liked each other.', { name: targetPetName })}</Text>

                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarWrapper}>
                            <Image 
                                source={myPetImage ? { uri: myPetImage } : require('../../assets/icon.png')} 
                                style={styles.avatar} 
                            />
                        </View>
                        <View style={styles.heartContainer}>
                            <Ionicons name="heart" size={50} color="#FF007F" />
                        </View>
                        <View style={[styles.avatarWrapper, { borderColor: '#00FFFF' }]}>
                            <Image 
                                source={targetPetImage ? { uri: targetPetImage } : require('../../assets/icon.png')} 
                                style={styles.avatar} 
                            />
                        </View>
                    </View>

                    <TouchableOpacity 
                        style={styles.primaryBtn}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                            onMessage();
                        }}
                    >
                        <LinearGradient 
                            colors={['#FF007F', '#FF00FF']} 
                            start={{x: 0, y: 0}} 
                            end={{x: 1, y: 1}} 
                            style={styles.gradientBtn}
                        >
                            <Text style={styles.btnText}>{t('pawmatch.send_message', 'SEND MESSAGE')}</Text>
                            <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                        <Text style={styles.secondaryBtnText}>{t('pawmatch.keep_swiping', 'KEEP SWIPING')}</Text>
                    </TouchableOpacity>
                </View>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    glow: {
        ...StyleSheet.absoluteFillObject,
    },
    content: {
        width: '90%',
        alignItems: 'center',
        padding: 20,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: '#FF007F',
        textAlign: 'center',
        textShadowColor: '#FF007F',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 20,
        marginBottom: 10,
    },
    subTitle: {
        fontSize: 16,
        color: '#D3C4E5',
        textAlign: 'center',
        marginBottom: 50,
    },
    avatarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
    },
    avatarWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#FF007F',
        overflow: 'hidden',
        backgroundColor: '#1A0B2E',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    heartContainer: {
        zIndex: 10,
        marginHorizontal: -20,
        backgroundColor: '#0A001A',
        borderRadius: 40,
        padding: 10,
    },
    primaryBtn: {
        width: '100%',
        height: 60,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 15,
        shadowColor: '#FF007F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 15,
    },
    gradientBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    btnText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
    },
    secondaryBtn: {
        padding: 15,
    },
    secondaryBtnText: {
        color: '#6A4C93',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 1,
    }
});
