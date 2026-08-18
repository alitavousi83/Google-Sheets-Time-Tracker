import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db.js';
import {
  aggregateByGroup,
  aggregateByActivity,
  calculateProductivityScore,
  getScoreLabel,
  getScoreBreakdown,
  getProductiveMinutes,
  getBreakMinutes,
  blockIndexToTime,
  timeToBlockIndex,
} from '../analytics.js';

const router = Router();

// ── Activities ──

router.get('/activities', (req, res) => {
  const activities = db.prepare(
    'SELECT * FROM activities WHERE user_id = ? ORDER BY sort_order'
  ).all(req.userId);
  res.json(activities);
});

router.post('/activities', (req, res) => {
  const { name, emoji, color, textColor, groupName, productive } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  const maxOrder = db.prepare(
    'SELECT MAX(sort_order) as m FROM activities WHERE user_id = ?'
  ).get(req.userId);

  const id = uuid();
  db.prepare(`
    INSERT INTO activities (id, user_id, name, emoji, color, text_color, group_name, productive, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, req.userId, name.trim(), emoji || '📌', color || '#6366F1',
    textColor || '#FFFFFF', groupName || 'Other', productive ? 1 : 0,
    (maxOrder?.m ?? -1) + 1
  );

  res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
});

router.put('/activities/:id', (req, res) => {
  const existing = db.prepare(
    'SELECT * FROM activities WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Activity not found' });

  const { name, emoji, color, textColor, groupName, productive } = req.body;
  db.prepare(`
    UPDATE activities SET name=?, emoji=?, color=?, text_color=?, group_name=?, productive=?
    WHERE id=? AND user_id=?
  `).run(
    name ?? existing.name, emoji ?? existing.emoji, color ?? existing.color,
    textColor ?? existing.text_color, groupName ?? existing.group_name,
    productive !== undefined ? (productive ? 1 : 0) : existing.productive,
    req.params.id, req.userId
  );

  res.json(db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id));
});

router.delete('/activities/:id', (req, res) => {
  const result = db.prepare(
    'DELETE FROM activities WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Activity not found' });
  res.json({ success: true });
});

// ── Time Entries ──

router.get('/time-entries', (req, res) => {
  const { startDate, endDate, date } = req.query;
  let entries;
  if (date) {
    entries = db.prepare(
      'SELECT * FROM time_entries WHERE user_id = ? AND date = ? ORDER BY start_time'
    ).all(req.userId, date);
  } else if (startDate && endDate) {
    entries = db.prepare(
      'SELECT * FROM time_entries WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, start_time'
    ).all(req.userId, startDate, endDate);
  } else {
    entries = db.prepare(
      'SELECT * FROM time_entries WHERE user_id = ? ORDER BY date DESC, start_time LIMIT 500'
    ).all(req.userId);
  }
  res.json(entries);
});

router.post('/time-entries', (req, res) => {
  const { activityId, date, startTime, endTime, durationMinutes, notes, source } = req.body;
  if (!activityId || !date || !startTime) {
    return res.status(400).json({ error: 'activityId, date, and startTime are required' });
  }

  const activity = db.prepare(
    'SELECT id FROM activities WHERE id = ? AND user_id = ?'
  ).get(activityId, req.userId);
  if (!activity) return res.status(400).json({ error: 'Invalid activity' });

  let duration = durationMinutes;
  if (!duration && endTime) {
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration < 0) duration += 24 * 60;
  }

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO time_entries (id, user_id, activity_id, date, start_time, end_time, duration_minutes, notes, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, activityId, date, startTime, endTime || null, duration || 30, notes || null, source || 'manual', now);

  res.status(201).json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(id));
});

router.put('/time-entries/:id', (req, res) => {
  const existing = db.prepare(
    'SELECT * FROM time_entries WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Entry not found' });

  const { activityId, date, startTime, endTime, durationMinutes, notes } = req.body;
  let duration = durationMinutes ?? existing.duration_minutes;
  const st = startTime ?? existing.start_time;
  const et = endTime ?? existing.end_time;
  if (!durationMinutes && st && et) {
    const [sh, sm] = st.split(':').map(Number);
    const [eh, em] = et.split(':').map(Number);
    duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration < 0) duration += 24 * 60;
  }

  db.prepare(`
    UPDATE time_entries SET activity_id=?, date=?, start_time=?, end_time=?, duration_minutes=?, notes=?, updated_at=?
    WHERE id=? AND user_id=?
  `).run(
    activityId ?? existing.activity_id, date ?? existing.date, st, et,
    duration, notes ?? existing.notes, new Date().toISOString(),
    req.params.id, req.userId
  );

  res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(req.params.id));
});

router.delete('/time-entries/:id', (req, res) => {
  const result = db.prepare(
    'DELETE FROM time_entries WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Entry not found' });
  res.json({ success: true });
});

// ── Time Blocks (30-min grid) ──

router.get('/time-blocks', (req, res) => {
  const { date, startDate, endDate } = req.query;
  let blocks;
  if (date) {
    blocks = db.prepare(
      'SELECT tb.*, a.name as activity_name, a.color, a.emoji FROM time_blocks tb JOIN activities a ON tb.activity_id = a.id WHERE tb.user_id = ? AND tb.date = ? ORDER BY block_index'
    ).all(req.userId, date);
  } else if (startDate && endDate) {
    blocks = db.prepare(
      'SELECT tb.*, a.name as activity_name, a.color, a.emoji FROM time_blocks tb JOIN activities a ON tb.activity_id = a.id WHERE tb.user_id = ? AND tb.date BETWEEN ? AND ? ORDER BY tb.date, tb.block_index'
    ).all(req.userId, startDate, endDate);
  } else {
    return res.status(400).json({ error: 'date or startDate/endDate required' });
  }
  res.json(blocks);
});

router.put('/time-blocks', (req, res) => {
  const { date, blocks } = req.body;
  if (!date || !Array.isArray(blocks)) {
    return res.status(400).json({ error: 'date and blocks array required' });
  }

  const upsert = db.prepare(`
    INSERT INTO time_blocks (id, user_id, activity_id, date, block_index)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date, block_index) DO UPDATE SET activity_id = excluded.activity_id
  `);
  const remove = db.prepare(
    'DELETE FROM time_blocks WHERE user_id = ? AND date = ? AND block_index = ?'
  );

  const tx = db.transaction(() => {
    for (const block of blocks) {
      if (block.activityId) {
        upsert.run(uuid(), req.userId, block.activityId, date, block.blockIndex);
      } else {
        remove.run(req.userId, date, block.blockIndex);
      }
    }
  });
  tx();

  const result = db.prepare(
    'SELECT tb.*, a.name as activity_name, a.color, a.emoji FROM time_blocks tb JOIN activities a ON tb.activity_id = a.id WHERE tb.user_id = ? AND tb.date = ? ORDER BY block_index'
  ).all(req.userId, date);

  res.json(result);
});

// ── Active Timer ──

router.get('/timer', (req, res) => {
  const timer = db.prepare(`
    SELECT t.*, a.name as activity_name, a.color, a.emoji, a.group_name
    FROM active_timers t JOIN activities a ON t.activity_id = a.id
    WHERE t.user_id = ?
  `).get(req.userId);
  res.json(timer || null);
});

router.post('/timer/start', (req, res) => {
  const { activityId, notes } = req.body;
  if (!activityId) return res.status(400).json({ error: 'activityId required' });

  const activity = db.prepare(
    'SELECT id FROM activities WHERE id = ? AND user_id = ?'
  ).get(activityId, req.userId);
  if (!activity) return res.status(400).json({ error: 'Invalid activity' });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO active_timers (user_id, activity_id, started_at, paused_at, accumulated_ms, notes, updated_at)
    VALUES (?, ?, ?, NULL, 0, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET activity_id=?, started_at=?, paused_at=NULL, accumulated_ms=0, notes=?, updated_at=?
  `).run(req.userId, activityId, now, notes || null, now, activityId, now, notes || null, now);

  const timer = db.prepare(`
    SELECT t.*, a.name as activity_name, a.color, a.emoji, a.group_name
    FROM active_timers t JOIN activities a ON t.activity_id = a.id WHERE t.user_id = ?
  `).get(req.userId);

  res.json(timer);
});

router.post('/timer/pause', (req, res) => {
  const timer = db.prepare('SELECT * FROM active_timers WHERE user_id = ?').get(req.userId);
  if (!timer) return res.status(404).json({ error: 'No active timer' });
  if (timer.paused_at) return res.status(400).json({ error: 'Timer already paused' });

  const now = Date.now();
  const started = new Date(timer.started_at).getTime();
  const accumulated = timer.accumulated_ms + (now - started);

  db.prepare(`
    UPDATE active_timers SET paused_at = ?, accumulated_ms = ?, updated_at = ? WHERE user_id = ?
  `).run(new Date().toISOString(), accumulated, new Date().toISOString(), req.userId);

  res.json(db.prepare(`
    SELECT t.*, a.name as activity_name, a.color, a.emoji, a.group_name
    FROM active_timers t JOIN activities a ON t.activity_id = a.id WHERE t.user_id = ?
  `).get(req.userId));
});

router.post('/timer/resume', (req, res) => {
  const timer = db.prepare('SELECT * FROM active_timers WHERE user_id = ?').get(req.userId);
  if (!timer) return res.status(404).json({ error: 'No active timer' });
  if (!timer.paused_at) return res.status(400).json({ error: 'Timer is not paused' });

  db.prepare(`
    UPDATE active_timers SET started_at = ?, paused_at = NULL, updated_at = ? WHERE user_id = ?
  `).run(new Date().toISOString(), new Date().toISOString(), req.userId);

  res.json(db.prepare(`
    SELECT t.*, a.name as activity_name, a.color, a.emoji, a.group_name
    FROM active_timers t JOIN activities a ON t.activity_id = a.id WHERE t.user_id = ?
  `).get(req.userId));
});

router.post('/timer/stop', (req, res) => {
  const timer = db.prepare('SELECT * FROM active_timers WHERE user_id = ?').get(req.userId);
  if (!timer) return res.status(404).json({ error: 'No active timer' });

  const now = Date.now();
  let totalMs = timer.accumulated_ms;
  if (!timer.paused_at) {
    totalMs += now - new Date(timer.started_at).getTime();
  }
  const durationMinutes = Math.max(1, Math.round(totalMs / 60000));

  const date = new Date().toISOString().slice(0, 10);
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - durationMinutes * 60000);
  const fmt = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const entryId = uuid();
  db.prepare(`
    INSERT INTO time_entries (id, user_id, activity_id, date, start_time, end_time, duration_minutes, notes, source, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'timer', ?)
  `).run(entryId, req.userId, timer.activity_id, date, fmt(startTime), fmt(endTime), durationMinutes, timer.notes, new Date().toISOString());

  db.prepare('DELETE FROM active_timers WHERE user_id = ?').run(req.userId);

  res.json(db.prepare('SELECT * FROM time_entries WHERE id = ?').get(entryId));
});

// ── Tasks ──

router.get('/tasks', (req, res) => {
  const { date, startDate, endDate } = req.query;
  let tasks;
  if (date) {
    tasks = db.prepare(
      'SELECT * FROM tasks WHERE user_id = ? AND date = ? ORDER BY completed, priority DESC, created_at'
    ).all(req.userId, date);
  } else if (startDate && endDate) {
    tasks = db.prepare(
      'SELECT * FROM tasks WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date, completed, priority DESC'
    ).all(req.userId, startDate, endDate);
  } else {
    tasks = db.prepare(
      'SELECT * FROM tasks WHERE user_id = ? ORDER BY date DESC, completed LIMIT 200'
    ).all(req.userId);
  }
  res.json(tasks);
});

router.post('/tasks', (req, res) => {
  const { title, notes, date, priority, activityId } = req.body;
  if (!title?.trim() || !date) {
    return res.status(400).json({ error: 'title and date are required' });
  }

  const id = uuid();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO tasks (id, user_id, activity_id, title, notes, date, priority, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.userId, activityId || null, title.trim(), notes || null, date, priority || 'medium', now);

  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

router.put('/tasks/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  const { title, notes, date, priority, activityId, completed } = req.body;
  db.prepare(`
    UPDATE tasks SET title=?, notes=?, date=?, priority=?, activity_id=?, completed=?, updated_at=?
    WHERE id=? AND user_id=?
  `).run(
    title ?? existing.title, notes ?? existing.notes, date ?? existing.date,
    priority ?? existing.priority, activityId !== undefined ? activityId : existing.activity_id,
    completed !== undefined ? (completed ? 1 : 0) : existing.completed,
    new Date().toISOString(), req.params.id, req.userId
  );

  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

router.delete('/tasks/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Task not found' });
  res.json({ success: true });
});

// ── Settings ──

router.get('/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  res.json(settings);
});

router.put('/settings', (req, res) => {
  const s = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);
  if (!s) return res.status(404).json({ error: 'Settings not found' });

  const fields = [
    'theme', 'time_format', 'week_start', 'default_activity_id',
    'goal_programming', 'goal_english', 'goal_exercise', 'goal_meditation',
    'goal_work', 'goal_personal', 'ideal_sleep', 'wasted_limit', 'month_start',
  ];
  const mapping = {
    theme: 'theme', timeFormat: 'time_format', weekStart: 'week_start',
    defaultActivityId: 'default_activity_id', goalProgramming: 'goal_programming',
    goalEnglish: 'goal_english', goalExercise: 'goal_exercise',
    goalMeditation: 'goal_meditation', goalWork: 'goal_work',
    goalPersonal: 'goal_personal', idealSleep: 'ideal_sleep',
    wastedLimit: 'wasted_limit', monthStart: 'month_start',
  };

  const updates = [];
  const values = [];
  for (const [jsKey, dbKey] of Object.entries(mapping)) {
    if (req.body[jsKey] !== undefined) {
      updates.push(`${dbKey} = ?`);
      values.push(req.body[jsKey]);
    }
  }
  if (updates.length === 0) return res.json(s);

  updates.push('updated_at = ?');
  values.push(new Date().toISOString(), req.userId);

  db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
  res.json(db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId));
});

// ── Analytics ──

router.get('/analytics', (req, res) => {
  const { startDate, endDate, period } = req.query;
  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'startDate and endDate required' });
  }

  const activities = db.prepare('SELECT * FROM activities WHERE user_id = ?').all(req.userId);
  const entries = db.prepare(`
    SELECT * FROM time_entries WHERE user_id = ? AND date BETWEEN ? AND ?
  `).all(req.userId, startDate, endDate);

  const blocks = db.prepare(`
    SELECT tb.*, a.group_name, a.productive, a.name as activity_name
    FROM time_blocks tb JOIN activities a ON tb.activity_id = a.id
    WHERE tb.user_id = ? AND tb.date BETWEEN ? AND ?
  `).all(req.userId, startDate, endDate);

  // Merge block data into entries (each block = 30 min)
  const blockEntries = blocks.map(b => ({
    activity_id: b.activity_id,
    date: b.date,
    duration_minutes: 30,
    group_name: b.group_name,
    productive: b.productive,
  }));

  const allData = [...entries, ...blockEntries];
  const groupHours = aggregateByGroup(allData, activities);
  const activityTotals = aggregateByActivity(allData);
  const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId);

  const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
  const goals = {
    goalProgramming: settings.goal_programming,
    goalEnglish: settings.goal_english,
    goalExercise: settings.goal_exercise,
    goalMeditation: settings.goal_meditation,
    goalWork: settings.goal_work,
    goalPersonal: settings.goal_personal,
    idealSleep: settings.ideal_sleep,
    wastedLimit: settings.wasted_limit,
    daysInPeriod: period === 'month' ? 28 : days,
  };

  const score = calculateProductivityScore(groupHours, goals);
  const scoreInfo = getScoreLabel(score);
  const breakdown = getScoreBreakdown(groupHours, goals);

  const totalMinutes = allData.reduce((s, e) => s + (e.duration_minutes || 0), 0);
  const productiveMinutes = getProductiveMinutes(allData, activities);
  const breakMinutes = getBreakMinutes(allData, activities);

  const tasks = db.prepare(`
    SELECT * FROM tasks WHERE user_id = ? AND date BETWEEN ? AND ?
  `).all(req.userId, startDate, endDate);

  // Daily breakdown
  const dailyMap = {};
  for (const e of allData) {
    if (!dailyMap[e.date]) dailyMap[e.date] = { total: 0, productive: 0, byGroup: {} };
    dailyMap[e.date].total += e.duration_minutes || 0;
    const act = activities.find(a => a.id === e.activity_id);
    if (act?.productive) dailyMap[e.date].productive += e.duration_minutes || 0;
    if (act) {
      dailyMap[e.date].byGroup[act.group_name] = (dailyMap[e.date].byGroup[act.group_name] || 0) + (e.duration_minutes || 0);
    }
  }

  res.json({
    totalMinutes,
    productiveMinutes,
    breakMinutes,
    totalHours: totalMinutes / 60,
    productiveHours: productiveMinutes / 60,
    breakHours: breakMinutes / 60,
    completedTasks: tasks.filter(t => t.completed).length,
    totalTasks: tasks.length,
    productivityScore: score,
    scoreLabel: scoreInfo.label,
    scoreEmoji: scoreInfo.emoji,
    scoreBreakdown: breakdown,
    groupHours: groupHours.byGroup,
    activityTotals,
    dailyBreakdown: dailyMap,
    goals,
  });
});

// ── Export / Import ──

router.get('/export', (req, res) => {
  const data = {
    exportedAt: new Date().toISOString(),
    activities: db.prepare('SELECT * FROM activities WHERE user_id = ?').all(req.userId),
    timeEntries: db.prepare('SELECT * FROM time_entries WHERE user_id = ?').all(req.userId),
    timeBlocks: db.prepare('SELECT * FROM time_blocks WHERE user_id = ?').all(req.userId),
    tasks: db.prepare('SELECT * FROM tasks WHERE user_id = ?').all(req.userId),
    settings: db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.userId),
    reflections: db.prepare('SELECT * FROM reflections WHERE user_id = ?').all(req.userId),
    healthEntries: db.prepare('SELECT * FROM health_entries WHERE user_id = ?').all(req.userId),
    journalEntries: db.prepare('SELECT * FROM journal_entries WHERE user_id = ?').all(req.userId),
    routinePlans: db.prepare('SELECT * FROM routine_plans WHERE user_id = ?').all(req.userId),
  };
  res.json(data);
});

router.post('/import', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });

  const tx = db.transaction(() => {
    if (data.timeEntries) {
      for (const e of data.timeEntries) {
        db.prepare(`
          INSERT OR REPLACE INTO time_entries (id, user_id, activity_id, date, start_time, end_time, duration_minutes, notes, source, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(e.id, req.userId, e.activity_id, e.date, e.start_time, e.end_time, e.duration_minutes, e.notes, e.source || 'import', new Date().toISOString());
      }
    }
    if (data.tasks) {
      for (const t of data.tasks) {
        db.prepare(`
          INSERT OR REPLACE INTO tasks (id, user_id, activity_id, title, notes, date, priority, completed, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(t.id, req.userId, t.activity_id, t.title, t.notes, t.date, t.priority, t.completed, new Date().toISOString());
      }
    }
  });
  tx();
  res.json({ success: true });
});

router.delete('/clear-data', (req, res) => {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM time_entries WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM time_blocks WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM tasks WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM reflections WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM health_entries WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM journal_entries WHERE user_id = ?').run(req.userId);
    db.prepare('DELETE FROM active_timers WHERE user_id = ?').run(req.userId);
  });
  tx();
  res.json({ success: true });
});

export default router;
