export interface User {
  id: string;
  username: string;
  email: string;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  text_color: string;
  group_name: string;
  productive: number;
  sort_order: number;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  activity_id: string;
  date: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  notes: string | null;
  source: string;
}

export interface TimeBlock {
  id: string;
  user_id: string;
  activity_id: string;
  date: string;
  block_index: number;
  activity_name?: string;
  color?: string;
  emoji?: string;
}

export interface Task {
  id: string;
  user_id: string;
  activity_id: string | null;
  title: string;
  notes: string | null;
  date: string;
  priority: 'low' | 'medium' | 'high';
  completed: number;
}

export interface ActiveTimer {
  user_id: string;
  activity_id: string;
  started_at: string;
  paused_at: string | null;
  accumulated_ms: number;
  notes: string | null;
  activity_name: string;
  color: string;
  emoji: string;
  group_name: string;
}

export interface UserSettings {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  time_format: '12h' | '24h';
  week_start: 'monday' | 'sunday';
  default_activity_id: string | null;
  goal_programming: number;
  goal_english: number;
  goal_exercise: number;
  goal_meditation: number;
  goal_work: number;
  goal_personal: number;
  ideal_sleep: number;
  wasted_limit: number;
  month_start: string | null;
}

export interface AnalyticsData {
  totalMinutes: number;
  productiveMinutes: number;
  breakMinutes: number;
  totalHours: number;
  productiveHours: number;
  breakHours: number;
  completedTasks: number;
  totalTasks: number;
  productivityScore: number;
  scoreLabel: string;
  scoreEmoji: string;
  scoreBreakdown: { name: string; points: number; max: number }[];
  groupHours: Record<string, number>;
  activityTotals: Record<string, number>;
  dailyBreakdown: Record<string, { total: number; productive: number; byGroup: Record<string, number> }>;
  goals: Record<string, number>;
}

export type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
