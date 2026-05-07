import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface Recommendation {
    name: string;
    description: string;
    image_url: string;
    affiliate_url: string;
}

interface ProductRecommendationsProps {
    recommendations: Recommendation[];
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

const ProductRecommendations: React.FC<ProductRecommendationsProps> = ({ recommendations }) => {
    const { t } = useTranslation();

    if (!recommendations || recommendations.length === 0) return null;

    const handleBuyNow = (url: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <MaterialCommunityIcons name="star-shooting" size={20} color="#FF007F" />
                <Text style={styles.title}>{t('app.picked_for_your_pet', 'PICKED FOR YOUR PET')}</Text>
            </View>
            
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContainer}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + 15}
            >
                {recommendations.map((item, index) => (
                    <TouchableOpacity 
                        key={index} 
                        activeOpacity={0.9}
                        onPress={() => handleBuyNow(item.affiliate_url)}
                        style={styles.card}
                    >
                        <LinearGradient
                            colors={['#1A0B2E', '#0A001A']}
                            style={styles.cardGradient}
                        >
                            <Image 
                                source={{ uri: item.image_url }} 
                                style={styles.productImage}
                                resizeMode="cover"
                            />
                            
                            <View style={styles.cardContent}>
                                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
                                
                                <TouchableOpacity 
                                    style={styles.buyButton}
                                    onPress={() => handleBuyNow(item.affiliate_url)}
                                >
                                    <LinearGradient
                                        colors={['#FF007F', '#6A4C93']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.buyBtnGradient}
                                    >
                                        <Text style={styles.buyBtnText}>{t('app.buy_now', 'BUY NOW')}</Text>
                                        <MaterialCommunityIcons name="arrow-right" size={14} color="#FFF" />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.cornerTL} />
                            <View style={styles.cornerBR} />
                        </LinearGradient>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: width,
        marginTop: 30,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 25,
        marginBottom: 15,
        gap: 8,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 2,
        textShadowColor: '#FF007F',
        textShadowRadius: 10,
    },
    scrollContainer: {
        paddingHorizontal: 20,
        gap: 15,
    },
    card: {
        width: CARD_WIDTH,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 127, 0.3)',
        elevation: 10,
        shadowColor: '#FF007F',
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    cardGradient: {
        flex: 1,
    },
    productImage: {
        width: '100%',
        height: 140,
        backgroundColor: '#000',
        opacity: 0.8,
    },
    cardContent: {
        padding: 15,
    },
    productName: {
        color: '#00FFFF',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    productDesc: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 15,
        height: 32,
    },
    buyButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    buyBtnGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        gap: 8,
    },
    buyBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
    },
    cornerTL: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 15,
        height: 15,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: '#FF007F',
    },
    cornerBR: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 15,
        height: 15,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: '#00FFFF',
    }
});

export default ProductRecommendations;
