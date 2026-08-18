import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Play, CheckCircle2, Target, TrendingUp } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { useTimerStore } from '../stores/timerStore';
import StatCard, { StatCardSkeleton } from '../components/StatCard';
import { getPeriodRange, formatDuration, today, SCORE_EXPLANATION } from '../lib/utils';
import { api } from '../lib/api';

export default function Dashboard() {
  const { analytics, activities, tasks, fetchAnalytics, fetchTasks, loading } = useAppStore();
  const { timer } = useTimerStore();
  const [clock, setClock] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const { startDate, endDate } = getPeriodRange('today');
    fetchAnalytics(startDate, endDate, 'today');
    fetchTasks(today());
  }, [fetchAnalytics, fetchTasks]);

  const todayTasks = tasks.filter(t => t.date === today());
  const completedTasks = todayTasks.filter(t => t.completed);
  const pendingTasks = todayTasks.filter(t => !t.completed);

  const toggleTask = async (id: string, completed: number) => {
    await api.tasks.update(id, { completed: !completed });
    fetchTasks(today());
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{format(clock, 'EEEE, MMMM d, yyyy')}</p>
          <h1 className="text-3xl font-display font-bold mt-1">
            {format(clock, 'h:mm:ss a')}
          </h1>
        </div>
        {timer ? (
          <Link to="/tracker" className="btn-primary">
            <Play className="w-4 h-4" /> {timer.emoji} {timer.activity_name}
          </Link>
        ) : (
          <Link to="/tracker" className="btn-primary">
            <Play className="w-4 h-4" /> Start Timer
          </Link>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Tracked Today" value={formatDuration(analytics?.totalMinutes || 0)} icon="⏱️" />
            <StatCard label="Productive Time" value={formatDuration(analytics?.productiveMinutes || 0)} icon="⚡" color="text-productive" />
            <StatCard label="Break / Rest" value={formatDuration(analytics?.breakMinutes || 0)} icon="☕" />
            <StatCard label="Completed Tasks" value={`${completedTasks.length}/${todayTasks.length}`} icon="✅" />
            <StatCard label="Activities" value={activities.length} icon="🎨" />
            <StatCard
              label="Productivity Score"
              value={analytics ? `${analytics.productivityScore}/100` : '—'}
              subtitle={analytics ? `${analytics.scoreEmoji} ${analytics.scoreLabel}` : undefined}
              icon="🏆"
              color="text-primary"
            />
            <StatCard
              label="Goal Progress"
              value={analytics ? `${Math.round((analytics.productiveMinutes / 480) * 100)}%` : '—'}
              subtitle="8h productive goal"
              icon="🎯"
              color="text-productive"
            />
            <StatCard label="Active Timer" value={timer ? 'Running' : 'None'} icon={timer ? '🔴' : '⏸️'} />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Daily To-Do */}
        <div className="lg:col-span-1 card">
          <div className="p-5 border-b border-border dark:border-border-dark flex items-center justify-between">
            <h2 className="font-display font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Today's Tasks
            </h2>
            <Link to="/tasks" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {pendingTasks.length === 0 && completedTasks.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No tasks for today</p>
            ) : (
              <>
                {pendingTasks.map(task => (
                  <label key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!task.completed}
                      onChange={() => toggleTask(task.id, task.completed)}
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <p className="text-sm">{task.title}</p>
                      <span className={`text-[10px] uppercase font-medium ${
                        task.priority === 'high' ? 'text-error' : task.priority === 'medium' ? 'text-warning' : 'text-muted'
                      }`}>{task.priority}</span>
                    </div>
                  </label>
                ))}
                {completedTasks.map(task => (
                  <label key={task.id} className="flex items-start gap-3 p-2 rounded-lg opacity-50 cursor-pointer">
                    <input type="checkbox" checked onChange={() => toggleTask(task.id, task.completed)} className="mt-0.5 rounded" />
                    <p className="text-sm line-through">{task.title}</p>
                  </label>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Activity distribution */}
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-display font-semibold flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" /> Today's Activity Distribution
          </h2>
          {analytics?.groupHours && Object.keys(analytics.groupHours).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(analytics.groupHours)
                .sort(([, a], [, b]) => b - a)
                .map(([group, hours]) => {
                  const total = analytics.totalHours || 1;
                  const pct = Math.round((hours / total) * 100);
                  const act = activities.find(a => a.group_name === group);
                  return (
                    <div key={group}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{act?.emoji || '📌'} {group}</span>
                        <span className="text-muted">{hours.toFixed(1)}h ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: act?.color || '#6366F1' }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted text-center py-8">Start tracking to see your distribution</p>
          )}
        </div>
      </div>

      {/* Score explanation */}
      <div className="card p-5">
        <h2 className="font-display font-semibold flex items-center gap-2 mb-2">
          <Target className="w-4 h-4 text-primary" /> Productivity Score
        </h2>
        <p className="text-sm text-muted whitespace-pre-line">{SCORE_EXPLANATION}</p>
        {analytics?.scoreBreakdown && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {analytics.scoreBreakdown.map(item => (
              <div key={item.name} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                <p className="text-xs text-muted">{item.name}</p>
                <p className="text-sm font-semibold mt-0.5">
                  {item.points >= 0 ? '+' : ''}{item.points.toFixed(1)} / {item.max}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
