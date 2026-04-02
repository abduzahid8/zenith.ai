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

export const iapService = {
    /**
     * Initialize StoreKit / Google Play connection and set up purchase listeners.
     * Must be called once on app start (e.g. in root _layout).
     */
    setup: async (callbacks: PurchaseCallbacks): Promise<boolean> => {
        if (connected) {
            console.log('[IAP] Already connected, skipping setup');
            return true;
        }

        try {
            await initConnection();
            connected = true;
        } catch (err) {
            console.error('[IAP] initConnection failed:', err);
            return false;
        }

        // Register purchase listeners separately — this can fail under Expo Dev Client
        // (Proxy wrapping native modules). App should still work without IAP in that case.
        try {
            purchaseUpdateSub = purchaseUpdatedListener(async (purchase) => {
                try {
                    await finishTransaction({ purchase, isConsumable: false });
                } catch (err) {
                    console.error('[IAP] Error finishing transaction:', err);
                } finally {
                    callbacks.onPurchaseSuccess(purchase);
                }
            });

            purchaseErrorSub = purchaseErrorListener((error) => {
                if (error.code !== ErrorCode.UserCancelled) {
                    console.error('[IAP] Purchase error:', error);
                }
                callbacks.onPurchaseError(error);
            });
        } catch (err) {
            // This typically happens in Expo Dev Client where native modules run behind
            // a JS Proxy that doesn't support StoreKit event listeners.
            // The connection is still alive — purchases will still work via polling.
            console.warn('[IAP] Listener setup failed (likely Dev Client proxy):', err);
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
            fetchProducts({ skus: ALL_SKUS, type: 'subs' });

        try {
            return (await fetchOnce()) ?? [];
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
        if (!connected) {
            throw new Error('IAP not connected');
        }

        try {
            await requestPurchase({
                request: Platform.OS === 'ios' 
                    ? { apple: { sku } }
                    : { android: { skus: [sku] } },
                type: 'subs',
            });
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

        if (connected) {
            try {
                await endConnection();
            } catch (err) {
                console.error('[IAP] Disconnect error:', err);
            }
            connected = false;
        }
    },
};

export default iapService;
