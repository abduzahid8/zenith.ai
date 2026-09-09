import { useEffect, useState } from 'react';
import { useTaskStore } from '../store/taskStore';
import { useAuthStore } from '../store/authStore';
import { useUserProfileStore } from '../store/userProfileStore';
import { useGamificationStore } from '../store/gamificationStore';
import { sessionService } from '../services/supabase/sessions';
import { tasksDbService } from '../services/supabase/tasks';
import { EngineTaskInput, SessionInput } from '../services/credentialService';
import { getTodayDateString } from '../utils/date';

const HISTORY_DAYS = 28;

function daysAgo(dateStr: string, n: number): string {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

/**
 * Gathers the existing engine data every credential screen needs:
 * - task HISTORY (trailing 28 days from Supabase, falling back to today's
 *   plan) — so progress reflects what the user ALREADY did;
 * - session history (Supabase, best-effort);
 * - gamification: current curriculum day + completed units per hobby,
 *   artifacts are read by the credential store directly;
 * - streak.
 * No new data silo — credentials read the same tasks/sessions the Daily
 * Loop already produces.
 */
export function useCredentialEngine() {
    const dailyTasks = useTaskStore(s => s.dailyTasks);
    const user = useAuthStore(s => s.user);
    const streakDays = useUserProfileStore(s => s.streakDays ?? 0);
    const currentDay = useGamificationStore(s => s.currentDay);
    const unitProgress = useGamificationStore(s => s.unitProgress);
    const [sessions, setSessions] = useState<SessionInput[]>([]);
    const [historyTasks, setHistoryTasks] = useState<EngineTaskInput[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        if (!user?.id) {
            setSessions([]);
            setHistoryTasks(null);
            return;
        }
        sessionService
            .getUserSessions(user.id)
            .then(rows => {
                if (cancelled) return;
                setSessions(
                    (rows ?? []).map(r => ({
                        hobby_id: r.hobby_id,
                        duration_seconds: r.duration_seconds,
                        focus_score: r.focus_score ?? undefined,
                        completed_at: r.completed_at,
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setSessions([]);
            });
        const today = getTodayDateString();
        tasksDbService
            .getTasksByDateRange(user.id, daysAgo(today, HISTORY_DAYS - 1), today)
            .then(rows => {
                if (cancelled) return;
                setHistoryTasks(
                    (rows ?? []).map(t => ({
                        type: t.type,
                        status: t.status,
                        hobby_id: t.hobby_id,
                        duration_minutes: t.duration_minutes ?? undefined,
                        scheduled_date: t.scheduled_date,
                    })),
                );
            })
            .catch(() => {
                if (!cancelled) setHistoryTasks(null);
            });
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    const todayTasks: EngineTaskInput[] = dailyTasks.map(t => ({
        type: t.type,
        status: t.status,
        hobby_id: t.hobby_id,
        duration_minutes: t.duration_minutes ?? undefined,
        scheduled_date: t.scheduled_date,
    }));

    // History when available (today's plan is usually already in it;
    // add store rows whose date+type slot is missing, e.g. offline).
    const tasks: EngineTaskInput[] =
        historyTasks !== null
            ? (() => {
                  const merged = [...historyTasks];
                  const keys = new Set(historyTasks.map(t => `${t.scheduled_date}|${t.type}`));
                  for (const t of todayTasks) {
                      if (!keys.has(`${t.scheduled_date}|${t.type}`)) merged.push(t);
                  }
                  return merged;
              })()
            : todayTasks;

    return { tasks, sessions, streakDays, userId: user?.id ?? null, currentDay, unitProgress };
}
