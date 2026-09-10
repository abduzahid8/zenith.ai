import React, { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { parseSessionParams } from '../domain/sessions/sessionBlueprint';
import { SwipeLearningSession } from '../components/session/swipe/SwipeLearningSession';
import { SessionTimerLegacyScreen } from './SessionTimerLegacyScreen';

/**
 * Session route: swipe learning is the default experience.
 * The first useful card renders immediately (lesson loads in place);
 * the legacy timer-first UI stays available via ?legacy=1 during migration.
 */
export const SessionTimerScreen: React.FC = () => {
    const router = useRouter();
    const raw = useLocalSearchParams();
    const legacy = raw.legacy === '1' || raw.legacy === 'true';

    const session = useMemo(
        () =>
            parseSessionParams({
                minutes: (raw.minutes as string | string[] | null) ?? null,
                taskId: (raw.taskId as string | string[] | null) ?? null,
                discoveryId: (raw.discoveryId as string | string[] | null) ?? null,
                origin: (raw.origin as string | string[] | null) ?? null,
                kind: (raw.kind as string | string[] | null) ?? null,
                skillDay: (raw.skillDay as string | string[] | null) ?? null,
                scope: (raw.scope as string | string[] | null) ?? null,
                strategy: (raw.strategy as string | string[] | null) ?? null,
                reason: (raw.reason as string | string[] | null) ?? null,
            }),
        [raw.minutes, raw.taskId, raw.discoveryId, raw.origin, raw.kind, raw.skillDay, raw.scope, raw.strategy, raw.reason],
    );

    if (legacy) {
        return <SessionTimerLegacyScreen />;
    }

    const routeKey = `${session.context.kind}|${session.context.origin}|${session.taskId ?? ''}|${session.discoveryId ?? ''}|${session.minutes ?? ''}|${session.skillDay ?? ''}|${session.scope}|${session.strategy}`;

    return (
        <SwipeLearningSession
            key={routeKey}
            kind={session.context.kind}
            origin={session.context.origin}
            taskId={session.taskId}
            discoveryId={session.discoveryId}
            minutes={session.minutes ?? 15}
            skillDay={session.skillDay}
            scope={session.scope}
            strategy={session.strategy}
            reasonCode={session.reasonCode}
            onExit={() => router.back()}
            onContinueNext={(next) => {
                console.log('[SessionTimer] Continue to next task:', next.taskId);
                router.replace(
                    `/session-timer?minutes=${next.minutes}&taskId=${next.taskId}&kind=${session.context.kind}&origin=${session.context.origin}` as any,
                );
            }}
        />
    );
};

export default SessionTimerScreen;
