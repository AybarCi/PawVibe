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
import Toast from 'react-native-toast-message';
import type { Product, ProductSubscription, PurchaseError, Purchase } from 'react-native-iap';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { logMetaPurchase, logMetaEvent } from '../../lib/metaTracking';
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
    purchasePackage: (productId: string, offerToken?: string) => void;
    restorePurchases: () => Promise<{ success: boolean; restoredCount?: number; error?: string }>;
    clearLastPurchaseSuccess: () => void;
    lastPurchaseSuccess: { transactionId: string; productId: string; profile?: any; isSilent?: boolean; eventType?: 'purchase' | 'restore' | 'silent_restore' | 'replay'; } | null;
}

const IAPContext = createContext<IAPContextState>({
    products: [],
    subscriptions: [],
    isConfigured: false,
    isPurchasing: false,
    purchasePackage: () => { },
    restorePurchases: async () => ({ success: false, restoredCount: 0, error: 'Not initialized' }),
    clearLastPurchaseSuccess: () => { },
    lastPurchaseSuccess: null,
});

export const useIAPContext = () => useContext(IAPContext);

export const IAPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [subscriptions, setSubscriptions] = useState<ProductSubscription[]>([]);
    const [isConfigured, setIsConfigured] = useState(false);
    const [isPurchasing, setIsPurchasing] = useState(false);
    const isPurchasingRef = useRef(false); // 🔍 Sync with state to avoid stale closure in listeners
    const [lastPurchaseSuccess, setLastPurchaseSuccess] = useState<{ transactionId: string; productId: string; profile?: any; isSilent?: boolean; eventType?: 'purchase' | 'restore' | 'silent_restore' | 'replay'; } | null>(null);

    // Sync helper
    const syncIsPurchasing = (val: boolean) => {
        setIsPurchasing(val);
        isPurchasingRef.current = val;
    };

    // Prevent duplicate transaction processing (persistent across restarts)
    const processedTransactions = useRef(new Set<string>());
    // Tracking initiated time: Product ID -> timestamp (Strictly deterministic within 2m window)
    const purchaseInitiatedAt = useRef<Record<string, number>>({});
    const productsRef = useRef<any[]>([]);
    // CRITICAL: Block duplicate UI feedback for the SAME transaction ID in the current app session.
    // This is the ultimate defense against OS-level transaction replays.
    const celebratedInThisSession = useRef(new Set<string>());
    const pendingVerifications = useRef<any[]>([]);

    // 🔄 ARCHITECT-LEVEL: Persistent verification queue for timeout/error cases
    // This prevents "Support Hell" if verification fails after user pays.
    const processPendingVerifications = async () => {
        const stored = await AsyncStorage.getItem('iap_pending_verifications');
        if (!stored) return;
        try {
            const queue: any[] = JSON.parse(stored);
            if (queue.length === 0) return;
            console.log('[IAP] 🔄 Processing', queue.length, 'pending verifications...');
            
            const RNIap = getRNIap();
            const available = await RNIap.getAvailablePurchases();
            
            const updatedQueue = [];
            for (const item of queue) {
                const { receipt, productId, transactionId, platform } = item;
                try {
                    const { error, data } = await supabase.functions.invoke('verify-receipt', {
                        body: { receipt, productId, platform, transactionId }
                    });
                    if (!error && (data?.success || data?.alreadyProcessed)) {
                        console.log('[IAP] 🔄 Background verify success for:', productId);
                        
                        // 🛠️ CRITICAL FIX: Must finish the transaction in the store to unblock future purchases
                        const purchase = available.find((p: any) => p.transactionId === transactionId || p.purchaseToken === receipt);
                        if (purchase) {
                            const isConsumable = !subSkus.includes(productId);
                            await safeFinishTransaction(purchase, isConsumable);
                        }

                        await persistProcessedTx(transactionId);
                        
                        if (!celebratedInThisSession.current.has(transactionId)) {
                            celebratedInThisSession.current.add(transactionId);
                            setLastPurchaseSuccess({
                                transactionId,
                                productId,
                                profile: data?.profile,
                                isSilent: true,
                                eventType: 'replay'
                            });
                        }
                    } else {
                        updatedQueue.push(item); // Keep in queue to retry later
                    }
                } catch (e) {
                    updatedQueue.push(item);
                }
            }
            await AsyncStorage.setItem('iap_pending_verifications', JSON.stringify(updatedQueue));
        } catch (e) {
            console.warn('[IAP] Pending verification error:', e);
        }
    };

    const queueVerification = async (receipt: string, productId: string, transactionId: string) => {
        try {
            const stored = await AsyncStorage.getItem('iap_pending_verifications');
            const queue = stored ? JSON.parse(stored) : [];
            // Dedup queue
            if (queue.some((i: any) => i.transactionId === transactionId)) return;
            
            queue.push({ receipt, productId, transactionId, platform: Platform.OS });
            await AsyncStorage.setItem('iap_pending_verifications', JSON.stringify(queue.slice(-50)));
            console.log('[IAP] 📦 Transaction queued for later verification:', transactionId);
        } catch (e) {
            console.warn('[IAP] Failed to queue verification:', e);
        }
    };

    // Load previously processed transaction IDs and start process queue on mount
    useEffect(() => {
        const loadAndProcess = async () => {
            const stored = await AsyncStorage.getItem('iap_processed_txs');
            if (stored) {
                try {
                    const ids: string[] = JSON.parse(stored);
                    ids.forEach((id) => processedTransactions.current.add(id));
                } catch (e) {}
            }
            await processPendingVerifications();
        };

        loadAndProcess();

        // Periodically check queue while app is running
        const interval = setInterval(processPendingVerifications, 60000);
        return () => clearInterval(interval);
    }, []);

    // Keep productsRef in sync with state for access in listeners
    useEffect(() => {
        productsRef.current = [...products, ...subscriptions];
    }, [products, subscriptions]);

    // Robust transaction completion with retries
    const safeFinishTransaction = async (purchase: Purchase, isConsumable: boolean, retries = 3) => {
        const RNIap = getRNIap();
        for (let i = 0; i < retries; i++) {
            try {
                await RNIap.finishTransaction({ purchase, isConsumable });
                return;
            } catch (e) {
                console.warn(`[IAP] finishTransaction attempt ${i + 1} failed:`, e);
                if (i === retries - 1) {
                    console.error('[IAP] CRITICAL: finishTransaction failed after all retries — store queue might be stuck');
                    throw e;
                }
                await new Promise(res => setTimeout(res, 500));
            }
        }
    };

    // Persist processed transactions helper
    const persistProcessedTx = async (txId: string) => {
        processedTransactions.current.add(txId);
        // Keep only the last 500 to avoid unbounded growth while maintaining a safe history
        const all = Array.from(processedTransactions.current).slice(-500);
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
                productsRef.current = [...normalizedConsumables, ...normalizedSubs];
                setIsConfigured(true);
                console.log('[IAP] Configured — Products:', normalizedConsumables.length, 'Subs:', normalizedSubs.length);

                // === SILENT RESTORE ===
                // Automatically check store for active subscriptions on app startup.
                // This ensures premium status is restored without user interaction.
                try {
                    const purchases = await RNIap.getAvailablePurchases();
                    if (purchases && purchases.length > 0) {
                        console.log('[IAP] Silent restore: found', purchases.length, 'purchase(s)');

                        for (const purchase of purchases) {
                            const pid = purchase.productId;
                            // Only check subscriptions — consumables are already consumed
                            if (!subSkus.includes(pid)) continue;

                            const receipt = (purchase as any).transactionReceipt || purchase.purchaseToken || (purchase as any).dataAndroid;
                            // STRICT ID Extraction: No unsafe Date.now() fallback to avoid dedup breaks
                            const txId = purchase.id || purchase.transactionId || purchase.purchaseToken || (purchase as any).orderId;
                            if (!receipt || !txId) {
                                console.error('[IAP] Silent restore: No stable transaction ID found for', pid);
                                continue;
                            }

                            // Skip if already processed
                            if (processedTransactions.current.has(txId)) {
                                console.log('[IAP] Silent restore: already processed tx:', txId);
                                continue;
                            }

                            const { data: { session } } = await supabase.auth.getSession();
                            if (!session) continue; // Skip to next purchase instead of breaking the entire loop

                            const { error, data } = await supabase.functions.invoke('verify-receipt', {
                                body: { receipt, productId: pid, platform: Platform.OS, transactionId: txId }
                            });

                            if (!error && (data?.success || data?.alreadyProcessed)) {
                                await safeFinishTransaction(purchase, false);
                                await persistProcessedTx(txId);
                                console.log('[IAP] Silent restore: verified subscription', pid);

                                // Trigger UI update for the newly restored subscription
                                if (!celebratedInThisSession.current.has(txId)) {
                                    celebratedInThisSession.current.add(txId);
                                    setLastPurchaseSuccess({
                                        transactionId: txId,
                                        productId: pid,
                                        profile: data?.profile,
                                        isSilent: true // DO NOT trigger UI/Confetti during silent startup restore
                                    });
                                }
                            } else {
                                console.warn('[IAP] Silent restore: verify failed for', pid);
                            }
                        }
                    } else {
                        console.log('[IAP] Silent restore: no existing purchases found');
                    }
                } catch (e) {
                    console.warn('[IAP] Silent restore error (non-fatal):', e);
                }
            } catch (err: any) {
                console.warn('[IAP] Init Error:', err.code, err.message);
            }
        };

        initIAP();

        const RNIap = getRNIap();

        const PURCHASE_WINDOW = 300000; // 5m — increased to 300s to handle slow native FaceID/Password flows safely

        // === PURCHASE SUCCESS LISTENER ===
        // This fires when Apple/Google delivers a transaction update.
        const purchaseUpdateSubscription = RNIap.purchaseUpdatedListener(async (purchase: Purchase) => {
            const pid = purchase.productId;
            console.log('[IAP] purchaseUpdatedListener fired for:', pid);

            // 1. Double-Layer Classification (Timestamp + Ref-based State Sync)
            // CRITICAL: We MUST use isPurchasingRef here because the listener is a stale closure 
            // that only sees the initial value of the isPurchasing state.
            const initiatedAt = purchaseInitiatedAt.current[pid];
            const wasUserInitiated = !!(isPurchasingRef.current && initiatedAt && (Date.now() - initiatedAt < PURCHASE_WINDOW));

            try {
                // 2. Receipt Guard & iOS Stuck Queue Fix
                const receipt = (purchase as any).transactionReceipt || purchase.purchaseToken || (purchase as any).dataAndroid;
                if (!receipt) {
                    console.warn('[IAP] No receipt found for product:', pid);
                    if (Platform.OS === 'ios') {
                        try { await safeFinishTransaction(purchase, !subSkus.includes(pid)); } catch (e) { }
                    }
                    return;
                }

                const txId = purchase.id || purchase.transactionId || purchase.purchaseToken || (purchase as any).orderId;
                if (!txId) {
                    console.error('[IAP] CRITICAL ERROR: Transaction received without a stable ID.');
                    return;
                }

                // Client-side dedup
                const isConsumable = !subSkus.includes(pid);
                if (processedTransactions.current.has(txId)) {
                    console.log('[IAP] Already processed tx (client):', txId);
                    try { await safeFinishTransaction(purchase, isConsumable); } catch (e) { }
                    return;
                }

                const { data: { session } } = await supabase.auth.getSession();
                if (!session) throw new Error("User not authenticated.");

                // 3. ⚙️ PRODUCTION HARDENING: Timeout protection
                const timeout = new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("verify_timeout")), 10000)
                );

                try {
                    const verificationResult: any = await Promise.race([
                      supabase.functions.invoke('verify-receipt', {
                          body: { receipt, productId: pid, platform: Platform.OS, transactionId: txId }
                      }),
                      timeout
                    ]);

                    const { error, data } = verificationResult;

                    if (error || (!data?.success && !data?.alreadyProcessed)) {
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
                            Toast.show({ type: 'error', text1: 'Satın Alma Hatası', text2: `Doğrulama hatası: ${errorDetail}` });
                        }
                        
                        // If OS replay failed, finish it to stop retries
                        if (!wasUserInitiated) {
                            try { await safeFinishTransaction(purchase, isConsumable); } catch (e) { }
                        }
                    } else {
                        // Success -> Finish & Persist
                        await safeFinishTransaction(purchase, isConsumable);
                        
                        // Meta Logging
                        try {
                            const productInfo = productsRef.current.find(p => p.productId === pid);
                            const currency = productInfo?.currency || 'USD';
                            const price = Number(productInfo?.price) || 0;
                            if (price > 0) logMetaPurchase(price, currency);
                        } catch (e) { console.warn('[IAP] Meta logging error:', e); }

                        await persistProcessedTx(txId);

                        // 🔐 Event Classification Layer: Final Defense
                        if (!celebratedInThisSession.current.has(txId)) {
                            celebratedInThisSession.current.add(txId);
                            setLastPurchaseSuccess({
                                transactionId: txId,
                                productId: pid,
                                profile: data?.profile,
                                isSilent: !wasUserInitiated,
                                eventType: wasUserInitiated ? 'purchase' : 'replay'
                            });
                        }
                    }
                } catch (err: any) {
                    console.error("[IAP] Verification race/timeout error:", err.message);
                    
                    // 🛡️ Queue for later retry to prevent losing the user's money
                    if (err.message === 'verify_timeout' || err.message === 'Network request failed') {
                        await queueVerification(receipt, pid, txId);
                    }

                    if (wasUserInitiated) {
                        Toast.show({ type: 'error', text1: 'Doğrulama Bekleyen İşlem', text2: 'İnternet/Zaman aşımı nedeniyle işleminiz kuyruğa alındı, arka planda tamamlanacak.' });
                    }
                }
            } catch (e) {
                console.error("[IAP] PurchaseUpdatedListener fatal error:", e);
            } finally {
                delete purchaseInitiatedAt.current[pid];
                if (wasUserInitiated) syncIsPurchasing(false);
            }
        });

        // === PURCHASE ERROR LISTENER ===
        const purchaseErrorSubscription = RNIap.purchaseErrorListener((error: PurchaseError) => {
            console.warn('[IAP] purchaseErrorListener:', error.code, error.message);

            const hasActiveInitiation = Object.keys(purchaseInitiatedAt.current).length > 0;
            if (hasActiveInitiation) {
                Toast.show({
                    type: 'error',
                    text1: 'Satın alma başarısız',
                    text2: error.message || 'Bir hata oluştu.',
                });
            }

            const errCode = error.code as string;
            if (Platform.OS === 'ios' && errCode !== 'E_USER_CANCELLED' && errCode !== 'ERR_USER_CANCELLED') {
                try { RNIap.clearTransactionIOS(); } catch (e) { }
            }
            
            setIsPurchasing(false);
            isPurchasingRef.current = false;
            purchaseInitiatedAt.current = {}; 
        });

        return () => {
            purchaseUpdateSubscription.remove();
            purchaseErrorSubscription.remove();
            RNIap.endConnection();
        };
    }, []);

    // === PURCHASE PACKAGE ===
    // Strictly non-async signature to enforce fire-and-forget pattern
    const purchasePackage = (productId: string, offerToken?: string): void => {
        const RNIap = getRNIap();
        syncIsPurchasing(true);
        // Record initiation timestamp for time-window classification
        purchaseInitiatedAt.current[productId] = Date.now();

        try {
            // v14 Nitro: requestPurchase requires { request: { apple/google: {...} }, type: 'subs' | 'in-app' }
            // The 'request' wrapper and 'type' discriminator are REQUIRED in v14.
            const isSub = subSkus.includes(productId);
            const purchaseType = isSub ? 'subs' : 'in-app';

            if (Platform.OS === 'ios') {
                void RNIap.requestPurchase({
                    request: {
                        apple: { sku: productId },
                    },
                    type: purchaseType,
                });
            } else {
                if (isSub) {
                    void RNIap.requestPurchase({
                        request: {
                            google: {
                                skus: [productId],
                                ...(offerToken ? { subscriptionOffers: [{ sku: productId, offerToken }] } : {}),
                            },
                        },
                        type: purchaseType,
                    });
                } else {
                    void RNIap.requestPurchase({
                        request: {
                            google: { skus: [productId] },
                        },
                        type: purchaseType,
                    });
                }
            }
        } catch (err: any) {
            syncIsPurchasing(false);
            delete purchaseInitiatedAt.current[productId];

            if (Platform.OS === 'ios' && err.code !== 'E_USER_CANCELLED' && err.code !== 'ERR_USER_CANCELLED') {
                try { RNIap.clearTransactionIOS(); } catch (e) { }
            }

            if (err.code !== 'E_USER_CANCELLED' && err.code !== 'ERR_USER_CANCELLED') {
                Toast.show({ type: 'error', text1: 'Hata', text2: err.message || 'Satın alma başlatılamadı.' });
            }
        }
    };

    const restorePurchases = async (): Promise<{ success: boolean; restoredCount?: number; error?: string }> => {
        const RNIap = getRNIap();
        try {
            const purchases = await RNIap.getAvailablePurchases();

            // UX Feedback Enhancement: If no purchases in native queue at all -> return specifically
            if (!purchases || purchases.length === 0) {
                return { success: false, error: 'no_purchases' };
            }

            let restoredCount = 0;
            for (const purchase of purchases) {
                const pid = purchase.productId;
                // v14 Nitro: purchaseToken contains the verification data
                let receipt = (purchase as any).transactionReceipt || purchase.purchaseToken || (purchase as any).dataAndroid;

                // STRICT Extraction: prevent Date.now() collisions
                const txId = purchase.id || purchase.transactionId || purchase.purchaseToken || (purchase as any).orderId;

                // Dedup check: Skip if already handled to avoid redundant backend calls
                if (txId && processedTransactions.current.has(txId)) {
                    console.log('[IAP] Restore: skipping already processed tx:', txId);
                    // Don't count as "restored" for the feedback logic (it's already here)
                    continue;
                }

                if (receipt && txId) {
                    const { error, data } = await supabase.functions.invoke('verify-receipt', {
                        body: {
                            receipt,
                            productId: pid,
                            platform: Platform.OS,
                            transactionId: txId
                        }
                    });

                    if (!error && (data?.success || data?.alreadyProcessed)) {
                        const isConsumable = !subSkus.includes(pid);
                        await safeFinishTransaction(purchase, isConsumable);
                        await persistProcessedTx(txId);
                        setLastPurchaseSuccess({
                            transactionId: txId,
                            productId: pid,
                            profile: data?.profile,
                            isSilent: processedTransactions.current.has(txId), // manual restore is silent if already in processed list
                            eventType: processedTransactions.current.has(txId) ? 'replay' : 'restore'
                        });

                        // FEEDBACK LOGIC: Now handled by components by listening for lastPurchaseSuccess
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

            // SUCCESS logic: manual restore is successful if we didn't throw, 
            // but we provide restoredCount for specific UX messages
            return { success: true, restoredCount };
        } catch (err: any) {
            console.warn("[IAP] Restore error:", err);
            return { success: false, error: err.message };
        }
    };

    const clearLastPurchaseSuccess = () => setLastPurchaseSuccess(null);

    return (
        <IAPContext.Provider value={{
            products,
            subscriptions,
            isConfigured,
            isPurchasing,
            purchasePackage,
            restorePurchases,
            clearLastPurchaseSuccess,
            lastPurchaseSuccess
        }}>
            {children}
        </IAPContext.Provider>
    );
};
