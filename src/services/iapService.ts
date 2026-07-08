/**
 * IAP Service — thin wrapper around expo-iap for StoreKit subscriptions.
 *
 * Product IDs must match those configured in App Store Connect.
 * This service handles connection lifecycle, product fetching,
 * purchase requests, restore, and transaction finishing.
 */
import { Platform, Linking } from 'react-native';
import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    getAvailablePurchases,
    getActiveSubscriptions,
    hasActiveSubscriptions,
    finishTransaction,
    purchaseUpdatedListener,
    purchaseErrorListener,
    type Purchase,
    type ProductOrSubscription,
    ErrorCode,
} from 'expo-iap';
// Use the errorMapping PurchaseError (code is optional) directly
import type { PurchaseError } from 'expo-iap/build/utils/errorMapping';

// ── Product IDs (App Store Connect & Google Play Console) ─────────────────────

export const PRODUCT_IDS = {
    IOS: {
        MONTHLY: 'com.zenyth.premium.monthly',
        ANNUAL: 'com.zenyth.premium.annual',
    },
    ANDROID: {
        MONTHLY: 'com.zenyth.premium.monthly',
        ANNUAL: 'com.zenyth.premium.annual',
    },
} as const;

// Platform-specific SKU lists
export const IOS_SKUS = [PRODUCT_IDS.IOS.MONTHLY, PRODUCT_IDS.IOS.ANNUAL];
export const ANDROID_SKUS = [PRODUCT_IDS.ANDROID.MONTHLY, PRODUCT_IDS.ANDROID.ANNUAL];
export const ALL_SKUS = Platform.OS === 'ios' ? IOS_SKUS : ANDROID_SKUS;

/** Get the platform-specific SKU for a subscription type */
export const getSku = (type: 'monthly' | 'annual'): string => {
    return Platform.OS === 'ios' 
        ? (type === 'monthly' ? PRODUCT_IDS.IOS.MONTHLY : PRODUCT_IDS.IOS.ANNUAL)
        : (type === 'monthly' ? PRODUCT_IDS.ANDROID.MONTHLY : PRODUCT_IDS.ANDROID.ANNUAL);
};

// ── Types ───────────────────────────────────────────────

export type IAPProduct = ProductOrSubscription;
export type IAPPurchase = Purchase;
export { ErrorCode };

export interface PurchaseCallbacks {
    onPurchaseSuccess: (purchase: Purchase) => void;
    onPurchaseError: (error: PurchaseError) => void;
}

// ── Service ─────────────────────────────────────────────

let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;
let connected = false;
let listenersRegistered = false;
let activeCallbacks: PurchaseCallbacks | null = null;
let lastHandledTransactionId: string | null = null;

/**
 * Returns true only if the transaction was completed within the last 10 minutes.
 * Guards against StoreKit delivering stale unfinished transactions from previous
 * sessions (e.g. another sandbox user on the same device).
 */
function isRecentTransaction(purchase: any): boolean {
    const txDate = purchase?.transactionDate;
    if (!txDate) return true; // no date info — assume it's new
    // transactionDate can be Unix seconds or ms depending on expo-iap version
    const txMs = txDate > 1_000_000_000_000 ? txDate : txDate * 1000;
    return (Date.now() - txMs) < 10 * 60 * 1000;
}

export const iapService = {
    /**
     * Initialize StoreKit / Google Play connection and set up purchase listeners.
     * Must be called once on app start (e.g. in root _layout).
     */
    setup: async (callbacks: PurchaseCallbacks): Promise<boolean> => {
        if (connected) {
            console.log('[IAP] Already connected, skipping setup');
            activeCallbacks = callbacks;
            return true;
        }

        try {
            // Check if the native module exists before attempting connection
            // Use require() to avoid import-time issues with NativeModules in some environments
            let hasNativeModule = false;
            try {
                const RN = require('react-native');
                hasNativeModule = !!(RN.NativeModules?.ExpoIap);
            } catch {}
            if (!hasNativeModule) {
                console.log('[IAP] ExpoIap native module not available — skipping setup');
                return false;
            }

            console.log('[IAP] Connecting to StoreKit...');
            // Timeout initConnection — on simulator or without StoreKit it can hang forever
            await Promise.race([
                initConnection(),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('initConnection timed out after 15s')), 15_000)
                ),
            ]);
            connected = true;
            activeCallbacks = callbacks;
            console.log('[IAP] StoreKit connected successfully');
        } catch (err) {
            console.error('[IAP] initConnection failed:', err);
            return false;
        }

        // Register purchase listeners separately — this can fail under Expo Dev Client
        // (Proxy wrapping native modules). App should still work without IAP in that case.
        listenersRegistered = false;
        try {
            purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
                // Deduplicate: skip if already handled via requestPurchase direct return
                const txId = (purchase as any).transactionId ?? (purchase as any).id ?? null;
                if (txId && txId === lastHandledTransactionId) {
                    console.log('[IAP] Listener: duplicate transaction, skipping');
                    return;
                }

                // Stale transaction guard: finish silently without granting premium
                if (!isRecentTransaction(purchase)) {
                    console.log('[IAP] Listener: stale transaction, finishing silently without granting premium');
                    try { await finishTransaction({ purchase, isConsumable: false }); } catch {}
                    return;
                }

                if (txId) lastHandledTransactionId = txId;
                try {
                    await finishTransaction({ purchase, isConsumable: false });
                } catch (err) {
                    console.error('[IAP] Error finishing transaction:', err);
                } finally {
                    activeCallbacks?.onPurchaseSuccess(purchase);
                }
            });

            purchaseErrorSub = purchaseErrorListener((error) => {
                if (error.code !== ErrorCode.UserCancelled) {
                    console.error('[IAP] Purchase error:', error);
                }
                activeCallbacks?.onPurchaseError(error);
            });
            listenersRegistered = true;
        } catch (err) {
            // This typically happens in Expo Dev Client where native modules run behind
            // a JS Proxy that doesn't support StoreKit event listeners.
            // The connection is still alive — purchases will still work via polling.
            console.warn('[IAP] Listener setup failed (likely Dev Client proxy):', err);
            listenersRegistered = false;
        }

        return connected;
    },

    /**
     * Fetch subscription products from StoreKit / Google Play.
     * Returns an array of Product objects with localized pricing.
     */
    loadSubscriptions: async (): Promise<ProductOrSubscription[]> => {
        if (!connected) return [];

        const fetchOnce = () =>
            Promise.race([
                fetchProducts({ skus: ALL_SKUS, type: 'subs' }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('fetchProducts timed out after 15s')), 15_000)
                ),
            ]);

        try {
            console.log('[IAP] Fetching products for SKUs:', ALL_SKUS);
            const products = (await fetchOnce()) ?? [];
            console.log('[IAP] Products fetched:', products.length, products.map((p: any) => p.id));
            return products;
        } catch (err: any) {
            // StoreKit may not be fully ready immediately after initConnection —
            // wait briefly and retry once before giving up.
            if (err?.message?.toLowerCase().includes('billing is not prepared')) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                try {
                    return (await fetchOnce()) ?? [];
                } catch (retryErr) {
                    console.error('[IAP] Failed to load subscriptions after retry:', retryErr);
                    return [];
                }
            }
            console.error('[IAP] Failed to load subscriptions:', err);
            return [];
        }
    },

    /**
     * Request a subscription purchase. This triggers the native purchase sheet.
     * The result comes back via the purchaseUpdatedListener.
     */
    purchaseSubscription: async (sku: string): Promise<void> => {
        console.log('[IAP] purchaseSubscription called — sku:', sku, 'connected:', connected, 'listenersRegistered:', listenersRegistered);
        if (!connected) {
            throw new Error('IAP not connected. Call initialize() first.');
        }

        // ── Request purchase (with stale-tx retry) ───────────────────────
        // Helper: normalise the raw result from requestPurchase into a
        // single Purchase or null (expo-iap may return Purchase, Purchase[], or []).
        const normalisePurchase = (raw: any): Purchase | null => {
            if (Array.isArray(raw)) return raw.length > 0 ? raw[0] : null;
            return raw ? (raw as Purchase) : null;
        };

        const doRequest = () =>
            Promise.race([
                requestPurchase({
                    request: Platform.OS === 'ios'
                        ? { apple: { sku } }
                        : { android: { skus: [sku] } },
                    type: 'subs',
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(
                        () => reject(Object.assign(new Error('Purchase timed out. Please try again.'), { code: 'E_PURCHASE_TIMEOUT' })),
                        120_000,
                    ),
                ),
            ]);

        try {
            let purchase = normalisePurchase(await doRequest());
            console.log('[IAP] requestPurchase resolved — purchase:', purchase ? 'present' : 'null');

            // If StoreKit returned a stale transaction instead of showing the
            // payment sheet, finish it and retry once.
            if (purchase && !isRecentTransaction(purchase)) {
                console.log('[IAP] Stale transaction returned — finishing and retrying');
                try { await finishTransaction({ purchase, isConsumable: false }); } catch {}
                purchase = normalisePurchase(await doRequest());
                console.log('[IAP] Retry resolved — purchase:', purchase ? 'present' : 'null');

                // Still stale after retry — give up
                if (purchase && !isRecentTransaction(purchase)) {
                    try { await finishTransaction({ purchase, isConsumable: false }); } catch {}
                    throw Object.assign(
                        new Error('No payment sheet appeared. Please try again.'),
                        { code: 'STALE_TRANSACTION' },
                    );
                }
            }

            // ── Process result ────────────────────────────────────────────
            if (purchase) {
                const txId = (purchase as any).transactionId ?? (purchase as any).id ?? null;
                if (txId) lastHandledTransactionId = txId;
                try {
                    await finishTransaction({ purchase, isConsumable: false });
                } catch (err) {
                    console.error('[IAP] Error finishing transaction (direct):', err);
                }
                activeCallbacks?.onPurchaseSuccess(purchase);
            } else if (listenersRegistered) {
                // Normal path: purchase result will arrive via purchaseUpdatedListener.
                console.log('[IAP] No direct result — waiting for listener callback...');
            } else {
                // Listeners failed to register (Dev Client proxy or StoreKit issue).
                // Poll getActiveSubscriptions as a fallback so the user doesn't get stuck.
                console.log('[IAP] No direct result & listeners unavailable — polling for subscription...');
                for (let attempt = 0; attempt < 15; attempt++) {
                    await new Promise<void>(r => setTimeout(r, 2000));
                    try {
                        const active = await getActiveSubscriptions(ALL_SKUS);
                        if (active && active.length > 0) {
                            const latestPurchase = active[0] as any;
                            if (isRecentTransaction(latestPurchase)) {
                                const txId = latestPurchase?.transactionId ?? latestPurchase?.id ?? null;
                                if (txId) lastHandledTransactionId = txId;
                                try { await finishTransaction({ purchase: latestPurchase, isConsumable: false }); } catch {}
                                activeCallbacks?.onPurchaseSuccess(latestPurchase);
                                return;
                            }
                        }
                    } catch {}
                }
                console.warn('[IAP] Fallback polling ended without finding active subscription');
            }
        } catch (err) {
            console.error('[IAP] Purchase request failed:', err);
            throw err;
        }
    },

    /**
     * Restore previous purchases (e.g. after reinstall or new device).
     * Returns an array of restored purchases.
     */
    restorePurchases: async (): Promise<Purchase[]> => {
        if (!connected) return [];

        try {
            const purchases = await getAvailablePurchases();
            // Finish each restored transaction
            for (const purchase of purchases) {
                await finishTransaction({ purchase, isConsumable: false });
            }
            return purchases;
        } catch (err) {
            console.error('[IAP] Restore failed:', err);
            return [];
        }
    },

    /**
     * Check if a subscription from our group is currently active.
     * Uses expo-iap's native getActiveSubscriptions for accurate status.
     */
    checkActiveSubscription: async (): Promise<{
        isActive: boolean;
        productId: string | null;
    }> => {
        if (!connected) {
            return { isActive: false, productId: null };
        }

        try {
            const active = await getActiveSubscriptions(ALL_SKUS);
            if (active && active.length > 0) {
                return {
                    isActive: true,
                    productId: active[0].productId,
                };
            }
            return { isActive: false, productId: null };
        } catch (err) {
            console.error('[IAP] Active subscription check failed:', err);
            return { isActive: false, productId: null };
        }
    },

    /**
     * Quick boolean check for active subscription.
     */
    isSubscriptionActive: async (): Promise<boolean> => {
        if (!connected) return false;

        try {
            return await hasActiveSubscriptions(ALL_SKUS);
        } catch {
            return false;
        }
    },

    /**
     * Open the native subscription management screen.
     * iOS: App Store subscription management
     * Android: Google Play subscription management
     *
     * Uses Linking.openURL instead of deepLinkToSubscriptions to avoid
     * native crashes in TestFlight sandbox environment.
     */
    openManageSubscriptions: async (): Promise<void> => {
        if (Platform.OS === 'ios') {
            try {
                await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
            } catch (err) {
                console.error('[IAP] itms-apps URL failed, trying HTTPS fallback:', err);
                try {
                    await Linking.openURL('https://apps.apple.com/account/subscriptions');
                } catch (fallbackErr) {
                    console.error('[IAP] HTTPS fallback also failed:', fallbackErr);
                }
            }
        } else {
            try {
                await Linking.openURL('https://play.google.com/store/account/subscriptions');
            } catch (err) {
                console.error('[IAP] Failed to open Google Play subscriptions:', err);
            }
        }
    },

    /**
     * Clean up listeners and close connection.
     * Call on app unmount.
     */
    teardown: async (): Promise<void> => {
        purchaseUpdateSub?.remove();
        purchaseErrorSub?.remove();
        purchaseUpdateSub = null;
        purchaseErrorSub = null;
        activeCallbacks = null;
        lastHandledTransactionId = null;
        listenersRegistered = false;

        // Set connected = false BEFORE the async endConnection() call so that
        // a subsequent setup() won't short-circuit with a stale flag.
        const wasConnected = connected;
        connected = false;
        if (wasConnected) {
            try {
                await endConnection();
            } catch (err) {
                console.error('[IAP] Disconnect error:', err);
            }
        }
    },
};

export default iapService;
