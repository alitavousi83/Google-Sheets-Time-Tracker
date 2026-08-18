import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'tracker.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const DEFAULT_ACTIVITIES = [
  { name: 'codding', emoji: '💻', color: '#057c31', textColor: '#FFFFFF', groupName: 'Programming', productive: true },
  { name: 'learn-prog', emoji: '💻', color: '#86EFAC', textColor: '#FFFFFF', groupName: 'Programming', productive: true },
  { name: 'En-book', emoji: '📚', color: '#2563EB', textColor: '#FFFFFF', groupName: 'English', productive: true },
  { name: 'En-listening', emoji: '📚', color: '#93C5FD', textColor: '#FFFFFF', groupName: 'English', productive: true },
  { name: 'Run', emoji: '🏋️', color: '#EA580C', textColor: '#FFFFFF', groupName: 'Exercises', productive: true },
  { name: 'Gym', emoji: '🏋️', color: '#FDBA74', textColor: '#FFFFFF', groupName: 'Exercises', productive: true },
  { name: 'work', emoji: '🧑‍💻', color: '#89fd05', textColor: '#FFFFFF', groupName: 'Work', productive: true },
  { name: 'Meditation', emoji: '🧘', color: '#8e029b', textColor: '#FFFFFF', groupName: 'Meditate', productive: false },
  { name: 'Setar', emoji: '🧘', color: '#da87de', textColor: '#FFFFFF', groupName: 'Meditate', productive: false },
  { name: 'Personal Tasks', emoji: '📋', color: '#eeeeee', textColor: '#5F4B00', groupName: 'Personal Tasks', productive: false },
  { name: 'Wasted Time', emoji: '⌛', color: '#ff1500', textColor: '#FFFFFF', groupName: 'Wasted Time', productive: false },
  { name: 'Sleep', emoji: '😴', color: '#4e4d44', textColor: '#FFFFFF', groupName: 'Sleep', productive: false },
];

export const DEFAULT_GROUPS = [
  { name: 'Programming', emoji: '💻', color: '#057c31', members: ['codding', 'learn-prog'] },
  { name: 'English', emoji: '📚', color: '#2563EB', members: ['En-book', 'En-listening'] },
  { name: 'Exercises', emoji: '🏋️', color: '#EA580C', members: ['Run', 'Gym'] },
  { name: 'Meditate', emoji: '🧘', color: '#8e029b', members: ['Meditation', 'Setar'] },
  { name: 'Work', emoji: '🧑‍💻', color: '#89fd05', members: ['work'] },
  { name: 'Personal Tasks', emoji: '📋', color: '#eeeeee', members: ['Personal Tasks'] },
  { name: 'Sleep', emoji: '😴', color: '#4e4d44', members: ['Sleep'] },
  { name: 'Wasted Time', emoji: '⌛', color: '#ff1500', members: ['Wasted Time'] },
];

export const DEFAULT_GOALS = {
  goalProgramming: 60,
  goalEnglish: 30,
  goalExercise: 20,
  goalMeditation: 15,
  goalWork: 80,
  goalPersonal: 30,
  idealSleep: 8,
  wastedLimit: 40,
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '📌',
    color TEXT NOT NULL DEFAULT '#6366F1',
    text_color TEXT NOT NULL DEFAULT '#FFFFFF',
    group_name TEXT NOT NULL DEFAULT 'Other',
    productive INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_minutes REAL,
    notes TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS time_blocks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    block_index INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date, block_index)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT REFERENCES activities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    notes TEXT,
    date TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS active_timers (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    activity_id TEXT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    started_at TEXT NOT NULL,
    paused_at TEXT,
    accumulated_ms INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT NOT NULL DEFAULT 'system',
    time_format TEXT NOT NULL DEFAULT '24h',
    week_start TEXT NOT NULL DEFAULT 'monday',
    default_activity_id TEXT,
    goal_programming REAL NOT NULL DEFAULT 60,
    goal_english REAL NOT NULL DEFAULT 30,
    goal_exercise REAL NOT NULL DEFAULT 20,
    goal_meditation REAL NOT NULL DEFAULT 15,
    goal_work REAL NOT NULL DEFAULT 80,
    goal_personal REAL NOT NULL DEFAULT 30,
    ideal_sleep REAL NOT NULL DEFAULT 8,
    wasted_limit REAL NOT NULL DEFAULT 40,
    month_start TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reflections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type TEXT NOT NULL,
    period_key TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, period_type, period_key, section)
  );

  CREATE TABLE IF NOT EXISTS health_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    value REAL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date, metric)
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    section TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, date, section)
  );

  CREATE TABLE IF NOT EXISTS routine_plans (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_time_entries_user_date ON time_entries(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_time_blocks_user_date ON time_blocks(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
`);

export function seedUserDefaults(userId) {
  const insertActivity = db.prepare(`
    INSERT INTO activities (id, user_id, name, emoji, color, text_color, group_name, productive, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  DEFAULT_ACTIVITIES.forEach((a, i) => {
    insertActivity.run(crypto.randomUUID(), userId, a.name, a.emoji, a.color, a.textColor, a.groupName, a.productive ? 1 : 0, i);
  });

  const settings = db.prepare(`
    INSERT INTO user_settings (user_id, goal_programming, goal_english, goal_exercise, goal_meditation, goal_work, goal_personal, ideal_sleep, wasted_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  settings.run(userId, 60, 30, 20, 15, 80, 30, 8, 40);
}

export function getUserActivities(userId) {
  return db.prepare('SELECT * FROM activities WHERE user_id = ? ORDER BY sort_order').all(userId);
}

export function getUserSettings(userId) {
  return db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
}

export { db, bcrypt };
