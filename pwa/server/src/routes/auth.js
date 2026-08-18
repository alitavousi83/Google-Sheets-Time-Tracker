import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db, bcrypt, seedUserDefaults } from './db.js';
import { signToken, authMiddleware } from '../auth.js';

const router = Router();

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username?.trim() || username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters with uppercase, lowercase, and a number',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const existingUser = db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username.trim().toLowerCase(), email.trim().toLowerCase());

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const userId = uuid();
    const passwordHash = await bcrypt.hash(password, 12);

    db.prepare(
      'INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)'
    ).run(userId, username.trim(), email.trim().toLowerCase(), passwordHash);

    seedUserDefaults(userId);

    const token = signToken(userId);
    const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password, remember } = req.body;

    if (!identifier?.trim() || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    const user = db.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(identifier.trim(), identifier.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user.id, remember);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, created_at: user.created_at },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters with uppercase, lowercase, and a number',
      });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.delete('/account', authMiddleware, async (req, res) => {
  try {
    const { password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Password is incorrect' });

    db.prepare('DELETE FROM users WHERE id = ?').run(req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

export default router;
