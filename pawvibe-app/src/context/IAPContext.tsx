/**
 * IAPContext — react-native-iap v14 Architecture
 *
 * CRITICAL v14 RULES (from proven working implementation):
 * - Use fetchProducts() to fetch both consumables AND subscriptions
 * - requestPurchase is FIRE-AND-FORGET — do NOT await it
 * - Purchase success comes ONLY through purchaseUpdatedListener
 * - Purchase errors come through purchaseErrorListener
 * - finishTransaction must be called after receipt verification
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import type { Product, ProductSubscription, PurchaseError, Purchase } from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { IAP_PRODUCTS, itemSkus, subSkus } from '../../lib/iap';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Only mock IAP in Expo Go development environment
// ExecutionEnvironment.StoreClient covers BOTH Expo Go AND real App Store builds, so we must NOT use it here
const isExpoGo = Constants.appOwnership === 'expo';

let cachedRNIap: any = null;

const getRNIap = () => {
    if (cachedRNIap) return cachedRNIap;

    if (isExpoGo) {
        cachedRNIap = {
            initConnection: async () => false,
            endConnection: () => { },
            fetchProducts: async () => [],
            purchaseUpdatedListener: () => ({ remove: () => { } }),
            purchaseErrorListener: () => ({ remove: () => { } }),
            requestPurchase: async () => {
                console.warn("IAP is not supported in Expo Go");
                throw new Error("IAP is not supported in Expo Go");
            },
            finishTransaction: async () => { },
            getAvailablePurchases: async () => [],
        };
    } else {
        try {
            cachedRNIap = require('react-native-iap');
        } catch (e) {
            console.warn("Failed to load react-native-iap", e);
            cachedRNIap = {};
        }
    }
    return cachedRNIap;
};

interface IAPContextState {
    products: Product[];
    subscriptions: ProductSubscription[];
    isConfigured: boolean;
    isPurchasing: boolean;
    purchasePackage: (productId: string, offerToken?: string) => Promise<void>;
    restorePurchases: () => Promise<{ success: boolean; error?: string }>;
    clearLastPurchaseSuccess: () => void;
    lastPurchaseSuccess: { timestamp: number; productId: string; profile?: any; } | null;
}

const IAPContext = createContext<IAPContextState>({
    products: [],
    subscriptions: [],
    isConfigured: false,
    isPurchasing: false,
    purchasePackage: async () => { },
    restorePurchases: async () => ({ success: false, error: 'Not initialized' }),
    clearLastPurchaseSuccess: () => { },
    lastPurchaseSuccess: null,
});

export const useIAPContext = () => useContext(IAPContext);

export const IAPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
    const [isConfigured, setIsConfigured] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const [lastPurchaseSuccess, setLastPurchaseSuccess] = useState<{ timestamp: number; productId: string; profile?: any; } | null>(null);

    // Prevent duplicate transaction processing (persistent across restarts)
    const processedTransactions = useRef(new Set<string>());
    // Track whether user actively initiated a purchase (vs. replayed transaction)
    const userInitiatedPurchaseRef = useRef(false);

    // Load previously processed transaction IDs from storage on mount
    useEffect(() => {
        AsyncStorage.getItem('iap_processed_txs').then((stored) => {
            if (stored) {
                try {
                    const ids: string[] = JSON.parse(stored);
                    ids.forEach((id) => processedTransactions.current.add(id));
                    console.log('[IAP] Loaded', ids.length, 'processed transaction IDs from storage');
                } catch (e) {
                    console.warn('[IAP] Failed to parse stored tx IDs:', e);
                }
            }
        });
    }, []);

    // Persist processed transactions helper
    const persistProcessedTx = async (txId: string) => {
        processedTransactions.current.add(txId);
        // Keep only the last 100 to avoid unbounded growth
        const all = Array.from(processedTransactions.current).slice(-100);
        await AsyncStorage.setItem('iap_processed_txs', JSON.stringify(all));
    };

    useEffect(() => {
        const initIAP = async () => {
            const RNIap = getRNIap();
            try {
                const connected = await RNIap.initConnection();
                if (!connected) {
                    console.warn('[IAP] initConnection returned false');
                    return;
                }
                console.log('[IAP] Connected to store');

                // react-native-iap v14: use fetchProducts() with type parameter
                // getProducts() and getSubscriptions() are REMOVED in v14
                const allSkus = [...itemSkus, ...subSkus];
                let allItems: any[] = [];

                try {
                    allItems = await RNIap.fetchProducts({ skus: allSkus, type: 'all' });
                    console.log('[IAP] fetchProducts returned:', allItems.map((p: any) => ({ id: p.productId || p.id, type: p.type })));
                } catch (err: any) {
                    console.warn('[IAP] Error fetching products:', err.message);
                }

                // Separate consumables from subscriptions based on type or productId
                const consumables = allItems.filter((item: any) => {
                    const id = item.productId || item.id;
                    return item.type === 'in-app' || item.type === 'inapp' || itemSkus.includes(id);
                });
                const subs = allItems.filter((item: any) => {
                    const id = item.productId || item.id;
                    return item.type === 'subs' || subSkus.includes(id);
                });

                // Normalize product IDs (v14 uses 'id' instead of 'productId')
                const normalizeProduct = (item: any) => ({
                    ...item,
                    productId: item.productId || item.id,
                    localizedPrice: item.localizedPrice || item.displayPrice,
                });

                const normalizedConsumables = consumables.map(normalizeProduct);
                const normalizedSubs = subs.map(normalizeProduct);

                setProducts(normalizedConsumables as Product[]);
                setSubscriptions(normalizedSubs as ProductSubscription[]);
                setIsConfigured(true);
                console.log('[IAP] Configured — Products:', normalizedConsumables.length, 'Subs:', normalizedSubs.length);

                // Flush old failed iOS transactions so the user isn't locked out of retrying
                if (Platform.OS === 'ios') {
                    try {
                        await RNIap.clearTransactionIOS();
                    } catch (e) {
                        // Ignore errors here
                    }
                }
            } catch (err: any) {
                console.warn('[IAP] Init Error:', err.code, err.message);
            }
        };

        initIAP();

        const RNIap = getRNIap();

        // === PURCHASE SUCCESS LISTENER ===
        // This fires when Apple/Google delivers a transaction update.
        // It can fire for:
        //   1. New purchases the user just made (userInitiatedPurchaseRef = true)
        //   2. Replayed/unfinished transactions from previous sessions (userInitiatedPurchaseRef = false)
        // We handle both cases safely using dual-layer deduplication.
        const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
            const pid = purchase.productId;
            console.log('[IAP] purchaseUpdatedListener fired for:', pid);

            // Capture at entry — stale replayed transactions will have false,
            // user-initiated purchases will have true. This prevents race conditions.
            const wasUserInitiated = userInitiatedPurchaseRef.current;

            try {
                // v14 Nitro: purchaseToken contains the verification data (receipt or JWS)
                // Using this directly avoids triggering the Apple ID password prompt loop
                let receipt = purchase.purchaseToken || (purchase as any).transactionReceipt;

                if (!receipt) {
                    console.warn('[IAP] No receipt found for product:', pid);
                    return;
                }

                // Dedup ID
                const txId = purchase.id || purchase.transactionId || purchase.purchaseToken;
                if (!txId) return;

                // CLIENT-SIDE DEDUP
                if (processedTransactions.current.has(txId)) {
                    console.log('[IAP] Already processed tx (client):', txId);
                    const isConsumable = !subSkus.includes(pid);
                    try { await RNIap.finishTransaction({ purchase, isConsumable }); } catch (e) { }
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("User not authenticated.");

                // SERVER-SIDE verification
                const { error, data } = await supabase.functions.invoke('verify-receipt', {
                    body: {
                        receipt,
                        productId: pid,
                        platform: Platform.OS,
                        transactionId: txId
                    }
                });

                if (error || !data?.success) {
                    let errorDetail = 'Unknown error';
                    if (error) {
                        try {
                            const errorBody = await error.context.json();
                            errorDetail = errorBody.error || errorBody.message || error.message;
                        } catch (e) {
                            errorDetail = error.message;
                        }
                    } else if (data?.error) {
                        errorDetail = data.error;
                    }
                    console.error('[IAP] Backend Verification Failed:', errorDetail);

                    if (wasUserInitiated) {
                        Alert.alert("Satın Alma Hatası", `Doğrulama hatası: ${errorDetail}`);
                    }

                    if (!wasUserInitiated) {
                        const isConsumable = !subSkus.includes(pid);
                        try { await RNIap.finishTransaction({ purchase, isConsumable }); } catch (e) { }
                    }
                } else {
                    // Verification OK — finish transaction so Apple/Google knows we delivered
                    const isConsumable = !subSkus.includes(pid);
                    await RNIap.finishTransaction({ purchase, isConsumable });
                    console.log('[IAP] Transaction finished. ProductId:', pid);

                    // Persist to prevent future replay processing
                    await persistProcessedTx(txId);

                    // Show toast/confetti for successful, non-duplicate purchases.
                    // Server returns 'Already processed' for duplicate transactions.
                    const isAlreadyProcessed = data?.message === 'Already processed';
                    if (!isAlreadyProcessed) {
                        setLastPurchaseSuccess({
                            timestamp: Date.now(),
                            productId: pid,
                            profile: data?.profile // Include the updated profile from backend
                        });
                    } else {
                        console.log('[IAP] Already-processed tx — no UI feedback:', txId);
                    }
                }
            } catch (e) {
                console.error("[IAP] Purchase processing error:", e);
            } finally {
                // ONLY reset purchase state for user-initiated purchases.
                // Stale transactions from previous sessions must NOT touch these flags,
                // otherwise they race with the user's current purchase attempt.
                if (wasUserInitiated) {
                    setIsPurchasing(false);
                    userInitiatedPurchaseRef.current = false;
                }
            }
        });

        // === PURCHASE ERROR LISTENER ===
        // This fires on user cancellation, card declined, etc.
        const purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
            console.warn('[IAP] purchaseErrorListener:', error.code, error.message);
            // Must finish transaction on error to prevent iOS queue lockup
            if (Platform.OS === 'ios') {
                try {
                    // Attempt to pop any stuck transaction
                    RNIap.clearTransactionIOS();
                } catch (e) { }
            }
            if (userInitiatedPurchaseRef.current) {
                setIsPurchasing(false);
                userInitiatedPurchaseRef.current = false;
            }
        });

        return () => {
            purchaseUpdateSubscription.remove();
            purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, []);

    // === PURCHASE PACKAGE ===
    const purchasePackage = async (productId: string, offerToken?: string): Promise<void> => {
        const RNIap = getRNIap();
        setIsPurchasing(true);
        userInitiatedPurchaseRef.current = true;

        try {
            const isSub = subSkus.includes(productId);

            if (isSub) {
                // Subscription: iOS v14 Nitro explicitly requires requestSubscription
                if (Platform.OS === 'ios') {
                    await RNIap.requestSubscription({ sku: productId });
                } else {
                    await RNIap.requestSubscription({
                        sku: productId,
                        ...(offerToken ? { subscriptionOffers: [{ sku: productId, offerToken }] } : {})
                    });
                }
            } else {
                // Consumable (Credits): iOS v14 Nitro requires the 'request.apple' object structure
                if (Platform.OS === 'ios') {
                    await RNIap.requestPurchase({
                        request: { apple: { sku: productId } },
                        type: 'in-app'
                    });
                } else {
                    await RNIap.requestPurchase({ skus: [productId], type: 'in-app' });
                }
            }
        } catch (err: any) {
            setIsPurchasing(false);
            userInitiatedPurchaseRef.current = false;

            if (Platform.OS === 'ios') {
                try { await RNIap.clearTransactionIOS(); } catch (e) { }
            }

            if (err.code !== 'E_USER_CANCELLED' && err.code !== 'ERR_USER_CANCELLED') {
                throw err;
            }
        }
    };

    const restorePurchases = async (): Promise<{ success: boolean; error?: string }> => {
        const RNIap = getRNIap();
        try {
            const purchases = await RNIap.getAvailablePurchases();

            if (!purchases || purchases.length === 0) {
                return { success: false, error: 'no_purchases' };
            }

            let restoredCount = 0;
            for (const purchase of purchases) {
                const pid = purchase.productId;
                // v14 Nitro: purchaseToken contains the verification data
                let receipt = purchase.purchaseToken || (purchase as any).transactionReceipt;

                const txId = purchase.id || purchase.transactionId || purchase.purchaseToken;

                if (receipt && txId) {
                    const { error, data } = await supabase.functions.invoke('verify-receipt', {
                        body: {
                            receipt,
                            productId: pid,
                            platform: Platform.OS,
                            transactionId: txId
                        }
                    });

                    if (!error && data?.success) {
                        await RNIap.finishTransaction({
                            purchase,
                            isConsumable: !subSkus.includes(pid)
                        });
                        setLastPurchaseSuccess({ timestamp: Date.now(), productId: pid });
                        restoredCount++;
                    } else {
                        let errorDetail = 'Unknown error';
                        if (error) {
                            try {
                                const errorBody = await error.context.json();
                                errorDetail = errorBody.error || errorBody.message || error.message;
                            } catch (e) {
                                errorDetail = error.message;
                            }
                        } else {
                            errorDetail = data?.error || 'Validation failed';
                        }
                        console.warn('[IAP] Restore verify failed:', pid, errorDetail);
                    }
                }
            }

            if (restoredCount > 0) {
                return { success: true };
            } else {
                return { success: false, error: 'already_restored' };
            }
        } catch (err: any) {
            console.warn("[IAP] Restore error:", err);
            return { success: false, error: err.message };
        }
    };

    const clearLastPurchaseSuccess = () => setLastPurchaseSuccess(null);

    return (
        <IAPContext.Provider value={{ products, subscriptions, isConfigured, isPurchasing, purchasePackage, restorePurchases, clearLastPurchaseSuccess, lastPurchaseSuccess }}>
            {children}
        </IAPContext.Provider>
    );
};
