/**
 * OpenFloorball – Auth Routes
 * POST /api/auth/register
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 */
import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { body, validationResult } from 'express-validator';
import pool from '../db/pool.js';
import redisClient from '../db/redis.js';
import { authenticate } from '../middleware/auth.js';
import { success, created, error } from '../utils/apiResponse.js';
import { COOKIE_OPTS } from '../utils/cookies.js';
import { notifyAdminsOfNewUser, sendMail } from '../utils/mailer.js';
import { resolveEmailLanguage } from '../utils/emailLanguage.js';
import logger from '../utils/logger.js';

const router = Router();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 Stunde

function hashResetToken(rawToken) {
  return createHash('sha256').update(rawToken).digest('hex');
}

// ── Validierungsregeln ─────────────────────────
// Geburtsdatum: bei Neu-Registrierung Pflichtfeld (siehe BirthdayGateDialog
// für Bestandsnutzer ohne Geburtsdatum), plausibilisiert statt nur formal
// geprüft – ein Datum in der Zukunft oder vor über 120 Jahren ist immer
// ein Eingabefehler, kein echtes Geburtsdatum.
const birthdayValidation = body('birthday')
  .notEmpty().withMessage('Geburtsdatum ist erforderlich')
  .bail()
  .isISO8601().withMessage('Ungültiges Geburtsdatum')
  .bail()
  .custom((value) => {
    const date = new Date(value);
    if (date > new Date()) throw new Error('Geburtsdatum darf nicht in der Zukunft liegen');
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 120);
    if (date < minDate) throw new Error('Geburtsdatum ist unrealistisch');
    return true;
  });

const registerValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Ungültige E-Mail-Adresse'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Passwort muss mindestens 8 Zeichen haben')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Passwort muss Groß-, Kleinbuchstaben und eine Zahl enthalten'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name zu lang'),
  birthdayValidation,
];

const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Ungültige E-Mail-Adresse'),
  body('password').notEmpty().withMessage('Passwort erforderlich'),
];

const newPasswordValidation = body('newPassword')
  .isLength({ min: 8 })
  .withMessage('Passwort muss mindestens 8 Zeichen haben')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Passwort muss Groß-, Kleinbuchstaben und eine Zahl enthalten');

// ── Helper: JWT erstellen ──────────────────────
function signToken(userId, role) {
  return jwt.sign(
    { sub: userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, algorithm: 'HS256' }
  );
}

// ── POST /api/auth/register ────────────────────
router.post('/register', registerValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }

  const { email, password, name, birthday } = req.body;

  try {
    // Prüfen ob bereits ein User existiert → erster User = Admin
    const countResult = await pool.query('SELECT COUNT(*) FROM users');
    const isFirstUser = parseInt(countResult.rows[0].count, 10) === 0;
    const role = isFirstUser ? 'admin' : 'user';

    // E-Mail Duplikat prüfen
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json(error('E-Mail bereits registriert'));
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // User anlegen
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, role, display_name, birthday)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, role, display_name, birthday, created_at`,
      [email, passwordHash, role, name || null, birthday]
    );
    const user = result.rows[0];

    // Offene Einladungen (board_invites, siehe boardCollaboratorsController.js)
    // für genau diese Adresse automatisch einlösen – awaited (nicht fire-
    // and-forget), damit das Board schon im ersten GET /api/boards nach dem
    // Redirect sichtbar ist. Fehler hier dürfen die Registrierung selbst
    // nie zum Scheitern bringen.
    try {
      const invites = await pool.query(
        `SELECT id, board_id, permission FROM board_invites
         WHERE email = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
        [user.email]
      );
      for (const inv of invites.rows) {
        await pool.query(
          `INSERT INTO board_collaborators (board_id, user_id, permission)
           VALUES ($1, $2, $3) ON CONFLICT (board_id, user_id) DO NOTHING`,
          [inv.board_id, user.id, inv.permission]
        );
        await pool.query('UPDATE board_invites SET accepted_at = NOW() WHERE id = $1', [inv.id]);
      }
    } catch (inviteErr) {
      logger.error('[register] Einladungen konnten nicht übernommen werden:', inviteErr);
    }

    // JWT
    const token = signToken(user.id, user.role);
    res.cookie('token', token, COOKIE_OPTS);

    logger.info(`User registered: ${user.id} (role: ${role})`);
    notifyAdminsOfNewUser({ email: user.email, name: user.display_name }, { isFirstUser });
    return res.status(201).json(created({ user: { id: user.id, email: user.email, role: user.role, name: user.display_name, birthday: user.birthday } }));
  } catch (err) {
    logger.error('Register error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── POST /api/auth/login ───────────────────────
router.post('/login', loginValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }

  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT id, email, password_hash, role, display_name, birthday FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Timing-Safe: auch hash wenn kein User (verhindert User-Enumeration)
      await bcrypt.hash('dummy', 10);
      return res.status(401).json(error('Ungültige Anmeldedaten'));
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json(error('Ungültige Anmeldedaten'));
    }

    const token = signToken(user.id, user.role);
    res.cookie('token', token, COOKIE_OPTS);

    logger.info(`User logged in: ${user.id}`);
    return res.json(success({ user: { id: user.id, email: user.email, role: user.role, name: user.display_name, birthday: user.birthday } }));
  } catch (err) {
    logger.error('Login error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── POST /api/auth/logout ──────────────────────
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Token in Redis-Blacklist für verbleibende Gültigkeit
    const token = req.cookies?.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded?.exp) {
        const ttl = decoded.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) {
          await redisClient.setEx(`blacklist:${token}`, ttl, '1');
        }
      }
    }
    res.clearCookie('token', { ...COOKIE_OPTS, maxAge: 0 });
    logger.info(`User logged out: ${req.user.id}`);
    return res.json(success({ message: 'Erfolgreich abgemeldet' }));
  } catch (err) {
    logger.error('Logout error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── GET /api/auth/me ───────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role, display_name AS name, birthday, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json(error('Benutzer nicht gefunden'));
    }
    return res.json(success({ user: result.rows[0] }));
  } catch (err) {
    logger.error('Me error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── PUT /api/auth/name ──────────────────────────
router.put('/name', authenticate, [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Name 1-100 Zeichen'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  try {
    const result = await pool.query(
      'UPDATE users SET display_name = $1 WHERE id = $2 RETURNING id, email, role, display_name AS name',
      [req.body.name, req.user.id]
    );
    return res.json(success({ user: result.rows[0] }));
  } catch (err) {
    logger.error('Update name error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── PUT /api/auth/birthday ──────────────────────
// Für Bestandsnutzer ohne Geburtsdatum (vor Einführung des Pflichtfelds
// registriert) – wird über BirthdayGateDialog.jsx einmalig erzwungen.
router.put('/birthday', authenticate, [birthdayValidation], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  try {
    const result = await pool.query(
      'UPDATE users SET birthday = $1 WHERE id = $2 RETURNING id, email, role, display_name AS name, birthday',
      [req.body.birthday, req.user.id]
    );
    return res.json(success({ user: result.rows[0] }));
  } catch (err) {
    logger.error('Update birthday error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── PUT /api/auth/email ─────────────────────────
router.put('/email', authenticate, [
  body('newEmail').isEmail().normalizeEmail().withMessage('Ungültige E-Mail-Adresse'),
  body('currentPassword').notEmpty().withMessage('Aktuelles Passwort erforderlich'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  const { newEmail, currentPassword } = req.body;

  try {
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json(error('Aktuelles Passwort ist falsch'));
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [newEmail, req.user.id]);
    if (existing.rows.length > 0) {
      return res.status(409).json(error('E-Mail bereits vergeben'));
    }

    const result = await pool.query(
      'UPDATE users SET email = $1 WHERE id = $2 RETURNING id, email, role, display_name AS name',
      [newEmail, req.user.id]
    );
    logger.info(`User changed email: ${req.user.id}`);
    return res.json(success({ user: result.rows[0] }));
  } catch (err) {
    logger.error('Update email error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── PUT /api/auth/password ──────────────────────
router.put('/password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Aktuelles Passwort erforderlich'),
  newPasswordValidation,
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  const { currentPassword, newPassword } = req.body;

  try {
    const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json(error('Aktuelles Passwort ist falsch'));
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    logger.info(`User changed password: ${req.user.id}`);
    return res.json(success({ message: 'Passwort geändert' }));
  } catch (err) {
    logger.error('Update password error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── POST /api/auth/forgot-password ──────────────
// Erfordert einen konfigurierten SMTP-Versand (siehe utils/mailer.js) –
// ohne SMTP_HOST bleibt sendMail() ein No-op und es kommt keine Mail an
// (dokumentiert im Wiki, kein Admin-Fallback in dieser Ausbaustufe).
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail().withMessage('Ungültige E-Mail-Adresse'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  const { email } = req.body;

  // Immer dieselbe generische Antwort, unabhängig davon ob die Adresse
  // tatsächlich existiert – verhindert User-Enumeration über diesen
  // Endpunkt (analog zum Login-Timing-Schutz oben).
  const genericMessage = 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Nachricht mit einem Link zum Zurücksetzen verschickt.';

  try {
    const userResult = await pool.query(
      `SELECT u.id, u.display_name, s.preferences_json->>'language' AS language
       FROM users u
       LEFT JOIN settings s ON s.user_id = u.id
       WHERE u.email = $1`,
      [email]
    );
    const user = userResult.rows[0];

    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(rawToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

      // Ein neuer Request macht alle vorherigen offenen Tokens dieses
      // Nutzers ungültig – immer nur ein aktiver Reset-Link gleichzeitig.
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      const appUrl = (process.env.CORS_ORIGIN || '').replace(/\/$/, '');
      const resetLink = `${appUrl}/reset-password/${rawToken}`;
      const RESET_EMAIL_TEXT = {
        de: {
          subject: 'OpenFloorball – Passwort zurücksetzen',
          text: `Hallo${user.display_name ? ` ${user.display_name}` : ''},\n\ndu hast angefordert, dein Passwort zurückzusetzen. Der folgende Link ist eine Stunde lang gültig:\n\n${resetLink}\n\nWenn du das nicht warst, kannst du diese Nachricht ignorieren – an deinem Konto ändert sich dadurch nichts.`,
        },
        en: {
          subject: 'OpenFloorball – Reset your password',
          text: `Hi${user.display_name ? ` ${user.display_name}` : ''},\n\nyou requested to reset your password. The following link is valid for one hour:\n\n${resetLink}\n\nIf this wasn't you, you can ignore this message – nothing will change on your account.`,
        },
      };
      await sendMail({
        to: email,
        ...RESET_EMAIL_TEXT[resolveEmailLanguage(user.language)],
      });
      logger.info(`Password reset requested: ${user.id}`);
    }

    return res.json(success({ message: genericMessage }));
  } catch (err) {
    logger.error('Forgot-password error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

// ── POST /api/auth/reset-password ───────────────
router.post('/reset-password', [
  body('token').notEmpty().withMessage('Token erforderlich'),
  newPasswordValidation,
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(error('Validierungsfehler', errors.array()));
  }
  const { token, newPassword } = req.body;
  const tokenHash = hashResetToken(token);

  try {
    const tokenResult = await pool.query(
      'SELECT id, user_id, expires_at FROM password_reset_tokens WHERE token_hash = $1',
      [tokenHash]
    );
    const resetToken = tokenResult.rows[0];
    if (!resetToken || new Date(resetToken.expires_at) < new Date()) {
      return res.status(400).json(error('Ungültiger oder abgelaufener Link'));
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, resetToken.user_id]);
    // Einmal verwendbar: Token sofort löschen, damit ein zweiter Versuch
    // mit demselben Link (auch bei Erfolg) nicht mehr funktioniert.
    await pool.query('DELETE FROM password_reset_tokens WHERE id = $1', [resetToken.id]);

    logger.info(`Password reset completed: ${resetToken.user_id}`);
    return res.json(success({ message: 'Passwort erfolgreich zurückgesetzt' }));
  } catch (err) {
    logger.error('Reset-password error:', err);
    return res.status(500).json(error('Interner Serverfehler'));
  }
});

export default router;
