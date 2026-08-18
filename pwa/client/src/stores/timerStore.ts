import { create } from 'zustand';
import { api } from '../lib/api';
import { offlineDb, isOnline } from '../lib/offline';
import { getTimerElapsedMs } from '../lib/utils';
import type { ActiveTimer } from '../types';

interface TimerState {
  timer: ActiveTimer | null;
  elapsedMs: number;
  tickInterval: ReturnType<typeof setInterval> | null;

  fetchTimer: () => Promise<void>;
  start: (activityId: string, notes?: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  startTick: () => void;
  stopTick: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  timer: null,
  elapsedMs: 0,
  tickInterval: null,

  fetchTimer: async () => {
    try {
      const timer = await api.timer.get();
      set({ timer, elapsedMs: timer ? getTimerElapsedMs(timer) : 0 });
      if (timer && !timer.paused_at) get().startTick();
    } catch {
      const cached = await offlineDb.cachedTimer.toArray();
      if (cached[0]) {
        const t = cached[0];
        set({
          timer: {
            user_id: t.userId,
            activity_id: t.activityId,
            started_at: t.startedAt,
            paused_at: t.pausedAt,
            accumulated_ms: t.accumulatedMs,
            notes: t.notes,
            activity_name: t.activityName,
            color: t.color,
            emoji: t.emoji,
            group_name: '',
          },
          elapsedMs: t.pausedAt ? t.accumulatedMs : t.accumulatedMs + (Date.now() - new Date(t.startedAt).getTime()),
        });
      }
    }
  },

  start: async (activityId, notes) => {
    const timer = await api.timer.start(activityId, notes);
    set({ timer, elapsedMs: 0 });
    get().startTick();
  },

  pause: async () => {
    const timer = await api.timer.pause();
    set({ timer, elapsedMs: getTimerElapsedMs(timer) });
    get().stopTick();
  },

  resume: async () => {
    const timer = await api.timer.resume();
    set({ timer });
    get().startTick();
  },

  stop: async () => {
    await api.timer.stop();
    set({ timer: null, elapsedMs: 0 });
    get().stopTick();
    await offlineDb.cachedTimer.clear();
  },

  startTick: () => {
    get().stopTick();
    const interval = setInterval(() => {
      const { timer } = get();
      if (timer && !timer.paused_at) {
        set({ elapsedMs: getTimerElapsedMs(timer) });
      }
    }, 1000);
    set({ tickInterval: interval });
  },

  stopTick: () => {
    const { tickInterval } = get();
    if (tickInterval) clearInterval(tickInterval);
    set({ tickInterval: null });
  },
}));
