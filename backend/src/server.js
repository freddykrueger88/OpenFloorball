/**
 * OpenFloorball – Express Server
 */
import 'dotenv/config';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { runMigrations } from './db/migrate.js';
import { connectRedis } from './db/redis.js';
import { rescheduleBackupCron } from './services/backupCron.js';
import { attachPresenceServer } from './services/presenceServer.js';
import apiRoutes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import { anonymizeIp } from './utils/anonymizeIp.js';

// DSGVO: IP-Adresse in Zugriffs-Logs anonymisieren (Issue #20) – ersetzt
// :remote-addr im morgan-Format unten, respektiert `trust proxy` (Zeile 22).
morgan.token('anon-addr', (req) => anonymizeIp(req.ip));

const app = express();
const PORT = process.env.PORT || 3001;

// ROADMAP-Backlog "Echtzeit-Co-Editing": explizites http.Server-Objekt statt
// app.listen() (das intern auch nur einen http.Server erzeugt), weil der
// WebSocket-Präsenz-Server (services/presenceServer.js) sich in dessen
// "upgrade"-Event einklinken muss – app.listen() gibt dieses Objekt nicht
// direkt her. Das Attachen selbst ist synchron und passiert unabhängig
// davon, ob httpServer später tatsächlich lauscht (siehe Bootstrap unten).
const httpServer = http.createServer(app);
attachPresenceServer(httpServer);

// Backend läuft hinter dem Nginx-Reverse-Proxy (docker-compose) – erster Hop vertrauenswürdig
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────
// HSTS an dieselbe COOKIE_SECURE-Weiche gekoppelt wie utils/cookies.js:
// wer explizit COOKIE_SECURE=false setzt (Homelab-Deployment ohne
// verlässliches TLS davor, z.B. hinter einem HTTP-Tunnel/Reverse-Proxy),
// bekommt bewusst KEIN HSTS – sonst zwingt der Browser die Seite nach dem
// ersten Aufruf dauerhaft auf HTTPS, auch wenn der Tunnel/Proxy das gar
// nicht zuverlässig unterstützt (führt zu Redirect-/Reload-Schleifen und
// Cookies, die zwischen HTTP/HTTPS nicht mehr wiedergefunden werden).
const HSTS_ENABLED = process.env.COOKIE_SECURE !== 'false';

app.use(helmet({
  crossOriginEmbedderPolicy: false, // Konva.js
  hsts: HSTS_ENABLED,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Der Vite-Production-Build lädt Skripte ausschließlich extern (kein
      // Inline-<script>, auch nicht durch vite-plugin-pwa) – 'unsafe-inline'
      // war hier unnötig und hätte im Falle einer XSS-Lücke Angreifer-
      // Skripte trotz CSP ausführen lassen. styleSrc behält 'unsafe-inline'
      // bewusst: React setzt Inline-Styles (style={{...}}) sehr breit ein,
      // ein Nonce-/Hash-Ansatz dafür wäre unverhältnismäßig aufwendig.
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate Limiter ──────────────────────────────
// In Tests deaktiviert (analog zum Morgan-Logging unten), damit automatisierte
// Testläufe nicht durch produktionsrelevante Limits verfälscht werden.
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', rateLimit({
    windowMs: 15 * 60 * 1000,
    // Bugfix: 100 war für echte interaktive Nutzung deutlich zu knapp –
    // useAutoSave.js debounced Speichern schon 300ms nach jeder Änderung
    // (nicht nur alle 30s), aktives Verschieben von Spielern beim
    // Taktik-Zeichnen feuert dadurch allein schon viele Requests pro
    // Minute; dazu kommen mehrere API-Aufrufe pro Seitenwechsel
    // (Boards/Playbooks/Teams/Settings) und ggf. mehrere gleichzeitig
    // aktive Nutzer hinter derselben IP. Ein frisch registrierter Nutzer
    // konnte dadurch schon beim ersten Ausprobieren (Board anlegen) von
    // "Zu viele Anfragen" blockiert werden – wirkte wie eine fehlende
    // Berechtigung, war aber ein zu enges Limit.
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Anfragen, bitte warten.' },
    // Bugfix: /api/auth/login und /api/auth/register haben unten eigene,
    // bewusst großzügigere/knappere Budgets – ohne dieses skip liefen
    // BEIDE Limiter parallel für dieselben Requests (Express beendet die
    // Middleware-Kette bei einem `use()`-Treffer nicht, nur weil später
    // noch ein spezifischerer `use()` für denselben Pfad existiert), d.h.
    // jeder Login-/Registrierungs-Request zählte zusätzlich gegen dieses
    // geteilte 100-Anfragen-Budget. Bei mehreren gleichzeitig aktiven
    // Nutzern hinter derselben IP (Verein/Haushalt) war das geteilte
    // Budget oft schon durch normale App-Nutzung (Boards, Kader, …)
    // aufgebraucht, bevor überhaupt registriert/eingeloggt wurde – die
    // Fehlermeldung sagte dann wieder fälschlich "Zu viele Anfragen"
    // statt der eigentlich zutreffenden, spezifischeren Meldung.
    // /ai/training-plan, /ai/tactic-suggestion, /ai/analysis und
    // /ai/knowledge-query haben unten jeweils ein eigenes, engeres Budget
    // (KI-Aufrufe sind teuer/missbrauchsanfällig) – aus demselben Grund wie
    // bei Login/Registrierung ausgenommen, sonst zählt derselbe Request
    // doppelt.
    skip: (req) => req.path === '/auth/login' || req.path === '/auth/register'
      || req.path === '/auth/forgot-password' || req.path === '/auth/reset-password'
      || req.path === '/ai/training-plan' || req.path === '/ai/tactic-suggestion'
      || req.path === '/ai/analysis' || req.path === '/ai/knowledge-query'
      || (req.path.startsWith('/carpools/') && req.method !== 'GET'),
  }));

  // Getrennt statt ein gemeinsamer Limiter für den ganzen /api/auth/-Pfad:
  // vorher teilten sich Login, Registrierung und die bereits
  // authentifizierten Routen (/me, /name, /email, /password, /logout) ein
  // einziges 10-Anfragen-Budget pro 15 Minuten UND IP – mit einer Meldung,
  // die immer "Login-Versuche" sagte, auch wenn z.B. eine Registrierung
  // (nach mehreren Validierungsfehlern) oder normale /me-Aufrufe die
  // eigentliche Ursache waren. Bei einer gemeinsam genutzten IP (Verein/
  // Büro hinter einem NAT) reichte das oft schon durch einen einzigen
  // Kollegen aus, um alle anderen mit auszusperren.
  app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Login-Versuche, bitte warten.' },
  }));

  app.use('/api/auth/register', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Registrierungsversuche, bitte warten.' },
  }));
  // /me, /name, /email, /password, /logout bleiben unter dem allgemeinen
  // /api/-Limit (100/15min) – die erfordern bereits eine gültige Session,
  // Brute-Force ist dort kein Thema wie bei Login/Registrierung.

  // forgot-password verschickt bei Erfolg eine E-Mail – engeres Budget
  // wie Login, verhindert sowohl Enumeration-Versuche als auch Mail-
  // Spam gegen fremde Adressen. reset-password braucht ein gültiges,
  // hochentropisches Token (siehe routes/auth.js) und ist damit gegen
  // Brute-Force ohnehin praktisch immun – bekommt trotzdem dasselbe
  // Budget (Defense in Depth, kostet nichts extra).
  app.use('/api/auth/forgot-password', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Anfragen, bitte warten.' },
  }));
  app.use('/api/auth/reset-password', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Anfragen, bitte warten.' },
  }));

  // KI-Trainingsassistent: jeder Aufruf löst eine externe Modell-Anfrage
  // aus (Kosten bei Cloud-Anbietern, Last bei selbst gehosteten Modellen)
  // – deutlich engeres Budget als die allgemeine Regel. /ai/status bleibt
  // bewusst unter dem allgemeinen Limit, das ist nur ein günstiger Read.
  app.use('/api/ai/training-plan', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele KI-Anfragen, bitte warten.' },
  }));
  app.use('/api/ai/tactic-suggestion', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele KI-Anfragen, bitte warten.' },
  }));
  app.use('/api/ai/analysis', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele KI-Anfragen, bitte warten.' },
  }));
  app.use('/api/ai/knowledge-query', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele KI-Anfragen, bitte warten.' },
  }));

  // Öffentliche Fahrgemeinschafts-Endpunkte (ISSUE 028, kein Login) – GET
  // (Angebot ansehen) bleibt unter dem allgemeinen /api/-Limit wie
  // /api/share/:token; nur die anonymen Schreibzugriffe (Platz
  // beanspruchen/zurückziehen) sind hier zusätzlich eng begrenzt, da dies
  // der erste anonyme WRITE-Pfad der App ist (siehe carpoolShareController.js).
  app.use('/api/carpools', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Zu viele Anfragen, bitte warten.' },
    skip: (req) => req.method === 'GET',
  }));
}

// ── Parser ────────────────────────────────────
// /api/export/* (GIF-/MP4-/PDF-Export, Frame-Share) braucht ein deutlich
// größeres JSON-Limit für Base64-PNG-Frames – routes/index.js setzt dafür
// bereits einen eigenen express.json({ limit: '50mb' }) auf diesem
// Sub-Router. Ohne diese Ausnahme hier wäre das wirkungslos: der Body wird
// nur einmal geparst, und dieser globale 10kb-Parser läuft zuerst (413,
// bevor der Sub-Router überhaupt zum Zug kommt).
app.use((req, res, next) => {
  if (req.path.startsWith('/api/export')) return next();
  express.json({ limit: '10kb' })(req, res, next);
});
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ── Logging ───────────────────────────────────
// Format entspricht 'combined', nur mit :anon-addr statt :remote-addr
// (DSGVO – keine vollständigen IP-Adressen in Logs, Issue #20)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':anon-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"', {
    stream: { write: (msg) => logger.http(msg.trim()) },
  }));
}

// ── Health Check ─────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'openfloorball-backend' });
});

// ── API Routes ────────────────────────────────
app.use('/api', apiRoutes);

// ── Error Handling ────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Bootstrap ─────────────────────────────────
// JWT_SECRET wurde bisher erst beim ersten Login-Versuch geprüft (jsonwebtoken
// wirft dann eine kryptische Fehlermeldung) – hier stattdessen sofort beim
// Start mit klarer Meldung abbrechen, falls es fehlt oder zu kurz ist.
function validateEnv() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    logger.error('JWT_SECRET fehlt oder ist kürzer als 32 Zeichen – Server-Start abgebrochen.');
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    validateEnv();
    await connectRedis();
    await runMigrations();
    await rescheduleBackupCron();
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`OpenFloorball Backend läuft auf Port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  } catch (err) {
    logger.error('Bootstrap failed:', err);
    process.exit(1);
  }
}

// In Tests wird `app` direkt importiert (supertest) – DB/Redis-Setup und
// app.listen() übernimmt dort die Test-Suite selbst (siehe __tests__/setup.js)
if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}

export default app;
export { httpServer };
