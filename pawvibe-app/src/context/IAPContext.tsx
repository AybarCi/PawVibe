import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as RNIap from 'react-native-iap';
import type { Product, ProductSubscription, PurchaseError, Purchase } from 'react-native-iap';
import { supabase } from '../../lib/supabase';
import { IAP_PRODUCTS, itemSkus, subSkus } from '../../lib/iap';

interface IAPContextState {
    products: Product[];
    subscriptions: ProductSubscription[];
    isConfigured: boolean;
    purchasePackage: (productId: string, offerToken?: string) => Promise<{ success: boolean; error?: string }>;
    restorePurchases: () => Promise<{ success: boolean; error?: string }>;
    lastPurchaseSuccess: number;
}

const IAPContext = createContext<IAPContextState>({
    products: [],
    subscriptions: [],
    isConfigured: false,
    purchasePackage: async () => ({ success: false, error: 'Not initialized' }),
    restorePurchases: async () => ({ success: false, error: 'Not initialized' }),
    lastPurchaseSuccess: 0,
});

export const useIAP = () => useContext(IAPContext);

export const IAPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
    const [isConfigured, setIsConfigured] = useState(false);
    const [lastPurchaseSuccess, setLastPurchaseSuccess] = useState(0);

    useEffect(() => {
        const initIAP = async () => {
            try {
                // Initialize the RNIap library
                const connected = await RNIap.initConnection();
                if (!connected) {
                    console.warn('IAP Initialization returned false');
                    return;
                }

                if (Platform.OS === 'android') {
                    // v14 doesn't have flushFailedPurchasesCachedAsPendingAndroid directly under RNIap in the same way,
                    // safe to remove for now as initConnection in v14 handles initialization robustly.
                }

                // Fetch available consumables
                const fetchedProducts = await RNIap.fetchProducts({ skus: itemSkus, type: 'in-app' });
                setProducts(fetchedProducts as Product[]);

                // Fetch available subscriptions
                const fetchedSubscriptions = await RNIap.fetchProducts({ skus: subSkus, type: 'subs' });
                setSubscriptions(fetchedSubscriptions as ProductSubscription[]);

                setIsConfigured(true);
            } catch (err: any) {
                console.warn('IAP Init Error:', err.code, err.message);
            }
        };

        initIAP();

        // Listener for when a purchase successfully completes on the native side
        const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
            const receipt = purchase.purchaseToken; // v14 uses unified purchaseToken for both iOS JWS and Android purchase token
            if (receipt) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!session) throw new Error("User not authenticated.");

                    // Verify the receipt locally using our Supabase Edge Function
                    const { error, data } = await supabase.functions.invoke('verify-receipt', {
                        body: {
                            receipt,
                            productId: purchase.productId,
                            platform: Platform.OS,
                            transactionId: purchase.transactionId || purchase.purchaseToken
                        }
                    });

                    if (error || !data?.success) {
                        console.error('Receipt verification failed', error || data?.error);
                        // Do NOT finish the transaction, so the user/device can retry later
                    } else {
                        // Verification successful, finish the transaction so Apple/Google knows we delivered the goods
                        await RNIap.finishTransaction({
                            purchase,
                            isConsumable: purchase.productId !== IAP_PRODUCTS.PREMIUM_UNLIMITED
                        });
                        setLastPurchaseSuccess(Date.now());
                    }
                } catch (e) {
                    console.error("Purchase processing error", e);
                }
            }
        });

        // Listener for native purchase errors (e.g. user cancelled, card declined)
        const purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
            console.warn('purchaseErrorListener', error);
        });

        return () => {
            purchaseUpdateSubscription.remove();
            purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, []);

    const purchasePackage = async (productId: string, offerToken?: string): Promise<{ success: boolean; error?: string }> => {
        try {
            if (productId === IAP_PRODUCTS.PREMIUM_UNLIMITED) {
                await RNIap.requestPurchase({
                    request: {
                        apple: { sku: productId },
                        google: {
                            skus: [productId],
                            subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : undefined
                        },
                    },
                    type: 'subs'
                });
            } else {
                await RNIap.requestPurchase({
                    request: {
                        apple: { sku: productId },
                        google: { skus: [productId] },
                    },
                    type: 'in-app'
                });
            }
            // requestPurchase resolves when the native payment sheet completes. 
            // The true success logic that actually gives credits is handled in purchaseUpdatedListener.
            return { success: true };
        } catch (err: any) {
            if (err.code !== 'E_USER_CANCELLED') {
                console.warn("Purchase request error", err);
                return { success: false, error: err.message };
            }
            return { success: false }; // Silent fail for intentional cancellation
        }
    };

    const restorePurchases = async (): Promise<{ success: boolean; error?: string }> => {
        try {
            const purchases = await RNIap.getAvailablePurchases();

            if (purchases && purchases.length > 0) {
                for (const purchase of purchases) {
                    const receipt = purchase.purchaseToken;
                    if (receipt) {
                        await supabase.functions.invoke('verify-receipt', {
                            body: {
                                receipt,
                                productId: purchase.productId,
                                platform: Platform.OS,
                                transactionId: purchase.transactionId
                            }
                        });
                        // Automatically finish transaction during restore
                        await RNIap.finishTransaction({
                            purchase,
                            isConsumable: purchase.productId !== IAP_PRODUCTS.PREMIUM_UNLIMITED
                        });
                        setLastPurchaseSuccess(Date.now());
                    }
                }
            }
            return { success: true };
        } catch (err: any) {
            console.warn("Restore error", err);
            return { success: false, error: err.message };
        }
    };

    return (
        <IAPContext.Provider value={{ products, subscriptions, isConfigured, purchasePackage, restorePurchases, lastPurchaseSuccess }}>
            {children}
        </IAPContext.Provider>
    );
};
