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

/** Sync premium flag into the user profile store */
function syncPremiumStatus(isActive: boolean) {
    const profileStore = useUserProfileStore.getState();
    if (isActive) {
        profileStore.setSubscriptionLevel('premium');
    } else if (profileStore.subscriptionLevel === 'premium') {
        // Only demote if currently premium (don't touch 'trial' etc.)
        profileStore.setSubscriptionLevel('free');
    }
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
                if (Platform.OS !== 'ios') return;

                set({ isLoading: true, error: null });

                try {
                    // 1. Set up connection & listeners
                    const connected = await iapService.setup({
                        onPurchaseSuccess: (purchase: IAPPurchase) => {
                            // expo-iap Product uses `id`, but Purchase uses `productId`
                            const purchaseProductId = (purchase as any).productId ?? (purchase as any).id ?? null;
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
                            set({
                                isPurchasing: false,
                                error: isCancel ? null : (error.message || 'Ошибка покупки'),
                            });
                        },
                    });

                    if (!connected) {
                        set({ isLoading: false });
                        return;
                    }

                    // 2. Load available products
                    const products = await iapService.loadSubscriptions();
                    set({ products });

                    // 3. Check for existing active subscription
                    await get().checkStatus();
                } catch (err) {
                    console.error('[SubscriptionStore] Init error:', err);
                    set({ error: 'Не удалось загрузить подписки' });
                } finally {
                    set({ isLoading: false });
                }
            },

            /**
             * Purchase a subscription by SKU.
             */
            purchase: async (sku: string) => {
                if (get().isPurchasing) return;

                set({ isPurchasing: true, error: null });

                try {
                    await iapService.purchaseSubscription(sku);
                    // Result comes via purchaseUpdatedListener → onPurchaseSuccess
                } catch (_err) {
                    set({ isPurchasing: false });
                    // Error is handled by purchaseErrorListener
                }
            },

            /**
             * Restore previous purchases (e.g. reinstall, new device).
             */
            restore: async () => {
                if (get().isRestoring) return;

                set({ isRestoring: true, error: null });

                try {
                    const { isActive, productId } = await iapService.checkActiveSubscription();

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
                    console.error('[SubscriptionStore] Restore error:', err);
                    set({ error: 'Не удалось восстановить покупки' });
                } finally {
                    set({ isRestoring: false });
                }
            },

            /**
             * Check for active subscription without user-facing alerts.
             */
            checkStatus: async () => {
                try {
                    const { isActive, productId } = await iapService.checkActiveSubscription();

                    set({
                        isActive,
                        activeProductId: productId,
                    });

                    syncPremiumStatus(isActive);
                } catch (err) {
                    console.error('[SubscriptionStore] Status check error:', err);
                }
            },

            clearError: () => set({ error: null }),

            reset: () => set(initialState),
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

export const openManageSubscriptions = () => {
    iapService.openManageSubscriptions();
};

export default useSubscriptionStore;
