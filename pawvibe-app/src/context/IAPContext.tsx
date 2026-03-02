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
import { Platform } from 'react-native';
import type { Product, ProductSubscription, PurchaseError, Purchase } from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { IAP_PRODUCTS, itemSkus, subSkus } from '../../lib/iap';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

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
    lastPurchaseSuccess: { timestamp: number; productId: string; } | null;
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
    const [lastPurchaseSuccess, setLastPurchaseSuccess] = useState<{ timestamp: number; productId: string; } | null>(null);

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

                // Fetch ALL products in one shot — no type filter.
                // Separate by type field locally. This is the most reliable approach.
                const allSkus = [...itemSkus, ...subSkus];
                console.log('[IAP] Fetching SKUs:', allSkus);

                const allFetched = await RNIap.fetchProducts({ skus: allSkus });

                const consumables = (allFetched || []).filter((p: any) => p.type === 'in-app');
                const subs = (allFetched || []).filter((p: any) => p.type === 'subs');

                console.log('[IAP] Consumables found:', consumables.map((p: any) => p.id));
                console.log('[IAP] Subscriptions found:', subs.map((p: any) => p.id));

                // If the single fetch didn't find subscriptions, try fetching them separately
                if (subs.length === 0 && subSkus.length > 0) {
                    console.log('[IAP] No subscriptions in combined fetch, trying separate fetch with type:subs...');
                    try {
                        const subFetched = await RNIap.fetchProducts({ skus: subSkus, type: 'subs' });
                        if (subFetched && subFetched.length > 0) {
                            console.log('[IAP] Separate subs fetch found:', subFetched.map((p: any) => p.id));
                            subs.push(...subFetched);
                        } else {
                            console.warn('[IAP] Separate subs fetch also returned empty. Check App Store Connect!');
                        }
                    } catch (subErr: any) {
                        console.warn('[IAP] Separate subs fetch error:', subErr.message);
                    }
                }

                setProducts(consumables as Product[]);
                setSubscriptions(subs as ProductSubscription[]);
                setIsConfigured(true);
                console.log('[IAP] Configured and ready');
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
            console.log('[IAP] purchaseUpdatedListener fired for:', purchase.productId);

            // Capture at entry — stale replayed transactions will have false,
            // user-initiated purchases will have true. This prevents race conditions.
            const wasUserInitiated = userInitiatedPurchaseRef.current;

            try {
                // Validate that we have a real transaction receipt (iOS) or token (Android)
                const receipt = Platform.OS === 'ios'
                    ? (purchase as any).transactionReceipt || purchase.purchaseToken
                    : purchase.purchaseToken;
                if (!receipt) {
                    console.warn('[IAP] No receipt/token found, skipping:', purchase.productId);
                    return;
                }

                const txId = purchase.transactionId || purchase.purchaseToken;
                if (!txId) return;

                // CLIENT-SIDE DEDUP: Already processed this transaction before?
                if (processedTransactions.current.has(txId)) {
                    console.log('[IAP] Transaction already processed (client), finishing silently:', txId);
                    // Still finish the transaction so iOS stops replaying it
                    const isConsumable = !subSkus.includes(purchase.productId);
                    try { await RNIap.finishTransaction({ purchase, isConsumable }); } catch (e) { /* ignore */ }
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("User not authenticated.");

                // SERVER-SIDE verification — this updates the database
                const { error, data } = await supabase.functions.invoke('verify-receipt', {
                    body: {
                        receipt,
                        productId: purchase.productId,
                        platform: Platform.OS,
                        transactionId: purchase.transactionId || purchase.purchaseToken
                    }
                });

                if (error || !data?.success) {
                    console.error('[IAP] Receipt verification failed:', error || data?.error);
                    // Don't finish transaction so it can be retried
                } else {
                    // Verification OK — finish transaction so Apple/Google knows we delivered
                    const isConsumable = !subSkus.includes(purchase.productId);
                    await RNIap.finishTransaction({ purchase, isConsumable });
                    console.log('[IAP] Transaction finished. ProductId:', purchase.productId);

                    // Persist to prevent future replay processing
                    await persistProcessedTx(txId);

                    // Show toast/confetti for successful, non-duplicate purchases.
                    // Server returns 'Already processed' for duplicate transactions.
                    const isAlreadyProcessed = data?.message === 'Already processed';
                    if (!isAlreadyProcessed) {
                        setLastPurchaseSuccess({ timestamp: Date.now(), productId: purchase.productId });
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
            setIsPurchasing(false);
            userInitiatedPurchaseRef.current = false;
            // User cancellation is silent — no need to show error
        });

        return () => {
            purchaseUpdateSubscription.remove();
            purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, []);

    // === PURCHASE PACKAGE ===
    // We await requestPurchase for the native payment flow to complete,
    // but we do NOT treat its resolution as "purchase success".
    // Actual success comes ONLY through purchaseUpdatedListener above.
    const purchasePackage = async (productId: string, offerToken?: string): Promise<void> => {
        const RNIap = getRNIap();
        setIsPurchasing(true);
        userInitiatedPurchaseRef.current = true;

        try {
            if (productId === IAP_PRODUCTS.PREMIUM_UNLIMITED) {
                // Subscription purchase
                await RNIap.requestPurchase({
                    request: {
                        apple: { sku: productId },
                        google: {
                            skus: [productId],
                            ...(offerToken && {
                                subscriptionOffers: [{ sku: productId, offerToken }]
                            })
                        },
                    },
                    type: 'subs'
                });
            } else {
                // Consumable purchase
                await RNIap.requestPurchase({
                    request: {
                        apple: { sku: productId },
                        google: { skus: [productId] },
                    },
                    type: 'in-app'
                });
            }
            // requestPurchase resolved — this means the native payment flow completed.
            // But we do NOT update UI here. The purchaseUpdatedListener handles
            // receipt verification, database updates, and triggers lastPurchaseSuccess.
            console.log('[IAP] requestPurchase resolved for:', productId);
        } catch (err: any) {
            console.warn('[IAP] requestPurchase error:', err.code, err.message);
            setIsPurchasing(false);
            // Re-throw non-cancellation errors so the UI can show them
            if (err.code !== 'E_USER_CANCELLED') {
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
                // iOS uses transactionReceipt, Android uses purchaseToken
                const receipt = Platform.OS === 'ios'
                    ? (purchase as any).transactionReceipt || purchase.purchaseToken
                    : purchase.purchaseToken;
                if (receipt) {
                    const { error, data } = await supabase.functions.invoke('verify-receipt', {
                        body: {
                            receipt,
                            productId: purchase.productId,
                            platform: Platform.OS,
                            transactionId: purchase.transactionId
                        }
                    });
                    // Only finish transaction if verify succeeded — matches listener pattern
                    if (!error && data?.success) {
                        await RNIap.finishTransaction({
                            purchase,
                            isConsumable: !subSkus.includes(purchase.productId)
                        });
                        setLastPurchaseSuccess({ timestamp: Date.now(), productId: purchase.productId });
                        restoredCount++;
                    } else {
                        console.warn('[IAP] Restore verify failed for:', purchase.productId, error || data?.error);
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
