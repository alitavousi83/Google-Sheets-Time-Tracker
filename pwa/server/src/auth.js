import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'premium-time-tracker-dev-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
const JWT_REMEMBER_EXPIRES = process.env.JWT_REMEMBER_EXPIRES || '30d';

export function signToken(userId, remember = false) {
  return jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: remember ? JWT_REMEMBER_EXPIRES : JWT_EXPIRES,
  });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const payload = verifyToken(header.slice(7));
  if (!payload?.userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.userId = payload.userId;
  next();
}

export { JWT_SECRET };
