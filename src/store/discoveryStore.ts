import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Topics the user wants to revisit after a discovery session
 * ("Learn more later"). Deliberately tiny: discovery must not grow
 * into a second certification system.
 */
interface DiscoveryState {
    interestedIds: string[];
    saveInterest: (topicId: string) => void;
    clearInterests: () => void;
}

export const useDiscoveryStore = create<DiscoveryState>()(
    persist(
        (set, get) => ({
            interestedIds: [],

            saveInterest: (topicId) => {
                if (get().interestedIds.includes(topicId)) return;
                console.log('[discoveryStore] saveInterest:', topicId);
                set({ interestedIds: [...get().interestedIds, topicId] });
            },

            clearInterests: () => set({ interestedIds: [] }),
        }),
        {
            name: 'discovery-storage',
            storage: createJSONStorage(() => AsyncStorage),
        },
    ),
);

export default useDiscoveryStore;
