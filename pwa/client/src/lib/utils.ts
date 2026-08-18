import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  parseISO,
  addDays,
} from 'date-fns';

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? parseISO(d) : d;
  return format(date, 'yyyy-MM-dd');
}

export function today(): string {
  return formatDate(new Date());
}

export function getPeriodRange(period: string, customStart?: string, customEnd?: string) {
  const now = new Date();
  switch (period) {
    case 'today':
      return { startDate: formatDate(now), endDate: formatDate(now) };
    case 'week':
      return {
        startDate: formatDate(startOfWeek(now, { weekStartsOn: 1 })),
        endDate: formatDate(endOfWeek(now, { weekStartsOn: 1 })),
      };
    case 'month':
      return {
        startDate: formatDate(startOfMonth(now)),
        endDate: formatDate(endOfMonth(now)),
      };
    case 'year':
      return {
        startDate: formatDate(startOfYear(now)),
        endDate: formatDate(endOfYear(now)),
      };
    case 'custom':
      return { startDate: customStart || formatDate(now), endDate: customEnd || formatDate(now) };
    default:
      return { startDate: formatDate(now), endDate: formatDate(now) };
  }
}

export function blockIndexToTime(index: number): string {
  const h = Math.floor(index / 2);
  const m = (index % 2) * 30;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function timeToBlockIndex(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 2 + (m >= 30 ? 1 : 0);
}

export function formatDuration(minutes: number, timeFormat: '12h' | '24h' = '24h'): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatClockTime(time: string, timeFormat: '12h' | '24h' = '24h'): string {
  const [h, m] = time.split(':').map(Number);
  if (timeFormat === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export function getHourBand(hour: number) {
  if (hour >= 0 && hour <= 5) return { bg: '#1E2A4A', fg: '#C7D2FE', label: 'Night' };
  if (hour >= 6 && hour <= 11) return { bg: '#FFF3D6', fg: '#8A6D1D', label: 'Morning' };
  if (hour >= 12 && hour <= 17) return { bg: '#DDEBFF', fg: '#2B5CAB', label: 'Afternoon' };
  return { bg: '#EDE4FB', fg: '#5E3B96', label: 'Evening' };
}

export function getDaysInRange(start: string, end: string): string[] {
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(formatDate);
}

export function isFriday(dateStr: string): boolean {
  return parseISO(dateStr).getDay() === 5;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getTimerElapsedMs(timer: {
  started_at: string;
  paused_at: string | null;
  accumulated_ms: number;
}): number {
  if (timer.paused_at) return timer.accumulated_ms;
  return timer.accumulated_ms + (Date.now() - new Date(timer.started_at).getTime());
}

export function formatTimerDisplay(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const DEFAULT_GROUPS = [
  { name: 'Programming', emoji: '💻', color: '#057c31' },
  { name: 'English', emoji: '📚', color: '#2563EB' },
  { name: 'Exercises', emoji: '🏋️', color: '#EA580C' },
  { name: 'Meditate', emoji: '🧘', color: '#8e029b' },
  { name: 'Work', emoji: '🧑‍💻', color: '#89fd05' },
  { name: 'Personal Tasks', emoji: '📋', color: '#eeeeee' },
  { name: 'Sleep', emoji: '😴', color: '#4e4d44' },
  { name: 'Wasted Time', emoji: '⌛', color: '#ff1500' },
];

export const SCORE_EXPLANATION = `Your productivity score (0–100) is calculated from monthly goals:
• Programming goal → up to 25 points
• English goal → up to 15 points
• Exercises goal → up to 12 points
• Meditation goal → up to 8 points
• Work goal → up to 10 points
• Personal Tasks goal → up to 5 points
• Healthy sleep (near ideal/day) → up to 25 points
• Wasted time → up to −25 points penalty`;
