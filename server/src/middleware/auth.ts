import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dfmc_secret_key_2026_super_safe';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    cell_name: string;
    cell_verified: number;
  };
}

// Log traffic for server admin metrics
export function trafficLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const endpoint = req.originalUrl || req.url;
  const method = req.method;
  const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

  res.on('finish', () => {
    try {
      db.prepare(`
        INSERT INTO traffic_logs (timestamp, endpoint, method, status_code, ip)
        VALUES (?, ?, ?, ?, ?)
      `).run(start, endpoint, method, res.statusCode, ip);
    } catch (e) {
      // Ignore log error
    }
  });

  next();
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 제공되지 않았습니다.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않거나 만료된 토큰입니다.' });
    }
    req.user = decoded as AuthRequest['user'];
    next();
  });
}

export function requireServerAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'server_admin') {
    return res.status(403).json({ error: '서버 관리자 전용 권한이 필요합니다.' });
  }
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'head_admin' && req.user.role !== 'server_admin')) {
    return res.status(403).json({ error: '전체 관리자 권한이 필요합니다.' });
  }
  next();
}

export function requireMediaOrAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'head_admin' && req.user.role !== 'media_admin' && req.user.role !== 'server_admin')) {
    return res.status(403).json({ error: '미디어 관리자 또는 전체 관리자 권한이 필요합니다.' });
  }
  next();
}

// Backwards compatibility alias
export const requireHeadAdmin = requireAdmin;
