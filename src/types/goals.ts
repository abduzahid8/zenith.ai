import { HobbyId } from '../data/lessonContent';

export type GoalCategory = 'skill' | 'execution';

export type GoalType =
  | 'skill_rating'
  | 'skill_course'
  | 'skill_time'
  | 'skill_distance'
  | 'reading_books'
  | 'reading_minutes'
  | 'reading_pages'
  | 'execution_count';

export interface ToolRecommendation {
  name: string;
  description: string;
  category: string;
  cost: 'free' | 'low' | 'medium' | 'high';
  setup: 'instant' | 'minutes' | 'hours' | 'days';
  effort: 'none' | 'low' | 'medium' | 'high';
  url?: string;
  reason: string;
}

export interface BottleneckAnalysis {
  bottleneck: string;
  severity: 'mild' | 'moderate' | 'severe';
  recommendations: ToolRecommendation[];
  label: string;
}

export type HelpMode = 'milestone' | 'tactical' | 'tools' | 'troubleshoot';

export interface Milestone {
  label: string;
  target: number;
  currentValue: number;
  unit: string;
}

export interface GoalDefinition {
  id: string;
  hobby: HobbyId;
  type: GoalType;
  category: GoalCategory;
  target: number;
  deadline: string;
  startDate: string;
  startingValue: number;
  description: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  difficultyScore?: number;
  targetDifficulty?: number;
  unitLabel?: string;
}

export interface GoalProgressEntry {
  date: string;
  value: number;
  description: string;
  type?: 'task' | 'checkin' | 'bottleneck';
}

export interface GoalProgress {
  goalId: string;
  currentValue: number;
  currentDifficulty?: number;
  lastUpdated: string;
  dailyActions: number;
  streak: number;
  history: GoalProgressEntry[];
  lastBottleneck?: BottleneckAnalysis;
  velocityTrend?: number;
  currentMode: HelpMode;
  milestones: Milestone[];
  currentMilestoneIndex: number;
}

export interface GoalSnapshot {
  definition: GoalDefinition;
  progress: GoalProgress;
  percentComplete: number;
  daysRemaining: number;
  projectedCompletion: 'on_track' | 'ahead' | 'behind';
  unitsRemaining: number;
  dailyRateNeeded: number;
  unitLabel: string;
}
