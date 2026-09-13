/**
 * User-scope reset registry (Phase 1 — account isolation).
 *
 * Classification of every persisted store:
 *
 * USER-SCOPED (cleared on sign-out / account deletion):
 *   user-profile-storage, task-storage, hobby-time-storage, quiz-storage,
 *   screen-time-storage, earnings-storage, content-storage,
 *   device-screen-time-storage, subscription-storage, gamification-storage,
 *   goal-storage, credential-storage, discovery-storage.
 *
 * DEVICE-SCOPED (kept — not user data):
 *   language-storage (UI language), theme preferences, stop-confirm prefs.
 *
 * OWNER-SCOPED BUT KEPT (queries already isolate by owner):
 *   learning-events-v1 — every scoped query REQUIRES an ownerId and
 *   pre-scoping events are never auto-attributed, so User B cannot see
 *   User A's evidence. Wiping it would destroy User A's local evidence
 *   that must still be there when they sign back in.
 *
 * Server data is NEVER touched here — it stays attached to User A and
 * rehydrates via the normal sync paths (syncUserProfile, fetchDailyPlan,
 * useCredentialEngine, useCredentialJourney) on next login.
 */
import { useUserProfileStore } from '../store/userProfileStore';
import { useTaskStore } from '../store/taskStore';
import { useHobbyTimeStore } from '../store/hobbyTimeStore';
import { useQuizStore } from '../store/quizStore';
import { useScreenTimeStore } from '../store/screenTimeStore';
import { useEarningsStore } from '../store/earningsStore';
import { useContentStore } from '../store/contentStore';
import { useDeviceScreenTimeStore } from '../store/deviceScreenTimeStore';
import { useSubscriptionStore } from '../store/subscriptionStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useGoalStore } from '../store/goalStore';
import { useCredentialStore } from '../store/credentialStore';
import { useDiscoveryStore } from '../store/discoveryStore';

function safeReset(label: string, fn: () => void): void {
    try {
        fn();
    } catch (err) {
        console.warn(`[userScopeReset] ${label} failed:`, err);
    }
}

/**
 * Clear every user-scoped local store. Idempotent and order-independent.
 * Call on sign-out and after account deletion — never on plain app start.
 */
export function resetUserScopedState(): void {
    safeReset('userProfile', () => useUserProfileStore.getState().resetProfile());
    safeReset('task', () => useTaskStore.getState().resetTasks());
    safeReset('hobbyTime', () => useHobbyTimeStore.getState().reset());
    safeReset('quiz', () => useQuizStore.getState().resetQuiz());
    safeReset('screenTime', () => useScreenTimeStore.getState().reset());
    safeReset('earnings', () => useEarningsStore.getState().reset());
    safeReset('content', () => useContentStore.getState().reset());
    safeReset('deviceScreenTime', () => useDeviceScreenTimeStore.getState().reset());
    safeReset('subscription', () => useSubscriptionStore.getState().reset());
    safeReset('gamification', () => useGamificationStore.getState().resetForUserChange());
    safeReset('goal', () => useGoalStore.getState().resetForUserChange());
    safeReset('credential', () => useCredentialStore.getState().resetForUserChange());
    safeReset('discovery', () => useDiscoveryStore.getState().clearInterests());
}

export default resetUserScopedState;
