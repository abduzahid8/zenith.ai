import { HelpMode } from '../../types/goals';

/**
 * Human-readable sentences for each internal mode state.
 * Mode strings must never render as literal text in the UI — use these instead.
 * Update this file to change copy across all cards and screens simultaneously.
 */
export const MODE_COPY: Record<HelpMode, { title: string; subtitle: string }> = {
  milestone: {
    title: "Let's map out your plan",
    subtitle: 'Break your goal into milestones so each day has a clear target.',
  },
  tactical: {
    title: 'Keep the streak going',
    subtitle: 'Small steps, repeated daily, create results.',
  },
  tools: {
    title: "You're behind pace — here's a tool that can help",
    subtitle: 'A different approach might be what you need right now.',
  },
  troubleshoot: {
    title: "Let's clear what's blocking you",
    subtitle: 'Tell us what\'s in your way and we\'ll find a way around it.',
  },
};

export function modeTitle(mode: HelpMode): string {
  return MODE_COPY[mode]?.title ?? MODE_COPY.tactical.title;
}

export function modeSubtitle(mode: HelpMode): string {
  return MODE_COPY[mode]?.subtitle ?? MODE_COPY.tactical.subtitle;
}
