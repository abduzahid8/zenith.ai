/**
 * Slice 1 — prove_skill -> verified skill challenge.
 * Component + gate tests (RNTL v14: render/fireEvent are async).
 */
import '@testing-library/jest-native/extend-expect';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import {
    VerifiedSkillChallenge,
    VerifySkillCta,
    shouldShowVerifyChip,
    fetchVerifyContext,
} from '../components/session/VerifiedSkillChallenge';import {
    startTrustedValidation,
    submitTrustedValidation,
    getProgramAvailability,
    getTrustedSkillResults,
} from '../services/trustApi';

jest.mock('../services/trustApi', () => ({
    startTrustedValidation: jest.fn(),
    submitTrustedValidation: jest.fn(),
    getProgramAvailability: jest.fn(),
    getTrustedSkillResults: jest.fn(),
}));
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({})),
}));
jest.mock('react-native-url-polyfill/auto', () => ({}), { virtual: true });
jest.mock('expo-auth-session', () => ({ makeRedirectUri: jest.fn(() => 'test://') }), { virtual: true });
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }), { virtual: true });
jest.mock('expo-apple-authentication', () => ({}), { virtual: true });
jest.mock('expo-crypto', () => ({}), { virtual: true });
jest.mock('../modules/device-activity', () => ({}), { virtual: true });
jest.mock('../store/deviceScreenTimeStore', () => ({
    useDeviceScreenTimeStore: Object.assign(jest.fn(() => ({})), { getState: () => ({ reset: jest.fn() }) }),
}));
jest.mock('../services/iapService', () => ({
    iapService: {
        setup: jest.fn(),
        loadSubscriptions: jest.fn(),
        purchaseSubscription: jest.fn(),
        checkActiveSubscription: jest.fn(),
        restorePurchases: jest.fn(),
    },
    ErrorCode: { UserCancelled: 'user-cancelled' },
}));
jest.mock('../theme/useAppTheme', () => ({
    useAppTheme: () => ({
        colors: {
            text: '#000',
            textSecondary: '#666',
            surfaceLight: '#fff',
            background: '#eee',
            buttonPrimary: '#007aff',
            white: '#fff',
        },
    }),
}));

const mockStart = startTrustedValidation as jest.Mock;
const mockSubmit = submitTrustedValidation as jest.Mock;
const mockAvailability = getProgramAvailability as jest.Mock;
const mockResults = getTrustedSkillResults as jest.Mock;

const proveRec = {
    type: 'prove_skill' as const,
    hobbyId: 'chess',
    skillKey: 'rules',
    skillName: 'Rules',
    minutes: 30,
    reasonCode: 'missing_validation' as const,
    confidence: 'high' as const,
};

beforeEach(() => {
    jest.clearAllMocks();
});

describe('shouldShowVerifyChip gate', () => {
    test('1. prove_skill recommendation renders Verify CTA target', () => {
        expect(
            shouldShowVerifyChip(proveRec, { issuable: true, verifiedSkillKeys: [] }),
        ).toEqual({ skillKey: 'rules', skillName: 'Rules' });
    });

    test('2. other recommendation kinds never render Verify CTA', () => {
        for (const type of ['continue_curriculum', 'repair_recall', 'practice_application', 'review_skill'] as const) {
            expect(
                shouldShowVerifyChip({ ...proveRec, type }, { issuable: true, verifiedSkillKeys: [] }),
            ).toBeNull();
        }
        expect(shouldShowVerifyChip(null, { issuable: true, verifiedSkillKeys: [] })).toBeNull();
    });

    test('3. UI uses the recommendation skill, never a guessed one', () => {
        const target = shouldShowVerifyChip(
            { ...proveRec, skillKey: 'tactics', skillName: 'Tactics & Strategy' },
            { issuable: true, verifiedSkillKeys: [] },
        );
        expect(target).toEqual({ skillKey: 'tactics', skillName: 'Tactics & Strategy' });
        expect(
            shouldShowVerifyChip({ ...proveRec, skillKey: undefined }, { issuable: true, verifiedSkillKeys: [] }),
        ).toBeNull();
    });

    test('4. issuance-disabled program + already-verified skill hide the CTA', () => {
        expect(shouldShowVerifyChip(proveRec, { issuable: false, verifiedSkillKeys: [] })).toBeNull();
        expect(shouldShowVerifyChip(proveRec, { issuable: true, verifiedSkillKeys: ['rules'] })).toBeNull();
    });
});

describe('fetchVerifyContext re-reads server truth', () => {
    test('maps availability + verified skills; throws stay thrown (fail-closed)', async () => {
        mockAvailability.mockResolvedValue([
            { slug: 'chess-foundations', issuable: true },
            { slug: 'python-foundations', issuable: false },
        ]);
        mockResults.mockResolvedValue([
            { skillKey: 'rules', passed: true },
            { skillKey: 'openings', passed: false },
        ]);
        await expect(fetchVerifyContext('chess-foundations')).resolves.toEqual({
            issuable: true,
            verifiedSkillKeys: ['rules'],
        });
        await expect(fetchVerifyContext('python-foundations')).resolves.toEqual({
            issuable: false,
            verifiedSkillKeys: ['rules'],
        });
        mockAvailability.mockRejectedValue(new Error('offline'));
        await expect(fetchVerifyContext('chess-foundations')).rejects.toThrow('offline');
    });
});

describe('VerifySkillCta', () => {
    test('1. renders the Verify CTA with the skill name', async () => {
        const onPress = jest.fn();
        const screen = await render(<VerifySkillCta skillName="Rules" onPress={onPress} />);
        expect(screen.getByText('🎯 Verify Rules')).toBeTruthy();
        await fireEvent.press(screen.getByText('🎯 Verify Rules'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});

describe('VerifiedSkillChallenge', () => {
    const baseProps = {
        visible: true,
        programSlug: 'chess-foundations',
        skillKey: 'rules',
        skillName: 'Rules',
        onClose: jest.fn(),
        onComplete: jest.fn(),
    };

    beforeEach(() => {
        baseProps.onClose = jest.fn();
        baseProps.onComplete = jest.fn();
    });

    test('5. tapping an option calls start with program+skill, submits the answer', async () => {
        mockStart.mockResolvedValue({
            attemptId: 'att-1',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Knight moves?', options: ['L-shape', 'Straight'] },
        });
        mockSubmit.mockResolvedValue({ passed: true, submitted: true, trustedEventId: 'srv:1' });
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        expect(mockStart).toHaveBeenCalledWith('chess-foundations', 'rules');
        expect(await screen.findByText('Knight moves?')).toBeTruthy();
        await fireEvent.press(screen.getByText('L-shape'));
        expect(mockSubmit).toHaveBeenCalledWith('att-1', 'L-shape');
    });

    test('6. renders only the safe payload, never server internals', async () => {
        mockStart.mockResolvedValue({
            attemptId: 'att-9',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: {
                id: 'secret-item-id',
                answer_key: 'L-shape',
                provenance: 'static_bank',
                trusted: true,
                content_version: 'v9',
                prompt: 'Knight moves?',
                options: ['L-shape'],
            },
        });
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        expect(await screen.findByText('Knight moves?')).toBeTruthy();
        expect(screen.queryByText('secret-item-id')).toBeNull();
        expect(screen.queryByText('static_bank')).toBeNull();
        expect(screen.queryByText('L-shape')).toBeTruthy();
    });

    test('8. server PASS renders Verified + reports completion', async () => {
        mockStart.mockResolvedValue({
            attemptId: 'att-1',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Q?', options: ['A'] },
        });
        mockSubmit.mockResolvedValue({ passed: false, submitted: true, trustedEventId: null });
        // First drive a FAIL to prove the component tracks server truth...
        const failScreen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await failScreen.findByText('Q?');
        await fireEvent.press(failScreen.getByText('A'));
        expect(await failScreen.findByText('Needs another try')).toBeTruthy();
        expect(failScreen.queryByText('✓ Verified')).toBeNull();
        expect(baseProps.onComplete).toHaveBeenCalledWith(false);

        // ...then a PASS renders Verified.
        mockSubmit.mockResolvedValue({ passed: true, submitted: true, trustedEventId: 'srv:1' });
        const passScreen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await passScreen.findByText('Q?');
        await fireEvent.press(passScreen.getByText('A'));
        expect(await passScreen.findByText('✓ Verified')).toBeTruthy();
        expect(baseProps.onComplete).toHaveBeenCalledWith(true);
    });

    test('9/10. server FAIL never renders Verified; local forgery is inert', async () => {
        // Forge local verified state first: the component must ignore it.
        const { useCredentialStore } = require('../store/credentialStore');
        useCredentialStore.getState().setIdentityVerified?.('chess-foundations', true);
        mockStart.mockResolvedValue({
            attemptId: 'att-2',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Q?', options: ['A'] },
        });
        mockSubmit.mockResolvedValue({ passed: false, submitted: true, trustedEventId: null });
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await screen.findByText('Q?');
        expect(screen.queryByText('✓ Verified')).toBeNull();
        await fireEvent.press(screen.getByText('A'));
        expect(await screen.findByText('Needs another try')).toBeTruthy();
        expect(screen.queryByText('✓ Verified')).toBeNull();
    });

    test('12. after FAIL, Continue returns normally', async () => {
        mockStart.mockResolvedValue({
            attemptId: 'att-3',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Q?', options: ['A'] },
        });
        mockSubmit.mockResolvedValue({ passed: false, submitted: true, trustedEventId: null });
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await screen.findByText('Q?');
        await fireEvent.press(screen.getByText('A'));
        await screen.findByText('Needs another try');
        await fireEvent.press(screen.getByText('Continue'));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);
    });

    test('7. free-text challenge submits the typed answer', async () => {
        mockStart.mockResolvedValue({
            attemptId: 'att-4',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Name the move.' },
        });
        mockSubmit.mockResolvedValue({ passed: true, submitted: true, trustedEventId: 'srv:1' });
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await screen.findByText('Name the move.');
        await fireEvent.changeText(screen.getByPlaceholderText('Your answer…'), 'e4');
        await fireEvent.press(screen.getByText('Submit'));
        expect(mockSubmit).toHaveBeenCalledWith('att-4', 'e4');
    });

    test('13. network error never mutates verified state; Retry + Close stay usable', async () => {
        mockStart.mockRejectedValueOnce(new Error('offline'));
        const screen = await render(<VerifiedSkillChallenge {...baseProps} />);
        expect(await screen.findByText('Verification needs an internet connection.')).toBeTruthy();
        expect(screen.queryByText('✓ Verified')).toBeNull();
        expect(baseProps.onComplete).not.toHaveBeenCalled();
        await fireEvent.press(screen.getByText('Close'));
        expect(baseProps.onClose).toHaveBeenCalledTimes(1);

        mockStart.mockRejectedValueOnce(new Error('offline'));
        const retryScreen = await render(<VerifiedSkillChallenge {...baseProps} />);
        await retryScreen.findByText('Verification needs an internet connection.');
        mockStart.mockResolvedValue({
            attemptId: 'att-5',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Q?', options: ['A'] },
        });
        await fireEvent.press(retryScreen.getByText('Retry'));
        expect(await retryScreen.findByText('Q?')).toBeTruthy();
    });
});

describe('AICoachTab prove_skill wiring', () => {
    const mockUseIntelligence = jest.fn();
    jest.mock('../hooks/useLearningIntelligence', () => ({
        useLearningIntelligence: (...args: unknown[]) => (mockUseIntelligence as jest.Mock)(...args),
        default: (...args: unknown[]) => (mockUseIntelligence as jest.Mock)(...args),
    }));
    jest.mock('../services/ai', () => ({
        aiService: { sendMessage: jest.fn().mockResolvedValue('Mock reply') },
    }));
    jest.mock('../services/agentOrchestrator', () => ({
        orchestrateDailyPlan: jest.fn().mockResolvedValue({ steps: [], assets: [] }),
    }));

    const GOAL_ID = 'coach-goal-1';

    function seedCoachGoal() {
        const { useGoalStore } = require('../store/goalStore');
        const { useUserProfileStore } = require('../store/userProfileStore');
        useUserProfileStore.getState().setSelectedHobby('chess');
        useGoalStore.getState().setGoal({
            id: GOAL_ID,
            hobby: 'chess',
            type: 'execution_count',
            category: 'execution',
            description: 'Learn chess basics',
            target: 100,
            startingValue: 0,
            deadline: '2026-12-31',
            status: 'active',
            unitLabel: 'sessions',
            startDate: '2026-01-01',
        });
        useGoalStore.getState().recordCheckin(10, 'Started', undefined, 'chess');
    }

    // The RN mock drops FlatList header/footer from the tree. Walk the
    // live footer ELEMENT (never render it detached: a second render would
    // steal RNTL's global screen container and silently disable fireEvent
    // on the main tree). Poll until its subtree contains `text`.
    function footerTextPresent(footer: React.ReactElement | null, text: string | RegExp): boolean {
        const contains = (el: unknown): boolean => {
            if (typeof el === 'string') {
                return typeof text === 'string' ? el.includes(text) : text.test(el);
            }
            if (el == null || typeof el !== 'object') return false;
            const kids = (el as { props?: { children?: unknown } }).props?.children;
            return (Array.isArray(kids) ? kids : [kids]).some(contains);
        };
        return contains(footer);
    }

    function footerActionOnPress(footer: React.ReactElement | null, text: string | RegExp): (() => void) | null {
        const find = (el: unknown): (() => void) | null => {
            if (el == null || typeof el !== 'object') return null;
            const e = el as { type?: unknown; props?: { children?: unknown; onPress?: unknown } };
            // The CTA card is a composite element in the unrendered tree:
            // match it by component reference, not host type.
            if (e.type === VerifySkillCta && typeof e.props?.onPress === 'function') {
                return e.props.onPress as () => void;
            }
            if (e.type === 'TouchableOpacity' && typeof e.props?.onPress === 'function' && footerTextPresent(e as React.ReactElement, text)) {
                return e.props.onPress as () => void;
            }
            const kids = e.props?.children;
            for (const c of Array.isArray(kids) ? kids : [kids]) {
                const found = find(c);
                if (found) return found;
            }
            return null;
        };
        return find(footer);
    }

    function footerHasVerifyCard(footer: React.ReactElement | null): boolean {
        const find = (el: unknown): boolean => {
            if (el == null || typeof el !== 'object') return false;
            const e = el as { type?: unknown; props?: { children?: unknown } };
            if (e.type === VerifySkillCta) return true;
            const kids = e.props?.children;
            const list = Array.isArray(kids) ? kids : [kids];
            return list.some(find);
        };
        return find(footer);
    }

    async function liveFooter(screen: { root: unknown }): Promise<React.ReactElement | null> {
        const deadline = Date.now() + 8000;
        for (;;) {
            const root = screen.root as unknown as {
                queryAll: (pred: (n: { type: string; props: { ListFooterComponent?: unknown } }) => boolean) => {
                    props: { ListFooterComponent?: unknown };
                }[];
            } | null;
            const lists = root?.queryAll(n => n.type === 'FlatList') ?? [];
            const footer = (lists[0]?.props?.ListFooterComponent ?? null) as React.ReactElement | null;
            if (footer) return footer;
            if (Date.now() > deadline) throw new Error('footer never appeared');
            await new Promise(r => setTimeout(r, 50));
        }
    }

    test('14. Coach remains usable with normal chips when no verification is due', async () => {
        mockUseIntelligence.mockReturnValue({
            hobbyId: 'chess',
            program: undefined,
            skillStates: [],
            recommendation: null,
        });
        seedCoachGoal();
        const { default: AICoachTab } = require('../screens/tabs/AICoachTab');
        const screen = await render(<AICoachTab />);
        // Proactive coach message seeds from the goal (main tree bubbles).
        expect(screen.getAllByText(/Learn chess basics/).length).toBeGreaterThan(0);
        const footer = await liveFooter(screen);
        expect(footerTextPresent(footer, 'Done for today')).toBe(true);
        expect(footerTextPresent(footer, 'Ask me')).toBe(true);
        expect(footerHasVerifyCard(footer)).toBe(false);
    });

    test('1/3/5. prove_skill surfaces a Verify CTA that starts the server challenge', async () => {
        const { getProgram } = require('../domain/credentials/catalog');
        mockUseIntelligence.mockReturnValue({
            hobbyId: 'chess',
            program: getProgram('chess-foundations'),
            skillStates: [],
            recommendation: { ...proveRec },
        });
        seedCoachGoal();
        seedCoachGoal();
        mockAvailability.mockResolvedValue([{ slug: 'chess-foundations', issuable: true }]);
        mockResults.mockResolvedValue([]);
        mockStart.mockResolvedValue({
            attemptId: 'att-tab-1',
            skillKey: 'rules',
            programVersion: '1.0',
            payload: { prompt: 'Tab Q?', options: ['Yes'] },
        });
        mockSubmit.mockResolvedValue({ passed: true, submitted: true, trustedEventId: 'srv:tab' });
        const { default: AICoachTab } = require('../screens/tabs/AICoachTab');
        const screen = await render(<AICoachTab />);
        // The CTA uses the recommendation skill name, rendered in-conversation.
        // Poll the live footer until the async verify context lands.
        let pressVerify: (() => void) | null = null;
        const ctaDeadline = Date.now() + 8000;
        for (;;) {
            const footer = await liveFooter(screen);
            if (footerHasVerifyCard(footer)) {
                pressVerify = footerActionOnPress(footer, /Verify Rules/);
            }
            if (pressVerify) break;
            if (Date.now() > ctaDeadline) {
                throw new Error('Verify CTA never appeared');
            }
            await new Promise(r => setTimeout(r, 50));
        }
        await act(async () => {
            pressVerify!();
        });
        expect(mockStart).toHaveBeenCalledWith('chess-foundations', 'rules');
        // The server challenge opens inside the Coach experience...
        expect(await screen.findByText('Tab Q?')).toBeTruthy();
        await fireEvent.press(screen.getByText('Yes'));
        // ...server PASS produces verified UX plus a Coach reflection...
        expect(await screen.findByText('✓ Verified')).toBeTruthy();
        await fireEvent.press(screen.getByText('Continue'));
        expect(await screen.findByText(/Rules.*verified/i)).toBeTruthy();
        // ...and the truth is re-read (availability + results refreshed).
        expect(mockResults.mock.calls.length).toBeGreaterThanOrEqual(2);
    }, 30000);
});
