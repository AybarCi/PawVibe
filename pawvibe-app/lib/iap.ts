import { Platform } from 'react-native';

export const IAP_PRODUCTS = {
    SNACK_PACK: "pawvibe_snack_pack",
    PARTY_PACK: "pawvibe_party_pack",
    PREMIUM_UNLIMITED: "pawvibe_premium_monthly"
};

export const itemSkus = Platform.select({
    ios: [
        IAP_PRODUCTS.SNACK_PACK,
        IAP_PRODUCTS.PARTY_PACK
    ],
    android: [
        IAP_PRODUCTS.SNACK_PACK,
        IAP_PRODUCTS.PARTY_PACK
    ]
}) || [];

export const subSkus = Platform.select({
    ios: [
        IAP_PRODUCTS.PREMIUM_UNLIMITED
    ],
    android: [
        IAP_PRODUCTS.PREMIUM_UNLIMITED
    ]
}) || [];
