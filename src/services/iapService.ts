/**
 * IAP Service — thin wrapper around expo-iap for StoreKit subscriptions.
 *
 * Product IDs must match those configured in App Store Connect.
 * This service handles connection lifecycle, product fetching,
 * purchase requests, restore, and transaction finishing.
 */
import { Platform } from 'react-native';
import {
    initConnection,
    endConnection,
    fetchProducts,
    requestPurchase,
    getAvailablePurchases,
    getActiveSubscriptions,
    hasActiveSubscriptions,
    finishTransaction,
    deepLinkToSubscriptions,
    purchaseUpdatedListener,
    purchaseErrorListener,
    type Purchase,
    type ProductOrSubscription,
    ErrorCode,
} from 'expo-iap';
// Use the errorMapping PurchaseError (code is optional) directly
import type { PurchaseError } from 'expo-iap/build/utils/errorMapping';

// ── Product IDs (App Store Connect) ─────────────────────

export const PRODUCT_IDS = {
    MONTHLY: 'com.zenyth.premium.monthly',
    ANNUAL: 'com.zenyth.premium.annual',
} as const;

export const ALL_SKUS = [PRODUCT_IDS.MONTHLY, PRODUCT_IDS.ANNUAL];

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
     * Initialize StoreKit connection and set up purchase listeners.
     * Must be called once on app start (e.g. in root _layout).
     */
    setup: async (callbacks: PurchaseCallbacks): Promise<boolean> => {
        if (Platform.OS !== 'ios') return false;

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
                    callbacks.onPurchaseSuccess(purchase);
                } catch (err) {
                    console.error('[IAP] Error finishing transaction:', err);
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
     * Fetch subscription products from StoreKit.
     * Returns an array of Product objects with localized pricing.
     */
    loadSubscriptions: async (): Promise<ProductOrSubscription[]> => {
        if (Platform.OS !== 'ios' || !connected) return [];

        try {
            const products = await fetchProducts({
                skus: ALL_SKUS,
                type: 'subs',
            });
            return products ?? [];
        } catch (err) {
            console.error('[IAP] Failed to load subscriptions:', err);
            return [];
        }
    },

    /**
     * Request a subscription purchase. This triggers the native StoreKit
     * purchase sheet. The result comes back via the purchaseUpdatedListener.
     */
    purchaseSubscription: async (sku: string): Promise<void> => {
        if (Platform.OS !== 'ios' || !connected) return;

        try {
            await requestPurchase({
                request: {
                    apple: { sku },
                },
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
        if (Platform.OS !== 'ios' || !connected) return [];

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
        if (Platform.OS !== 'ios' || !connected) {
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
        if (Platform.OS !== 'ios' || !connected) return false;

        try {
            return await hasActiveSubscriptions(ALL_SKUS);
        } catch {
            return false;
        }
    },

    /**
     * Open the native iOS subscription management screen.
     */
    openManageSubscriptions: async (): Promise<void> => {
        try {
            await deepLinkToSubscriptions();
        } catch (err) {
            console.error('[IAP] Failed to open subscription management:', err);
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
