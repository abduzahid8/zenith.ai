/**
 * Subscription Store — manages IAP state via Zustand.
 *
 * Initializes the StoreKit connection on app boot, fetches products,
 * checks for active subscriptions, and syncs premium status to
 * the userProfileStore.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import {
    iapService,
    type IAPProduct,
    type IAPPurchase,
    ErrorCode,
} from '../services/iapService';
import type { PurchaseError } from 'expo-iap/build/utils/errorMapping';
import { useUserProfileStore } from './userProfileStore';

// ── Types ───────────────────────────────────────────────

interface SubscriptionState {
    // Products from StoreKit
    products: IAPProduct[];

    // Subscription status
    isActive: boolean;
    activeProductId: string | null;

    // UI state
    isLoading: boolean;
    isPurchasing: boolean;
    isRestoring: boolean;
    error: string | null;

    // Actions
    initialize: () => Promise<void>;
    purchase: (sku: string) => Promise<void>;
    restore: () => Promise<void>;
    checkStatus: () => Promise<void>;
    clearError: () => void;
    reset: () => void;
}

// ── Helpers ─────────────────────────────────────────────

/** Sync premium flag into the user profile store and backend */
function syncPremiumStatus(isActive: boolean) {
    const profileStore = useUserProfileStore.getState();
    if (isActive) {
        profileStore.setSubscriptionLevel('premium');
    } else if (profileStore.subscriptionLevel === 'premium') {
        // Only demote if currently premium (don't touch 'trial' etc.)
        profileStore.setSubscriptionLevel('free');
    }

    // Fire and forget backend sync
    // Lazy imports avoid circular dependencies with authStore
    Promise.resolve().then(async () => {
        try {
            const { useAuthStore } = require('./authStore');
            const { profileService } = require('../services/supabase/profile');
            const userId = useAuthStore.getState().user?.id;

            if (userId) {
                await profileService.updatePremiumStatus(userId, isActive);
                console.log('[subscriptionStore] Synced premium status to backend:', isActive);
            }
        } catch (err) {
            console.error('[subscriptionStore] Failed to sync premium status to backend:', err);
        }
    });
}

// ── Initial state ───────────────────────────────────────

const initialState = {
    products: [] as IAPProduct[],
    isActive: false,
    activeProductId: null as string | null,
    isLoading: false,
    isPurchasing: false,
    isRestoring: false,
    error: null as string | null,
};

// ── Store ───────────────────────────────────────────────

export const useSubscriptionStore = create<SubscriptionState>()(
    persist(
        (set, get) => ({
            ...initialState,

            /**
             * Initialize IAP: connect, load products, check existing subscriptions.
             * Called once from root _layout.tsx on app mount.
             */
            initialize: async () => {
                if (get().isLoading) {
                    console.log('[subscriptionStore] initialize already in progress, skipping');
                    return;
                }
                console.log('[subscriptionStore] initialize started');

                set({ isLoading: true, error: null });

                try {
                    // 1. Set up connection & listeners
                    const connected = await iapService.setup({
                        onPurchaseSuccess: (purchase: IAPPurchase) => {
                            // expo-iap Product uses `id`, but Purchase uses `productId`
                            const purchaseProductId = (purchase as any).productId ?? (purchase as any).id ?? null;
                            console.log('[subscriptionStore] Purchase success - productId:', purchaseProductId);
                            set({
                                isActive: true,
                                activeProductId: purchaseProductId,
                                isPurchasing: false,
                                error: null,
                            });
                            syncPremiumStatus(true);
                        },
                        onPurchaseError: (error: PurchaseError) => {
                            const isCancel = error.code === ErrorCode.UserCancelled;
                            console.log('[subscriptionStore] Purchase error - code:', error.code, 'isCancel:', isCancel);
                            set({
                                isPurchasing: false,
                                error: isCancel ? null : (error.message || 'Ошибка покупки'),
                            });
                        },
                    });

                    if (!connected) {
                        console.log('[subscriptionStore] IAP setup failed - not connected');
                        set({ isLoading: false });
                        return;
                    }
                    console.log('[subscriptionStore] IAP setup connected');

                    // 2. Load available products
                    const products = await iapService.loadSubscriptions();
                    console.log('[subscriptionStore] Products loaded:', products.length);
                    set({ products });

                    // 3. We intentionally DO NOT auto-call checkStatus() here on boot.
                    // Doing so would auto-restore the device's Apple Sandbox receipt to 
                    // EVERY newly created user, and would also instantly demote cross-platform users
                    // who don't have the receipt on their secondary device. 
                    // Restores should only happen when explicitly requested via `restore()`.
                } catch (err) {
                    console.log('[subscriptionStore] Init error:', err);
                    set({ error: 'Не удалось загрузить подписки' });
                } finally {
                    set({ isLoading: false });
                }
            },

            /**
             * Purchase a subscription by SKU.
             */
            purchase: async (sku: string) => {
                console.log('[subscriptionStore] purchase started - sku:', sku);
                if (get().isPurchasing) {
                    console.log('[subscriptionStore] purchase already in progress');
                    return;
                }

                set({ isPurchasing: true, error: null });

                // Safety net: if neither onPurchaseSuccess nor onPurchaseError fires within
                // 130 seconds (10s beyond the iapService timeout), force-reset isPurchasing
                // so the UI never gets permanently stuck in a loading state.
                const safetyTimeoutId = setTimeout(() => {
                    if (get().isPurchasing) {
                        console.warn('[subscriptionStore] Safety timeout reached — resetting isPurchasing');
                        set({ isPurchasing: false, error: 'Purchase timed out. Please try again.' });
                    }
                }, 130_000);

                try {
                    await iapService.purchaseSubscription(sku);
                    // requestPurchase resolved. If isPurchasing is still true,
                    // the result hasn't arrived yet (expected via listener).
                    // Poll as fallback in case the listener doesn't fire.
                    if (get().isPurchasing) {
                        for (let i = 0; i < 15; i++) {
                            await new Promise(r => setTimeout(r, 3000));
                            if (!get().isPurchasing) break; // Listener already fired
                            try {
                                const { isActive, productId } = await iapService.checkActiveSubscription();
                                if (isActive) {
                                    clearTimeout(safetyTimeoutId);
                                    console.log('[subscriptionStore] Fallback poll found active subscription');
                                    set({ isActive, activeProductId: productId, isPurchasing: false, error: null });
                                    syncPremiumStatus(true);
                                    break;
                                }
                            } catch { }
                        }
                        // If polling exhausted without finding subscription, reset isPurchasing
                        // so the UI doesn't stay stuck on "Processing..." until safety timeout.
                        if (get().isPurchasing) {
                            clearTimeout(safetyTimeoutId);
                            console.log('[subscriptionStore] Polling exhausted — resetting isPurchasing');
                            set({ isPurchasing: false });
                        }
                    }
                } catch (_err: any) {
                    clearTimeout(safetyTimeoutId);
                    console.log('[subscriptionStore] purchase error:', _err);
                    const errorMessage = String(_err?.message || '');

                    // Stale transaction was cleared — reset state silently so user can retry
                    if (_err?.code === 'STALE_TRANSACTION') {
                        console.log('[subscriptionStore] Stale transaction cleared, resetting for retry');
                        set({ isPurchasing: false, error: null });
                        return;
                    }

                    // If the user already owns the subscription, process it as a successful restore
                    if (errorMessage.toLowerCase().includes('already owned') || _err?.code === 'E_ALREADY_OWNED' || _err?.code === 'already-owned') {
                        console.log('[subscriptionStore] Item already owned, triggering internal restore');
                        try {
                            await iapService.restorePurchases();
                            const { isActive, productId } = await iapService.checkActiveSubscription();
                            set({
                                isActive,
                                activeProductId: productId,
                                isPurchasing: false,
                                error: null,
                            });
                            syncPremiumStatus(isActive);
                            if (!isActive) {
                                set({ isPurchasing: false, error: 'Подписка не найдена' });
                            } else {
                                // Add visible feedback so the user knows why it "skipped" the payment sheet
                                Alert.alert(
                                    'Подписка восстановлена',
                                    'Ваш Apple ID уже имеет активную подписку. Покупка восстановлена автоматически.'
                                );
                            }
                        } catch (restoreErr) {
                            set({ isPurchasing: false, error: 'Ошибка при восстановлении' });
                        }
                        return;
                    }

                    set({
                        isPurchasing: false,
                        error: _err?.message || 'Не удалось начать покупку'
                    });
                }
            },

            /**
             * Restore previous purchases (e.g. reinstall, new device).
             */
            restore: async () => {
                console.log('[subscriptionStore] restore started');
                if (get().isRestoring) {
                    console.log('[subscriptionStore] restore already in progress');
                    return;
                }

                set({ isRestoring: true, error: null });

                try {
                    // Fetch purchases from Apple/Google to populate the local receipt.
                    await iapService.restorePurchases();
                    // Now check the updated active subscriptions
                    const { isActive, productId } = await iapService.checkActiveSubscription();
                    console.log('[subscriptionStore] restore result - isActive:', isActive, 'productId:', productId);

                    set({
                        isActive,
                        activeProductId: productId,
                    });

                    syncPremiumStatus(isActive);

                    if (!isActive) {
                        Alert.alert(
                            'Подписка не найдена',
                            'Активных подписок не найдено. Если у вас есть подписка, убедитесь, что вы вошли с правильным Apple ID.'
                        );
                    } else {
                        Alert.alert('Готово', 'Подписка успешно восстановлена!');
                    }
                } catch (err) {
                    console.log('[subscriptionStore] restore error:', err);
                    set({ error: 'Не удалось восстановить покупки' });
                } finally {
                    set({ isRestoring: false });
                }
            },

            /**
             * Check for active subscription without user-facing alerts.
             */
            checkStatus: async () => {
                console.log('[subscriptionStore] checkStatus started');
                try {
                    const { isActive, productId } = await iapService.checkActiveSubscription();
                    console.log('[subscriptionStore] checkStatus result - isActive:', isActive, 'productId:', productId);

                    set({
                        isActive,
                        activeProductId: productId,
                    });

                    syncPremiumStatus(isActive);
                } catch (err) {
                    console.log('[subscriptionStore] checkStatus error:', err);
                }
            },

            clearError: () => {
                console.log('[subscriptionStore] clearError called');
                set({ error: null });
            },

            reset: () => {
                console.log('[subscriptionStore] reset called');
                // Tear down the IAP connection so the next initialize() creates a
                // fresh StoreKit connection with new listeners.  Without this,
                // the module-level `connected` flag stays true after sign-out and
                // setup() short-circuits, potentially leaving a dead connection.
                iapService.teardown().catch(() => { });
                set(initialState);
            },
        }),
        {
            name: 'subscription-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // Only persist subscription status, not products or UI state
            partialize: (state) => ({
                isActive: state.isActive,
                activeProductId: state.activeProductId,
            }),
        }
    )
);

// ── Manage Subscription helper ──────────────────────────

export const openManageSubscriptions = (): Promise<void> => {
    return iapService.openManageSubscriptions();
};

export default useSubscriptionStore;
