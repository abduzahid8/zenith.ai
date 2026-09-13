import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, FlatList, Alert, ActivityIndicator, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { scale } from '../constants';
import { fonts } from '../theme';
import { useGoalStore, getInitialProgress } from '../store/goalStore';
import { GoalSnapshot, DailyGoalContent, StepInstruction, BuiltAsset } from '../types/goals';
import { ROUTES, buildRoute } from '../config/routes';
import { orchestrateDailyPlan } from '../services/agentOrchestrator';

const { width: SW } = Dimensions.get('window');
const SLIDE_W = SW;
const XP_PER_DAY = 50;
const XP_PER_LEVEL = 300;
const LEVEL_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

function calcLevel(totalXP: number) {
  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpInLevel = totalXP % XP_PER_LEVEL;
  return { level, xpInLevel, xpProgress: (xpInLevel / XP_PER_LEVEL) * 100, levelColor: LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length] };
}

// ───── Shared types & helpers ─────

interface PageProps {
  data: {
    description: string; barPct: number; currentVal: number; targetVal: number;
    unit: string; streak: number; dailyActions: number; daysIn: number;
    level: number; xpInLevel: number; xpProgress: number; levelColor: string;
    totalXP: number; daysRemaining: number; dayNum: number; totalDays: number;
    learnTitle: string; learnBody: string; doTitle: string; doInstructions: string;
    doMinutes: number; focusReason: string; bodyLines: string[]; instrLines: string[];
    hasContent: boolean; milestones: any[]; currentMilestoneIndex: number;
    focusBadge: string; agentActions: any[]; allDone: boolean; commitmentText: string;
    finished: boolean; steps: StepInstruction[];
  };
  assets: BuiltAsset[];
  theme: { accent: string; bg: string; text: string; muted: string };
  index: number; total: number;
  onStartSession?: () => void;
  onCompleteDay?: () => void;
  onOpenAsset?: (asset: BuiltAsset) => void;
}

function StepCard({ num, title, desc, time, assetLabels }: { num: number; title: string; desc: string; time?: string; assetLabels?: string[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: scale(10), marginBottom: scale(8) }}>
      <View style={{ width: scale(24), height: scale(24), borderRadius: scale(12), backgroundColor: '#102852', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#FFF' }}>{num}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6) }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#1A1A1A' }}>{title}</Text>
          {time && <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#AAA' }}>{time}</Text>}
        </View>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(10), color: '#666', marginTop: scale(2), lineHeight: scale(15) }}>{desc}</Text>
        {assetLabels && assetLabels.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: scale(4), marginTop: scale(4) }}>
            {assetLabels.map((label, i) => (
              <View key={i} style={{ backgroundColor: '#E8F0FE', borderRadius: scale(3), paddingHorizontal: scale(5), paddingVertical: scale(2) }}>
                <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#1A56DB' }}>📎 {label}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function BuiltCard({ asset, color }: { asset: BuiltAsset; color: string }) {
  const icons: Record<string, string> = { research: '📚', code: '💻', image: '🎨', deployment: '🚀', summary: '📝' };
  return (
    <View style={{ flexDirection: 'row', gap: scale(8), backgroundColor: '#FFF', borderRadius: scale(8), padding: scale(10), marginBottom: scale(6), shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
      <Text style={{ fontSize: scale(18) }}>{icons[asset.type] || '📦'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(10), color: '#1A1A1A' }}>{asset.title}</Text>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#888', marginTop: scale(1) }}>{asset.description}</Text>
      </View>
      <TouchableOpacity style={{ backgroundColor: color, borderRadius: scale(4), paddingHorizontal: scale(8), paddingVertical: scale(4), alignSelf: 'center' }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(7), color: '#FFF' }}>{asset.action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Divider({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: scale(8) }}>
      <View style={{ flex: 1, height: scale(1), backgroundColor: '#DDD' }} />
      <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#BBB', marginHorizontal: scale(8), letterSpacing: scale(1) }}>{text}</Text>
      <View style={{ flex: 1, height: scale(1), backgroundColor: '#DDD' }} />
    </View>
  );
}

// ─────────────────────────────────────────────
// 1. TODAY'S PLAN — step-by-step instructions
// ─────────────────────────────────────────────
function PlanPage({ data, assets, theme, onStartSession }: PageProps) {
  const steps = data.steps.length > 0 ? data.steps : [
    { step: 1, type: 'learn' as const, assetRefs: [], title: data.learnTitle || 'Review daily topic', description: (data.bodyLines[0] || 'Understand the key concept.').substring(0, 80), duration: '5min' },
    { step: 2, type: 'practice' as const, assetRefs: [], title: data.doTitle || 'Complete practice', description: (data.doInstructions || 'Apply what you learned.').substring(0, 80), duration: `${data.doMinutes}min` },
    { step: 3, type: 'review' as const, assetRefs: [], title: 'Review built assets', description: `Check prepared assets.`, duration: '3min' },
    { step: 4, type: 'log' as const, assetRefs: [], title: 'Log progress', description: `Mark done. 🔥 Streak: ${data.streak + 1}`, duration: '1min' },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F5F5', padding: scale(20), justifyContent: 'center' }}>
      <View style={{ marginBottom: scale(12) }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#999', letterSpacing: scale(2), textTransform: 'uppercase' }}>Day {data.dayNum} · {data.description.substring(0, 30)}</Text>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(20), color: '#1A1A1A', marginTop: scale(4) }}>Today's Plan</Text>
        {data.focusReason && <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(10), color: '#666', marginTop: scale(4), lineHeight: scale(15) }}>🎯 {data.focusReason}</Text>}
      </View>
      {steps.map(s => {
        const refAssets = s.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
        return <StepCard key={s.step} num={s.step} title={s.title} desc={s.description} time={s.duration} assetLabels={refAssets.map(a => a.title)} />;
      })}
      <Divider text={`⚡ ${assets.length} assets ready for you`} />
      <TouchableOpacity style={{ backgroundColor: '#102852', borderRadius: scale(12), padding: scale(12), alignItems: 'center', marginTop: scale(4) }} onPress={onStartSession}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#FFF' }}>Start Session →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// 2. BUILT FOR YOU — system deliverables
// ─────────────────────────────────────────────
function BuiltPage({ data, assets, theme }: PageProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#F8F6F0', padding: scale(20), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#999', letterSpacing: scale(2), textTransform: 'uppercase', marginBottom: scale(4) }}>Built For You Today</Text>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#1A1A1A', marginBottom: scale(16) }}>{data.description.substring(0, 40)}</Text>
      {assets.length === 0 ? (
        <View style={{ backgroundColor: '#FFF', borderRadius: scale(8), padding: scale(20), alignItems: 'center' }}>
          <Text style={{ fontSize: scale(24), marginBottom: scale(8) }}>🛠️</Text>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#999', textAlign: 'center' }}>Agents are working on your assets. Check back shortly.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {assets.map(a => {
            const step = data.steps.find(s => s.assetRefs.includes(a.id));
            return (
              <View key={a.id}>
                <BuiltCard key={a.id} asset={a} color="#059669" />
                {step && (
                  <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#10B981', marginTop: -4, marginBottom: 6, marginLeft: scale(34) }}>
                    ← supports step {step.step}: {step.title}
                  </Text>
                )}
              </View>
            );
          })}
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#059669', textAlign: 'center', marginTop: scale(4) }}>
            ✨ {assets.length} asset(s) generated. Each backs a specific step.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// 3. YOUR PATH — step ↔ asset flow
// ─────────────────────────────────────────────
function PathPage({ data, assets, theme }: PageProps) {
  const steps = data.steps.length > 0 ? data.steps : [];
  const icons: Record<string, string> = { learn: '📖', practice: '🎯', review: '📦', log: '✅' };
  return (
    <View style={{ flex: 1, backgroundColor: '#0C0C1D', padding: scale(20), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#6366F1', letterSpacing: scale(2), textTransform: 'uppercase', marginBottom: scale(4) }}>Today's Flow</Text>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#FFF', marginBottom: scale(16) }}>{data.description.substring(0, 35)}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {steps.map((s, i) => {
          const refAssets = s.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
          return (
            <View key={s.step} style={{ marginBottom: scale(4) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
                <View style={{ width: scale(28), height: scale(28), borderRadius: scale(14), backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: scale(12) }}>{icons[s.type] || '•'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#FFF' }}>{s.title}</Text>
                  <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#94A3B8' }}>{s.duration}</Text>
                </View>
                <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#6366F1', letterSpacing: scale(1) }}>STEP {s.step}</Text>
              </View>
              {refAssets.length > 0 && (
                <View style={{ marginLeft: scale(36), marginTop: scale(4), marginBottom: scale(8), backgroundColor: '#1A1A35', borderRadius: scale(6), padding: scale(8) }}>
                  <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#A78BFA', marginBottom: scale(3) }}>⚡ assets backing this step:</Text>
                  {refAssets.map(a => (
                    <Text key={a.id} style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#94A3B8', marginLeft: scale(4) }}>• {a.title}</Text>
                  ))}
                </View>
              )}
              {i < steps.length - 1 && <View style={{ marginLeft: scale(13), width: scale(2), height: scale(10), backgroundColor: '#2E2E5A' }} />}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// 4. ASSETS — grouped by supporting step
// ─────────────────────────────────────────────
function AssetsPage({ data, assets, theme }: PageProps) {
  const steps = data.steps.length > 0 ? data.steps : [];
  return (
    <View style={{ flex: 1, backgroundColor: '#F5F0EB', padding: scale(24), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#999', letterSpacing: scale(2), textTransform: 'uppercase', marginBottom: scale(4) }}>Asset Library</Text>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#1A1A1A', marginBottom: scale(16) }}>What we've built for you</Text>
      {assets.length === 0 ? (
        <View style={{ alignItems: 'center', padding: scale(20) }}>
          <Text style={{ fontSize: scale(32), marginBottom: scale(8) }}>📦</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(10), color: '#AAA', textAlign: 'center' }}>No assets yet. They'll appear here as agents complete work.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {steps.filter(s => s.assetRefs.length > 0).map(s => {
            const stepAssets = s.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
            if (stepAssets.length === 0) return null;
            return (
              <View key={s.step} style={{ marginBottom: scale(10) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(4) }}>
                  <View style={{ width: scale(6), height: scale(6), borderRadius: scale(3), backgroundColor: '#1A1A1A' }} />
                  <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(8), color: '#1A1A1A', letterSpacing: scale(1), textTransform: 'uppercase' }}>
                    Step {s.step}: {s.title}
                  </Text>
                </View>
                {stepAssets.map(a => <BuiltCard key={a.id} asset={a} color="#1A1A1A" />)}
              </View>
            );
          })}
          {assets.filter(a => !a.supportsStep || !steps.some(s => s.assetRefs.includes(a.id))).length > 0 && (
            <View style={{ marginTop: scale(4) }}>
              <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#BBB', letterSpacing: scale(1), textTransform: 'uppercase', marginBottom: scale(4) }}>Unlinked</Text>
              {assets.filter(a => !a.supportsStep || !steps.some(s => s.assetRefs.includes(a.id))).map(a => <BuiltCard key={a.id} asset={a} color="#BBB" />)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// 5. HEX GRID — progress + next action
// ─────────────────────────────────────────────
function HexPage({ data, assets, theme }: PageProps) {
  const hexSize = scale(32);
  const w = hexSize * 1.7;
  const h = hexSize * 1.5;
  const cols = 4;
  const rows = 4;
  const total = cols * rows;
  const filled = Math.round((data.barPct / 100) * total);
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${hexSize * Math.cos(a)},${hexSize * Math.sin(a)}`;
  }).join(' ');
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', padding: scale(16), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#10B981', letterSpacing: scale(2), textTransform: 'uppercase', textAlign: 'center', marginBottom: scale(4) }}>Your next step</Text>
      <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(10), color: '#94A3B8', textAlign: 'center', marginBottom: scale(12) }}>{data.focusReason || 'Continue your daily practice.'}</Text>
      <View style={{ alignItems: 'center' }}>
        <Svg width={w * (cols + 0.5)} height={h * rows + hexSize}>
          {Array.from({ length: rows }, (_, row) =>
            Array.from({ length: cols }, (_, col) => {
              const idx = row * cols + col;
              const on = idx < filled;
              const cx = col * w + (row % 2 === 0 ? 0 : w / 2) + hexSize;
              const cy = row * h * 0.75 + hexSize;
              return (
                <Polygon
                  key={`${row}-${col}`}
                  points={points.split(' ').map(p => {
                    const [x, y] = p.split(',').map(Number);
                    return `${cx + x},${cy + y}`;
                  }).join(' ')}
                  fill={on ? '#10B981' : '#1E293B'}
                  stroke={on ? '#34D399' : '#334155'}
                  strokeWidth={1}
                  opacity={on ? 0.9 : 0.4}
                />
              );
            })
          )}
        </Svg>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(22), color: '#FFF', marginTop: scale(4) }}>{Math.round(data.barPct)}<Text style={{ fontSize: scale(12), color: '#10B981' }}>%</Text></Text>
      </View>
      <View style={{ backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(10), marginTop: scale(8) }}>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#64748B' }}>📋 Today's task</Text>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#F1F5F9', marginTop: scale(2) }}>{data.doTitle || 'Complete today\'s practice'}</Text>
        {data.doMinutes > 0 && <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#94A3B8', marginTop: scale(2) }}>{data.doMinutes} min · 🔥{data.streak} day streak</Text>}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// 6. INSTRUCTIONS — steps with embedded assets
// ─────────────────────────────────────────────
function InstructionsPage({ data, assets, theme }: PageProps) {
  const steps = data.steps.length > 0 ? data.steps : [];
  const icons: Record<string, string> = { learn: '📖', practice: '🎯', review: '📦', log: '✅' };
  return (
    <View style={{ flex: 1, backgroundColor: '#0B1121', padding: scale(20), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#34D399', letterSpacing: scale(2), textTransform: 'uppercase', marginBottom: scale(4) }}>Step-by-step · Day {data.dayNum}</Text>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#F1F5F9', marginBottom: scale(16) }}>{data.description.substring(0, 35)}</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {steps.map((s, i) => {
          const refAssets = s.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
          return (
            <View key={s.step} style={{ backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(12), marginBottom: scale(8), borderLeftWidth: scale(3), borderLeftColor: i === 0 ? '#34D399' : i === 1 ? '#10B981' : i === 2 ? '#6366F1' : '#8B5CF6' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(4) }}>
                <Text style={{ fontSize: scale(14) }}>{icons[s.type] || '•'}</Text>
                <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#F1F5F9' }}>{s.title}</Text>
                <View style={{ backgroundColor: '#334155', borderRadius: scale(3), paddingHorizontal: scale(5), paddingVertical: scale(1) }}>
                  <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#94A3B8' }}>{s.duration}</Text>
                </View>
              </View>
              <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#94A3B8', lineHeight: scale(14) }}>{s.description}</Text>
              {refAssets.map(a => (
                <TouchableOpacity key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), backgroundColor: '#334155', borderRadius: scale(6), padding: scale(8), marginTop: scale(6) }}>
                  <Text style={{ fontSize: scale(12) }}>{a.type === 'research' ? '📚' : a.type === 'code' ? '💻' : a.type === 'deployment' ? '🚀' : a.type === 'summary' ? '📝' : '📦'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#F1F5F9' }}>{a.title}</Text>
                    <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#94A3B8' }}>{a.description}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(7), color: '#34D399' }}>{a.action} →</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// 7. REWARDS — XP, level, streaks
// ─────────────────────────────────────────────
function RewardsPage({ data, assets, theme }: PageProps) {
  const xpToNext = XP_PER_LEVEL - data.xpInLevel;
  const levelColors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
  const color = levelColors[(data.level - 1) % levelColors.length];
  return (
    <View style={{ flex: 1, backgroundColor: '#0F172A', padding: scale(20), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color: '#64748B', letterSpacing: scale(2), textTransform: 'uppercase', textAlign: 'center', marginBottom: scale(4) }}>Your Progress</Text>
      <View style={{ alignItems: 'center', marginBottom: scale(16) }}>
        <View style={{ width: scale(64), height: scale(64), borderRadius: scale(32), backgroundColor: color + '20', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: color }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(26), color }}>{data.level}</Text>
        </View>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#64748B', marginTop: scale(4) }}>Level {data.level} · {data.daysIn} days active</Text>
      </View>
      <View style={{ backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(12), marginBottom: scale(12) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: scale(4) }}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#94A3B8' }}>XP to next level</Text>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(9), color }}>{xpToNext} XP</Text>
        </View>
        <View style={{ height: scale(6), backgroundColor: '#334155', borderRadius: scale(3), overflow: 'hidden' }}>
          <View style={{ width: `${data.xpProgress}%`, height: '100%', backgroundColor: color, borderRadius: scale(3) }} />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: scale(8) }}>
        <View style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(10), alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#F1F5F9' }}>🔥{data.streak}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#64748B' }}>streak</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(10), alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#F1F5F9' }}>+{XP_PER_DAY}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#64748B' }}>today XP</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(10), alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(16), color: '#F1F5F9' }}>{data.totalXP}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#64748B' }}>total XP</Text>
        </View>
      </View>
      <View style={{ marginTop: scale(12), backgroundColor: '#1E293B', borderRadius: scale(8), padding: scale(10) }}>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#64748B' }}>📊 Stats</Text>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#94A3B8', marginTop: scale(2) }}>{Math.round(data.barPct)}% to goal · Day {data.dayNum}/{data.totalDays} · {data.daysRemaining} days remaining</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// 10. DAILY REVIEW — steps + assets summary
// ─────────────────────────────────────────────
function ReviewPage({ data, assets, theme, onCompleteDay }: PageProps) {
  const steps = data.steps.length > 0 ? data.steps : [];
  return (
    <View style={{ flex: 1, backgroundColor: '#FAFAFA', padding: scale(24), justifyContent: 'center' }}>
      <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#AAA', letterSpacing: scale(2), textTransform: 'uppercase', marginBottom: scale(4) }}>Day {data.dayNum} Complete?</Text>
      <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(24), color: '#1E293B', lineHeight: scale(30), marginBottom: scale(20) }}>{data.description.substring(0, 40)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: scale(6) }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(42), color: '#1E293B' }}>{Math.round(data.barPct)}</Text>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(14), color: '#CBD5E1', marginLeft: scale(4) }}>% overall</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: scale(24), marginBottom: scale(20) }}>
        <View>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#1E293B' }}>{data.dailyActions}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#CBD5E1' }}>done today</Text>
        </View>
        <View>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#1E293B' }}>{assets.length}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#CBD5E1' }}>assets built</Text>
        </View>
        <View>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#1E293B' }}>🔥{data.streak}</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#CBD5E1' }}>day streak</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: scale(12) }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(10), color: '#1A1A1A', marginBottom: scale(8) }}>📋 Steps completed</Text>
          {steps.map(s => {
            const refAssets = s.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
            return (
              <View key={s.step} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: scale(6), marginBottom: scale(6) }}>
                <View style={{ width: scale(16), height: scale(16), borderRadius: scale(8), backgroundColor: '#E8F0FE', justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(8), color: '#1A56DB' }}>{s.step}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#333' }}>{s.title}</Text>
                  {refAssets.length > 0 && (
                    <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#888' }}>→ {refAssets.map(a => a.title).join(', ')}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: scale(12), marginTop: scale(4) }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(10), color: '#1A1A1A', marginBottom: scale(6) }}>📦 What was built</Text>
          {assets.map(a => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: scale(6), marginBottom: scale(4) }}>
              <Text style={{ fontSize: scale(10) }}>•</Text>
              <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#666', flex: 1 }}>{a.title}</Text>
              {data.steps.find(s => s.assetRefs.includes(a.id)) && (
                <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(7), color: '#1A56DB' }}>step {data.steps.find(s => s.assetRefs.includes(a.id))!.step}</Text>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
      <TouchableOpacity style={{ marginTop: scale(12), backgroundColor: '#102852', borderRadius: scale(10), padding: scale(12), alignItems: 'center' }} onPress={onCompleteDay}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(12), color: '#FFF' }}>✓ Mark Day Complete</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// Asset viewer modal
// ─────────────────────────────────────────────
function AssetModal({ asset, onClose }: { asset: BuiltAsset | null; onClose: () => void }) {
  if (!asset) return null;
  const icons: Record<string, string> = { research: '📚', code: '💻', image: '🎨', deployment: '🚀', summary: '📝' };
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: scale(20) }}>
      <View style={{ backgroundColor: '#FFF', borderRadius: scale(16), padding: scale(20), maxHeight: '80%' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(12) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(8) }}>
            <Text style={{ fontSize: scale(20) }}>{icons[asset.type] || '📦'}</Text>
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#1A1A1A' }}>{asset.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Text style={{ fontSize: scale(18), color: '#999' }}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(11), color: '#666', lineHeight: scale(18), marginBottom: scale(12) }}>
            {asset.content || asset.description}
          </Text>
          {asset.type === 'code' && asset.content && (
            <View style={{ backgroundColor: '#0F172A', borderRadius: scale(8), padding: scale(12) }}>
              <Text style={{ fontFamily: 'monospace', fontSize: scale(9), color: '#E2E8F0', lineHeight: scale(14) }}>{asset.content}</Text>
            </View>
          )}
        </ScrollView>
        <TouchableOpacity style={{ backgroundColor: '#102852', borderRadius: scale(8), padding: scale(12), alignItems: 'center', marginTop: scale(12) }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#FFF' }}>{asset.action}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Session overlay — walk through steps w/ assets
// ─────────────────────────────────────────────
function SessionOverlay({ steps, assets, onClose, onCompleteAll, onOpenAsset }: { steps: StepInstruction[]; assets: BuiltAsset[]; onClose: () => void; onCompleteAll: () => void; onOpenAsset?: (a: BuiltAsset) => void }) {
  const [stepIdx, setStepIdx] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const icons: Record<string, string> = { learn: '📖', practice: '🎯', review: '📦', log: '✅' };
  const current = steps[stepIdx];
  if (!current) return null;
  const refAssets = current.assetRefs.map(id => assets.find(a => a.id === id)).filter(Boolean) as BuiltAsset[];
  const isLast = stepIdx >= steps.length - 1;
  const allDone = doneSteps.size >= steps.length;

  const markDone = () => {
    const next = new Set(doneSteps);
    next.add(stepIdx);
    setDoneSteps(next);
    if (isLast) {
      if (next.size >= steps.length) onCompleteAll();
    } else {
      setStepIdx(i => i + 1);
    }
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: '#0B1121', paddingTop: scale(60), paddingHorizontal: scale(20) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: scale(20) }}>
        <TouchableOpacity onPress={onClose}><Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#94A3B8' }}>← Exit</Text></TouchableOpacity>
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(9), color: '#64748B' }}>Step {stepIdx + 1} of {steps.length}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: scale(4), marginBottom: scale(24) }}>
        {steps.map((_, i) => (
          <View key={i} style={{ flex: 1, height: scale(3), borderRadius: scale(2), backgroundColor: doneSteps.has(i) ? '#34D399' : i === stepIdx ? '#6366F1' : '#1E293B' }} />
        ))}
      </View>
      {allDone ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: scale(48), marginBottom: scale(16) }}>🎉</Text>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(20), color: '#FFF', marginBottom: scale(8) }}>All steps done!</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(12), color: '#94A3B8', textAlign: 'center', marginBottom: scale(24) }}>You've completed today's plan. Ready to wrap up?</Text>
          <TouchableOpacity style={{ backgroundColor: '#34D399', borderRadius: scale(12), paddingHorizontal: scale(32), paddingVertical: scale(14) }} onPress={onCompleteAll}>
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#0B1121' }}>✓ Mark Day Complete</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ marginBottom: scale(16) }}>
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(10), color: '#34D399', marginBottom: scale(4) }}>{icons[current.type]} {current.type.toUpperCase()}</Text>
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(20), color: '#FFF', marginBottom: scale(4) }}>{current.title}</Text>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(11), color: '#94A3B8', lineHeight: scale(17) }}>{current.description}</Text>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#64748B', marginTop: scale(4) }}>{current.duration}</Text>
          </View>
          {refAssets.map(a => (
            <TouchableOpacity key={a.id} style={{ backgroundColor: '#1E293B', borderRadius: scale(10), padding: scale(14), marginBottom: scale(8), flexDirection: 'row', alignItems: 'center', gap: scale(10) }} onPress={() => onOpenAsset?.(a)}>
              <Text style={{ fontSize: scale(20) }}>{a.type === 'research' ? '📚' : a.type === 'code' ? '💻' : a.type === 'deployment' ? '🚀' : a.type === 'summary' ? '📝' : '📦'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(11), color: '#FFF' }}>{a.title}</Text>
                <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(8), color: '#94A3B8' }}>{a.description}</Text>
              </View>
              <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(8), color: '#34D399' }}>{a.action} →</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={{ backgroundColor: '#102852', borderRadius: scale(12), padding: scale(14), alignItems: 'center', marginTop: scale(8) }} onPress={markDone}>
            <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(13), color: '#FFF' }}>
              {doneSteps.has(stepIdx) ? '✓ Done' : isLast ? 'Complete Step →' : 'Mark Done & Continue →'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const PAGES: { id: string; comp: React.FC<PageProps> }[] = [
  { id: 'plan', comp: PlanPage },
  { id: 'built', comp: BuiltPage },
  { id: 'path', comp: PathPage },
  { id: 'assets', comp: AssetsPage },
  { id: 'hex', comp: HexPage },
  { id: 'instructions', comp: InstructionsPage },
  { id: 'rewards', comp: RewardsPage },
  { id: 'review', comp: ReviewPage },
];

const THEMES = [
  { accent: '#102852', bg: '#F5F5F5', text: '#1A1A1A', muted: '#999' },
  { accent: '#059669', bg: '#F8F6F0', text: '#1A1A1A', muted: '#999' },
  { accent: '#818CF8', bg: '#0C0C1D', text: '#FFF', muted: '#64748B' },
  { accent: '#1A1A1A', bg: '#F5F0EB', text: '#1A1A1A', muted: '#BBB' },
  { accent: '#10B981', bg: '#0F172A', text: '#FFF', muted: '#64748B' },
  { accent: '#34D399', bg: '#0B1121', text: '#FFF', muted: '#64748B' },
  { accent: '#8B5CF6', bg: '#0F172A', text: '#FFF', muted: '#64748B' },
  { accent: '#94A3B8', bg: '#FAFAFA', text: '#1E293B', muted: '#CBD5E1' },
];

export default function GoalJourneyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const goalId = params.goalId as string;
  const hobbyFallback = params.hobbyId as string | undefined;
  const startSessionParam = params.startSession as string | undefined;
  const pageParam = params.page as string | undefined;
  const goals = useGoalStore(s => s.goals);
  const progressRecords = useGoalStore(s => s.progress);

  const [currentPage, setCurrentPage] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [snapshotOverride, setSnapshotOverride] = useState<GoalSnapshot | null>(null);
  const [todayContent, setTodayContent] = useState<DailyGoalContent | null>(null);
  const [contentLoading, setContentLoading] = useState(true);
  const [planSteps, setPlanSteps] = useState<StepInstruction[]>([]);
  const [builtAssets, setBuiltAssets] = useState<BuiltAsset[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [viewingAsset, setViewingAsset] = useState<BuiltAsset | null>(null);
  const [finished, setFinished] = useState(false);
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const [retryCount, setRetryCount] = useState(0);
  const flatRef = useRef<FlatList>(null);

  useEffect(() => { setRetryCount(0); }, [goalId]);
  useEffect(() => {
    if (!goals[goalId] && !hobbyFallback && !Object.values(goals).find(g => g.status === 'active')) {
      if (retryCount < 3) { const t = setTimeout(() => setRetryCount(c => c + 1), 500); return () => clearTimeout(t); }
    }
  }, [goalId, hobbyFallback, goals, retryCount]);

  const resolved = useMemo(() => {
    let g = goals[goalId] || Object.values(goals).find(g => g.id === goalId) || null;
    if (g) { const p = progressRecords[g.id] || getInitialProgress(g.id, g.startingValue); return { goal: g, progress: p }; }
    if (progressRecords[goalId]) {
      const stub: any = { id: goalId, hobby: hobbyFallback || 'goal', type: 'execution_count', category: 'execution', target: 1, deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0], startDate: new Date().toISOString().split('T')[0], startingValue: 0, description: 'Goal', status: 'active', unitLabel: 'units' };
      useGoalStore.getState().setGoal(stub);
      return { goal: stub, progress: progressRecords[goalId] };
    }
    if (hobbyFallback) { const snap = useGoalStore.getState().getSnapshot(hobbyFallback as any); if (snap) return { goal: snap.definition, progress: snap.progress }; }
    const active = Object.values(goals).find(g => g.status === 'active');
    if (active) { const p = progressRecords[active.id] || getInitialProgress(active.id, active.startingValue); return { goal: active, progress: p }; }
    return null;
  }, [goalId, hobbyFallback, goals, progressRecords]);

  const snapshot = useMemo(() => {
    if (snapshotOverride) return snapshotOverride;
    if (!resolved) return null;
    return useGoalStore.getState().getSnapshotById(resolved.goal.id);
  }, [snapshotOverride, resolved]);

  useEffect(() => {
    if (!resolved || !resolved.goal) return;
    setContentLoading(true);
    let cancelled = false;
    useGoalStore.getState().getOrGenerateDailyContent(resolved.goal.id);
    const todayStr = new Date().toISOString().split('T')[0];
    const fresh = useGoalStore.getState().getSnapshotById(resolved.goal.id);
    if (fresh && !cancelled) {
      const c = fresh.progress.dailyContent?.[todayStr];
      if (c) { setTodayContent(c); setContentLoading(false); setSnapshotOverride(fresh); }
    }
    return () => { cancelled = true; };
  }, [resolved]);

  // ── Agent orchestrator: generates plan + builds assets ──
  useEffect(() => {
    if (!resolved || !todayContent) return;
    let cancelled = false;
    // Check for stored plan first
    const existing = useGoalStore.getState().progress[resolved.goal.id]?.dailyPlan;
    if (existing && existing.steps.length > 0 && existing.assets.length > 0) {
      setPlanSteps(existing.steps);
      setBuiltAssets(existing.assets);
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    orchestrateDailyPlan(resolved.goal, resolved.progress, todayContent).then(plan => {
      if (!cancelled) {
        useGoalStore.getState().setDailyPlan(resolved.goal.id, plan);
        setPlanSteps(plan.steps);
        setBuiltAssets(plan.assets);
        setPlanLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setPlanLoading(false);
    });
    return () => { cancelled = true; };
  }, [resolved, todayContent]);

  // ── Celebration animation ──
  useEffect(() => {
    if (finished) {
      celebrationAnim.setValue(0);
      Animated.spring(celebrationAnim, { toValue: 1, useNativeDriver: true, friction: 4 }).start();
    }
  }, [finished]);

  // ── Handle deep-link params from coach ──
  useEffect(() => {
    if (planSteps.length > 0 && startSessionParam === '1' && !sessionActive) {
      setSessionActive(true);
    }
  }, [planSteps, startSessionParam]);
  useEffect(() => {
    if (pageParam) {
      const pageIndex = PAGES.findIndex(p => p.id === pageParam);
      if (pageIndex >= 0) goToSlide(pageIndex);
    }
  }, [pageParam]);

  const goToSlide = useCallback((index: number) => {
    flatRef.current?.scrollToIndex({ index, animated: true });
    setCurrentPage(index);
  }, []);

  const onScrollEnd = useCallback((e: any) => {
    setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / SLIDE_W));
  }, []);

  if (!resolved) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(18), color: '#666' }}>Goal not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: scale(16), paddingHorizontal: scale(24), paddingVertical: scale(12), backgroundColor: '#102852', borderRadius: scale(24) }}>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(14), color: '#FFF' }}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }
  if (!snapshot) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="small" color="#059669" />
        <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(13), color: '#999', marginTop: 12 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const goal = snapshot.definition;
  const progress = snapshot.progress;
  const currentVal = (goal.category === 'skill' ? (progress.currentDifficulty ?? goal.difficultyScore ?? 500) : progress.currentValue);
  const targetVal = (goal.category === 'skill' ? (goal.targetDifficulty ?? goal.target) : goal.target);
  const barPct = Math.min(100, Math.max(0, (currentVal / Math.max(1, targetVal)) * 100));
  const unit = goal.unitLabel || (goal.category === 'skill' ? 'pts' : 'units');
  const daysIn = progress.history.length;
  const totalXP = daysIn * XP_PER_DAY;
  const { level, xpInLevel, xpProgress, levelColor } = calcLevel(totalXP);
  const today = todayContent;
  const learnTitle = today?.learn?.title || '';
  const learnBody = today?.learn?.body || '';
  const doTitle = today?.doNow?.title || '';
  const doInstructions = today?.doNow?.instructions || '';
  const doMinutes = today?.doNow?.estimatedMinutes || 15;
  const bodyLines = learnBody.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
  const hasContent = !contentLoading && today !== null;
  const focusBadge = today?.focusReason?.includes('first day') ? 'ONBOARD' : today?.focusReason?.includes('rebuild') ? 'RECOVERY' : today?.focusReason?.includes('cleared') ? 'UNBLOCK' : today?.focusReason?.includes('push') ? 'PUSH' : today?.focusReason?.includes('consolidate') || today?.focusReason?.includes('missed') ? 'CONSOLIDATE' : today?.focusReason?.includes('milestone') ? 'MILESTONE' : 'STEADY';
  const { deadline, startDate, description } = goal;
  const totalDays = Math.max(1, Math.ceil((new Date(deadline).getTime() - new Date(startDate).getTime()) / 86400000));
  const dayNum = Math.min(totalDays, daysIn + 1);
  const daysRemaining = snapshot.daysRemaining;

  const pageData = {
    description, barPct, currentVal, targetVal, unit, streak: progress.streak,
    dailyActions: progress.dailyActions, daysIn, level, xpInLevel, xpProgress, levelColor,
    totalXP, daysRemaining, dayNum, totalDays, learnTitle, learnBody, doTitle, doInstructions,
    doMinutes, focusReason: today?.focusReason || '', bodyLines, instrLines: [],
    hasContent, milestones: progress.milestones, currentMilestoneIndex: progress.currentMilestoneIndex,
    focusBadge, agentActions: [], allDone: false, commitmentText: '', finished,
    steps: planSteps,
  };

  const displayAssets: BuiltAsset[] = builtAssets.length > 0
    ? builtAssets
    : hasContent
      ? [
          { id: 'research-1', type: 'research', title: `${learnTitle || 'Topic'} — Summary`, description: bodyLines[0]?.substring(0, 80) || 'Key points extracted for today.', action: 'Read', supportsStep: 1 } as BuiltAsset,
          { id: 'practice-1', type: 'summary', title: doTitle || 'Practice Brief', description: `${doMinutes}min exercise prepared for you.`, action: 'Start', supportsStep: 2 } as BuiltAsset,
        ]
      : [];

  if (finished) {
    const celebScale = celebrationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#EAF0F8' }}>
        <Animated.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: scale(24), transform: [{ scale: celebScale }] }}>
          <View style={{ width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', marginBottom: scale(16) }}>
            <Text style={{ fontSize: scale(36) }}>🎉</Text>
          </View>
          <Text style={{ fontFamily: fonts.heading.bold, fontSize: scale(24), color: '#08132A', marginBottom: scale(8) }}>Day {dayNum} Complete</Text>
          <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(14), color: '#666', textAlign: 'center', marginBottom: scale(24) }}>
            {level > 1 ? `Level ${level} · ` : ''}{xpInLevel + XP_PER_DAY}/{XP_PER_LEVEL} XP
          </Text>
          <View style={[ss.xpBarOuter, { width: '80%', marginBottom: scale(24) }]}>
            <View style={[ss.xpBarFill, { width: `${Math.min(100, ((xpInLevel + XP_PER_DAY) / XP_PER_LEVEL) * 100)}%`, backgroundColor: levelColor }]} />
          </View>
          <View style={{ flexDirection: 'row', gap: scale(12), marginBottom: scale(32) }}>
            <View style={ss.doneStat}><Text style={ss.doneStatVal}>{Math.round(barPct)}%</Text><Text style={ss.doneStatLbl}>goal</Text></View>
            <View style={ss.doneStat}><Text style={ss.doneStatVal}>🔥{progress.streak}</Text><Text style={ss.doneStatLbl}>streak</Text></View>
            <View style={ss.doneStat}><Text style={ss.doneStatVal}>{Math.round(currentVal)}</Text><Text style={ss.doneStatLbl}>/{Math.round(targetVal)}</Text></View>
          </View>
          <TouchableOpacity style={ss.primaryBtn} onPress={() => router.back()}><Text style={ss.primaryBtnText}>Back</Text></TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
  }

  const theme = THEMES[currentPage];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: scale(16), paddingTop: scale(50), paddingBottom: scale(8) }}>
        <TouchableOpacity onPress={() => { if (currentPage > 0) goToSlide(currentPage - 1); }} style={{ padding: scale(4), opacity: currentPage > 0 ? 1 : 0.3 }}>
          <Text style={{ fontSize: scale(18), color: theme.text, fontFamily: fonts.heading.bold }}>←</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: scale(3) }}>
          {PAGES.map((_, i) => (
            <View key={i} style={{ width: scale(5 + (i === currentPage ? 6 : 0)), height: scale(5), borderRadius: scale(2.5), backgroundColor: i === currentPage ? theme.accent : '#D1D5DB' }} />
          ))}
        </View>
        <TouchableOpacity onPress={() => setShowMenu(!showMenu)} style={{ padding: scale(4) }}>
          <Text style={{ fontSize: scale(18), color: theme.text === '#FFF' || theme.text === '#F1F5F9' ? '#999' : theme.muted }}>⋯</Text>
        </TouchableOpacity>
      </View>
      {showMenu && (
        <View style={{ position: 'absolute', top: scale(56), left: scale(16), right: scale(16), zIndex: 100, backgroundColor: '#FFF', borderRadius: scale(12), borderWidth: 1, borderColor: '#E5E5E5', paddingVertical: scale(4) }}>
          <TouchableOpacity style={{ paddingHorizontal: scale(16), paddingVertical: scale(12) }} onPress={() => { setShowMenu(false); router.push(buildRoute(ROUTES.GOAL_SETUP, { edit: goal.id, hobbyId: goal.hobby }) as any); }}>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(14) }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingHorizontal: scale(16), paddingVertical: scale(12) }} onPress={() => { setShowMenu(false); useGoalStore.getState().pauseGoal(goal.id); router.back(); }}>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(14) }}>Pause</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ paddingHorizontal: scale(16), paddingVertical: scale(12) }} onPress={() => { setShowMenu(false); Alert.alert('', 'Cannot be undone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Abandon', style: 'destructive', onPress: () => { useGoalStore.getState().abandonGoal(goal.hobby); router.back(); } }]); }}>
            <Text style={{ fontFamily: fonts.body.regular, fontSize: scale(14), color: '#EF4444' }}>Abandon</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        ref={flatRef}
        data={PAGES}
        keyExtractor={(item) => item.id}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        renderItem={({ item, index }) => {
          const t = THEMES[index];
          const PageComp = item.comp;
          return (
            <View style={{ width: SLIDE_W, flex: 1 }}>
              <PageComp
                data={pageData}
                assets={displayAssets}
                theme={t}
                index={index} total={PAGES.length}
                onStartSession={() => setSessionActive(true)}
                onCompleteDay={() => {
                  // Containment (Phase 1 follow-up — same model as GoalDetail
                  // did_it): a tap acknowledges UI state only. No
                  // recordDailyAction, no completeDailyContent. Validated
                  // progress is written exclusively by the swipe-session
                  // finalizer, so the celebration below reflects only real
                  // sessions.
                  setFinished(true);
                  setSessionActive(false);
                }}
                onOpenAsset={(a: BuiltAsset) => setViewingAsset(a)}
              />
              {index < PAGES.length - 1 && (
                <TouchableOpacity
                  onPress={() => goToSlide(index + 1)}
                  style={[ss.nextBtn, { position: 'absolute', bottom: scale(20), alignSelf: 'center', backgroundColor: t.accent }]}
                >
                  <Text style={[ss.nextBtnText, { color: t.bg }]}>Next →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        getItemLayout={(_, index) => ({ length: SLIDE_W, offset: SLIDE_W * index, index })}
        initialNumToRender={2}
        windowSize={3}
        removeClippedSubviews={false}
      />
      {sessionActive && planSteps.length > 0 && (
        <SessionOverlay
          steps={planSteps}
          assets={displayAssets}
          onClose={() => setSessionActive(false)}
          onOpenAsset={(a) => setViewingAsset(a)}
          onCompleteAll={() => {
            // Containment (Phase 1 follow-up): local step checklist is
            // acknowledgement only — same rule as onCompleteDay above.
            setFinished(true);
            setSessionActive(false);
          }}
        />
      )}
      {viewingAsset && (
        <AssetModal asset={viewingAsset} onClose={() => setViewingAsset(null)} />
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  xpBarOuter: { height: scale(8), backgroundColor: '#E5E7EB', borderRadius: scale(4), overflow: 'hidden' },
  xpBarFill: { height: '100%', backgroundColor: '#7C3AED', borderRadius: scale(4) },
  doneStat: { backgroundColor: '#FFF', borderRadius: scale(12), padding: scale(12), alignItems: 'center', minWidth: scale(76) },
  doneStatVal: { fontFamily: fonts.heading.bold, fontSize: scale(16) },
  doneStatLbl: { fontFamily: fonts.body.regular, fontSize: scale(9), color: '#888', marginTop: scale(2) },
  nextBtn: { paddingHorizontal: scale(40), paddingVertical: scale(12), borderRadius: scale(24) },
  nextBtnText: { fontFamily: fonts.heading.bold, fontSize: scale(14) },
  primaryBtn: { paddingHorizontal: scale(32), paddingVertical: scale(14), backgroundColor: '#102852', borderRadius: scale(24) },
  primaryBtnText: { fontFamily: fonts.heading.bold, fontSize: scale(15), color: '#FFF' },
});
