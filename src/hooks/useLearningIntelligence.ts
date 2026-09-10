import { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useGamificationStore } from '../store/gamificationStore';
import { useTaskStore } from '../store/taskStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { getProgramForHobby } from '../domain/credentials/catalog';
import { eventsByProgram, useLearningEventsRevision } from '../services/learningEventRepository';
import { projectSkillState } from '../domain/sessions/skillState';
import type { SkillState } from '../domain/sessions/skillState';
import { getNextBestLearningAction } from '../domain/sessions/nextBestAction';
import type { LearningRecommendation } from '../domain/sessions/nextBestAction';
import type { CredentialProgram } from '../domain/credentials/types';

/**
 * ONE reactive intelligence source for Quick, Credential, Your Day and Coach.
 * Screens receive skill states + one recommendation — never raw event arrays.
 * Projection runs on memoized boundaries (event count revision), not per swipe.
 */
export interface LearningIntelligence {
    hobbyId: string | null;
    program: CredentialProgram | undefined;
    skillStates: SkillState[];
    recommendation: LearningRecommendation | null;
}

export function useLearningIntelligence(input?: { hobbyId?: string | null; minutes?: number }): LearningIntelligence {
    const user = useAuthStore(s => s.user);
    const selectedHobby = useUserProfileStore(s => s.selectedHobby);
    const dailyTasks = useTaskStore(s => s.dailyTasks);
    const currentDay = useGamificationStore(s => s.currentDay);
    // Revision only (a number) — the array itself never reaches screens.
    const revision = useLearningEventsRevision();

    const hobbyId = input?.hobbyId ?? selectedHobby;
    const minutes = input?.minutes ?? 15;

    return useMemo(() => {
        if (!hobbyId) return { hobbyId: null, program: undefined, skillStates: [], recommendation: null };
        const ownerId = user?.id ?? 'local';
        const program = getProgramForHobby(hobbyId);
        const skillStates = program ? projectSkillState({ program, events: eventsByProgram(program.slug, ownerId) }).skills : [];
        const recommendation = getNextBestLearningAction({
            hobbyId,
            program,
            skillStates,
            currentCurriculumDay: (currentDay as Record<string, number>)[hobbyId] ?? 1,
            availableMinutes: minutes,
            dailyTasks,
        });
        return { hobbyId, program, skillStates, recommendation };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hobbyId, minutes, user?.id, revision, selectedHobby, dailyTasks, currentDay, programKey(hobbyId)]);
}

function programKey(hobbyId: string | null): string {
    if (!hobbyId) return '';
    return getProgramForHobby(hobbyId)?.slug ?? '';
}

export default useLearningIntelligence;
