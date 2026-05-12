import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking, Dimensions, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { supabase } from '../../lib/supabase';
import { logMetaEvent } from '../../lib/metaTracking';

interface Recommendation {
    id?: string; // Explicitly add ID
    name: string;
    description: string;
    image_url: string;
    affiliate_url: string;
    target_size?: string;
    target_stage?: string;
}

interface ProductRecommendationsProps {
    recommendations: Recommendation[];
    scanId?: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

const ProductRecommendations: React.FC<ProductRecommendationsProps> = ({ recommendations, scanId }) => {
    const { t } = useTranslation();

    if (!recommendations || recommendations.length === 0) return null;

    const handleProductClick = async (item: any) => {
        if (!item.affiliate_url) return;

        // DEBUG: See what we are sending to Supabase
        console.log('[ProductClick] Tracking Item:', {
            name: item.name,
            id: item.id
        });

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            // 1. Log to Meta Ads for attribution
            logMetaEvent('fb_mobile_add_to_cart', {
                content_id: item.id || item.name,
                content_type: 'product',
                value: 0,
                currency: 'USD'
            });

            // 2. Track in Supabase for internal analytics
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { error } = await supabase.from('recommendation_clicks').insert({
                    user_id: session.user.id,
                    product_id: item.id, 
                    platform: Platform.OS,
                    scan_id: scanId
                });
                if (error) console.error('[ProductClick] Supabase Error:', error);
            }
        } catch (error) {
            console.error('Error tracking click:', error);
        } finally {
            // 3. Always open URL regardless of tracking success
            Linking.openURL(item.affiliate_url).catch(err => console.error("Couldn't load page", err));
        }
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
                        onPress={() => handleProductClick(item)}
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

                            {((item.target_size && item.target_size !== 'all') || (item.target_stage && item.target_stage !== 'all')) && (
                                <View style={styles.targetTagContainer}>
                                    <Text style={styles.targetTagText}>
                                        {item.target_size !== 'all' ? t(`app.size_${item.target_size}`, item.target_size?.toUpperCase()) : ''} 
                                        {item.target_size !== 'all' && item.target_stage !== 'all' ? ' • ' : ''}
                                        {item.target_stage !== 'all' ? t(`app.stage_${item.target_stage}`, item.target_stage?.toUpperCase()) : ''}
                                    </Text>
                                </View>
                            )}
                            
                            <View style={styles.cardContent}>
                                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                                <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
                                
                                <TouchableOpacity 
                                    style={styles.buyButton}
                                    onPress={() => handleProductClick(item)}
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
    },
    targetTagContainer: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(26, 11, 46, 0.8)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FF007F',
    },
    targetTagText: {
        color: '#FF007F',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    }
});

export default ProductRecommendations;
