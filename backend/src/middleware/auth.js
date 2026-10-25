/**
 * OpenFloorball – Auth Middleware
 *
 * Prüft zusätzlich zur JWT-Signatur live gegen die DB:
 *   - existiert der Account noch? (Löschung invalidiert Tokens sofort)
 *   - ist er aktiv? (approval-Modus)
 *   - stimmt token_version? (Passwortwechsel/-Reset, Rollenwechsel)
 *   - welche Rolle hat er JETZT? (Degradierung wirkt sofort, nicht erst nach
 *     Ablauf des alten Tokens)
 */
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import redisClient from '../db/redis.js';
import { error } from '../utils/apiResponse.js';

export async function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json(error('Nicht authentifiziert'));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json(error('Token abgelaufen'));
    }
    return res.status(401).json(error('Ungültiger Token'));
  }

  try {
    // Token-Blacklist prüfen (Logout)
    const blacklisted = await redisClient.get(`blacklist:${token}`);
    if (blacklisted) {
      return res.status(401).json(error('Token ungültig (ausgeloggt)'));
    }

    const result = await pool.query(
      'SELECT role, token_version, status FROM users WHERE id = $1',
      [decoded.sub]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json(error('Konto nicht gefunden'));
    }
    if (user.status !== 'active') {
      return res.status(403).json(error('Dein Konto wartet noch auf die Freigabe durch einen Admin.'));
    }

    // Alte Tokens (vor Einführung von token_version) haben kein `ver` –
    // sie gelten als Version 0 und funktionieren bis zum nächsten Bump.
    const tokenVersion = Number.isInteger(decoded.ver) ? decoded.ver : 0;
    if (tokenVersion !== user.token_version) {
      return res.status(401).json(error('Sitzung abgelaufen – bitte neu anmelden'));
    }

    req.user = { id: decoded.sub, role: user.role };
    return next();
  } catch (err) {
    // DB/Redis-Fehler nicht als "ungültiger Token" tarnen – sonst würden
    // Nutzer bei einem Infrastruktur-Ausfall stillschweigend ausgeloggt.
    return next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json(error('Keine Berechtigung'));
  }
  next();
}
