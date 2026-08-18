import { useEffect, useState } from 'react';
import { Play, Pause, Square, Plus } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useTimerStore } from '../stores/timerStore';
import { api } from '../lib/api';
import { formatTimerDisplay, today, formatClockTime, formatDuration } from '../lib/utils';
import Modal from '../components/Modal';
import EmptyState from '../components/EmptyState';
import type { TimeEntry } from '../types';

export default function TimeTracker() {
  const { activities, entries, fetchEntries, fetchActivities, addToast, settings } = useAppStore();
  const { timer, elapsedMs, fetchTimer, start, pause, resume, stop } = useTimerStore();
  const [selectedActivity, setSelectedActivity] = useState('');
  const [notes, setNotes] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);

  useEffect(() => {
    fetchActivities();
    fetchTimer();
    fetchEntries(today());
  }, [fetchActivities, fetchTimer, fetchEntries]);

  useEffect(() => {
    if (activities.length && !selectedActivity) {
      setSelectedActivity(settings?.default_activity_id || activities[0].id);
    }
  }, [activities, selectedActivity, settings]);

  const handleStart = async () => {
    if (!selectedActivity) return;
    await start(selectedActivity, notes || undefined);
    addToast('Timer started');
  };

  const handleStop = async () => {
    await stop();
    fetchEntries(today());
    addToast('Time entry saved');
  };

  const todayEntries = entries.filter(e => e.date === today());

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Time Tracker</h1>
        <p className="text-sm text-muted mt-1">Track your activities in real time</p>
      </div>

      {/* Timer card */}
      <div className="card p-6 md:p-8 text-center">
        {timer ? (
          <>
            <div
              className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4"
              style={{ backgroundColor: timer.color + '22' }}
            >
              {timer.emoji}
            </div>
            <h2 className="text-xl font-display font-semibold">{timer.activity_name}</h2>
            <p className="text-5xl md:text-6xl font-display font-bold my-6 font-mono text-productive">
              {formatTimerDisplay(elapsedMs)}
            </p>
            <p className="text-sm text-muted mb-6">
              Started at {formatClockTime(new Date(timer.started_at).toTimeString().slice(0, 5), settings?.time_format || '24h')}
              {timer.paused_at && ' · Paused'}
            </p>
            <div className="flex justify-center gap-3">
              {timer.paused_at ? (
                <button onClick={resume} className="btn-primary px-8 py-3 text-base">
                  <Play className="w-5 h-5" /> Resume
                </button>
              ) : (
                <button onClick={pause} className="btn-secondary px-8 py-3 text-base">
                  <Pause className="w-5 h-5" /> Pause
                </button>
              )}
              <button onClick={handleStop} className="btn-danger px-8 py-3 text-base">
                <Square className="w-5 h-5" /> Stop
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-5xl md:text-6xl font-display font-bold my-6 font-mono text-muted">00:00</p>
            <div className="max-w-sm mx-auto space-y-4">
              <select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)} className="input">
                {activities.map(a => (
                  <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>
                ))}
              </select>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="input" />
              <button onClick={handleStart} disabled={!selectedActivity} className="btn-primary w-full py-3 text-base">
                <Play className="w-5 h-5" /> Start Timer
              </button>
            </div>
          </>
        )}
      </div>

      {/* Today's entries */}
      <div className="card">
        <div className="p-5 border-b border-border dark:border-border-dark flex items-center justify-between">
          <h2 className="font-display font-semibold">Today's Entries</h2>
          <button onClick={() => setShowManual(true)} className="btn-secondary text-sm">
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
        {todayEntries.length === 0 ? (
          <EmptyState title="No entries yet" description="Start a timer or add a manual entry" />
        ) : (
          <div className="divide-y divide-border dark:divide-border-dark">
            {todayEntries.map(entry => {
              const act = activities.find(a => a.id === entry.activity_id);
              return (
                <div key={entry.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0" style={{ backgroundColor: (act?.color || '#6366F1') + '22' }}>
                    {act?.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{act?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted">
                      {formatClockTime(entry.start_time, settings?.time_format || '24h')}
                      {entry.end_time && ` – ${formatClockTime(entry.end_time, settings?.time_format || '24h')}`}
                      {entry.notes && ` · ${entry.notes}`}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatDuration(entry.duration_minutes)}</span>
                  <div className="flex gap-1">
                    <button onClick={() => setEditEntry(entry)} className="btn-ghost text-xs py-1 px-2">Edit</button>
                    <button
                      onClick={async () => {
                        await api.timeEntries.delete(entry.id);
                        fetchEntries(today());
                        addToast('Entry deleted');
                      }}
                      className="btn-ghost text-xs py-1 px-2 text-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ManualEntryModal
        open={showManual || !!editEntry}
        onClose={() => { setShowManual(false); setEditEntry(null); }}
        activities={activities}
        entry={editEntry}
        onSave={() => { fetchEntries(today()); setShowManual(false); setEditEntry(null); addToast('Entry saved'); }}
      />
    </div>
  );
}

function ManualEntryModal({ open, onClose, activities, entry, onSave }: {
  open: boolean; onClose: () => void; activities: import('../types').Activity[];
  entry: TimeEntry | null; onSave: () => void;
}) {
  const [activityId, setActivityId] = useState(entry?.activity_id || '');
  const [startTime, setStartTime] = useState(entry?.start_time || '09:00');
  const [endTime, setEndTime] = useState(entry?.end_time || '10:00');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [date, setDate] = useState(entry?.date || today());

  const handleSave = async () => {
    const body = { activityId, date, startTime, endTime, notes };
    if (entry) await api.timeEntries.update(entry.id, body);
    else await api.timeEntries.create(body);
    onSave();
  };

  return (
    <Modal open={open} onClose={onClose} title={entry ? 'Edit Entry' : 'Add Manual Entry'}>
      <div className="space-y-4">
        <div>
          <label className="label">Activity</label>
          <select value={activityId} onChange={e => setActivityId(e.target.value)} className="input">
            {activities.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Start</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">End</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="input" />
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)} className="input" placeholder="Optional" />
        </div>
        <button onClick={handleSave} className="btn-primary w-full">Save Entry</button>
      </div>
    </Modal>
  );
}
