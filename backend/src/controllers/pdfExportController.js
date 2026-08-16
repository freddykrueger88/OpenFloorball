/**
 * pdfExportController – PDF-Taktikblatt-Export via pdfkit
 * Issue #24 – v0.8.0
 *
 * Anders als GIF-/MP4-Export (exportController.js) kein Job-Store/Polling
 * nötig: Erzeugung aus bereits gerenderten Frame-PNGs ist schnell genug
 * für einen synchronen Request/Response, direkt in die Response gestreamt.
 */
import PDFDocument from 'pdfkit';
import logger from '../utils/logger.js';
import pool from '../db/pool.js';
import { assertGameRead } from './gamesController.js';
import { calculateMatchScore } from '../services/statisticsEngine.js';

const MAX_FRAMES = 60;
const PAGE_SIZES = { a4: 'A4', letter: 'LETTER' };
const GRIDS = {
  1: { cols: 1, rows: 1 },
  2: { cols: 1, rows: 2 },
  4: { cols: 2, rows: 2 },
};

const TEXT = {
  de: {
    footer: 'Vertraulich – Nur für internes Coaching',
    page: (n, total) => `Seite ${n} von ${total}`,
    fallbackBoardName: 'Unbenanntes Board',
  },
  en: {
    footer: 'Confidential – For internal coaching use only',
    page: (n, total) => `Page ${n} of ${total}`,
    fallbackBoardName: 'Untitled Board',
  },
};

function parsePngBuffer(dataUrl) {
  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  return Buffer.from(base64, 'base64');
}

function formatDate(lang) {
  return new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

/**
 * POST /api/export/pdf
 * Body: { boardName?, frames: [{ image, note? }], framesPerPage?, paperSize?, language? }
 */
export async function exportPdf(req, res) {
  const { boardName, frames, framesPerPage = 2, paperSize = 'a4', language = 'de' } = req.body;

  if (!Array.isArray(frames) || frames.length < 1) {
    return res.status(400).json({ success: false, message: 'Mindestens 1 Frame erforderlich.' });
  }
  if (frames.length > MAX_FRAMES) {
    return res.status(400).json({ success: false, message: `Maximal ${MAX_FRAMES} Frames erlaubt.` });
  }

  const grid = GRIDS[Number(framesPerPage)] ?? GRIDS[2];
  const size = PAGE_SIZES[paperSize] ?? 'A4';
  const lang = language === 'en' ? 'en' : 'de';
  const texts = TEXT[lang];
  const safeBoardName = typeof boardName === 'string' && boardName.trim() ? boardName.trim() : texts.fallbackBoardName;

  try {
    const doc = new PDFDocument({ size, margin: 40, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="openfloorball-taktikblatt.pdf"');
    doc.pipe(res);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const headerHeight = 50;
    const footerHeight = 30;
    const dateStr = formatDate(lang);

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
        .text('OpenFloorball', doc.page.margins.left, doc.page.margins.top);
      doc.font('Helvetica').fontSize(11).fillColor('#374151')
        .text(safeBoardName, doc.page.margins.left, doc.page.margins.top + 20);
      doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
        .text(dateStr, doc.page.margins.left, doc.page.margins.top, { width: contentWidth, align: 'right' });
      const lineY = doc.page.margins.top + headerHeight - 8;
      doc.moveTo(doc.page.margins.left, lineY).lineTo(doc.page.width - doc.page.margins.right, lineY)
        .strokeColor('#d1d5db').stroke();
    }

    function drawFooter(pageNum, totalPages) {
      // Innerhalb der Marge bleiben (nicht darunter) – sonst löst pdfkit
      // einen automatischen Seitenumbruch aus, weil der Text sonst außerhalb
      // des beschreibbaren Bereichs läge
      const y = doc.page.height - doc.page.margins.bottom - 14;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#9ca3af')
        .text(texts.footer, doc.page.margins.left, y, { width: contentWidth / 2, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(texts.page(pageNum, totalPages), doc.page.margins.left, y, { width: contentWidth, align: 'right', lineBreak: false });
    }

    const gridTop = doc.page.margins.top + headerHeight;
    const gridHeight = doc.page.height - doc.page.margins.bottom - gridTop - footerHeight;
    const cellW = contentWidth / grid.cols;
    const cellH = gridHeight / grid.rows;
    const cellPad = 8;
    const noteHeight = 16;

    let frameIndex = 0;
    let pageIndex = 0;
    while (frameIndex < frames.length) {
      if (pageIndex > 0) doc.addPage();
      drawHeader();

      for (let slot = 0; slot < grid.cols * grid.rows && frameIndex < frames.length; slot++, frameIndex++) {
        const frame = frames[frameIndex];
        const col = slot % grid.cols;
        const row = Math.floor(slot / grid.cols);
        const cellX = doc.page.margins.left + col * cellW;
        const cellY = gridTop + row * cellH;

        const imgBuf = parsePngBuffer(frame.image);
        doc.image(imgBuf, cellX + cellPad, cellY + cellPad, {
          fit: [cellW - cellPad * 2, cellH - cellPad * 2 - noteHeight],
          align: 'center',
          valign: 'center',
        });

        const note = typeof frame.note === 'string' ? frame.note.trim() : '';
        if (note) {
          doc.font('Helvetica').fontSize(9).fillColor('#374151')
            .text(note, cellX + cellPad, cellY + cellH - noteHeight, {
              width: cellW - cellPad * 2,
              align: 'center',
              ellipsis: true,
            });
        }
      }
      pageIndex++;
    }

    // Seitenzahlen nachträglich einzeichnen (Gesamtzahl steht erst nach der Schleife fest)
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, totalPages);
    }

    doc.end();
  } catch (err) {
    logger.error('[exportPdf]', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Interner Serverfehler' });
  }
}

// ── Spielbericht (Roadmap-Audit, Fortsetzung Phase C) ─────────────────────
// Server nutzt kein i18next – dieselben Strings wie die bestehenden
// games.presetX/games.attributionOpponent/matchSquad.statusX-i18n-Keys im
// Frontend hier bewusst als einfaches Objekt dupliziert, statt eine eigene
// Backend-i18n-Infrastruktur nur für diesen einen Zweck einzuführen (gleiches
// Muster wie das bestehende TEXT-Objekt oben für die Fußzeilen-Strings).
const REPORT_TEXT = {
  de: {
    title: 'Spielbericht',
    opponentLabel: 'Gegner',
    dateLabel: 'Datum',
    finalScore: 'Endstand',
    us: 'Wir',
    noOpponent: 'Ohne Gegner',
    noDate: 'Kein Datum',
    eventsHeading: 'Ereignisse',
    noEvents: 'Keine Ereignisse erfasst.',
    squadHeading: 'Kader',
    noSquad: 'Kein Kader-Status erfasst.',
    footer: 'Vertraulich – Nur für internes Coaching',
    page: (n, total) => `Seite ${n} von ${total}`,
    attributionOpponent: 'Gegner',
    eventLabels: {
      kickoff_q1: 'Anstoß 1. Drittel', kickoff_q2: 'Anstoß 2. Drittel', kickoff_q3: 'Anstoß 3. Drittel',
      period_end: 'Drittelende', timeout: 'Auszeit', goal: 'Tor',
      penalty_2: 'Strafzeit 2 Min.', penalty_5: 'Strafzeit 5 Min.',
      match_penalty: 'Matchstrafe', game_end: 'Spielende', shot: 'Schuss',
    },
    outcomeLabels: { goal: 'Tor', save: 'Gehalten', miss: 'Verfehlt', block: 'Geblockt' },
    statusLabels: { playing: 'Spielt', reserve: 'Ersatz', injured: 'Verletzt', absent: 'Fehlt' },
  },
  en: {
    title: 'Game Report',
    opponentLabel: 'Opponent',
    dateLabel: 'Date',
    finalScore: 'Final score',
    us: 'Us',
    noOpponent: 'No opponent',
    noDate: 'No date',
    eventsHeading: 'Events',
    noEvents: 'No events recorded.',
    squadHeading: 'Squad',
    noSquad: 'No squad status recorded.',
    footer: 'Confidential – For internal coaching use only',
    page: (n, total) => `Page ${n} of ${total}`,
    attributionOpponent: 'Opponent',
    eventLabels: {
      kickoff_q1: 'Kickoff 1st period', kickoff_q2: 'Kickoff 2nd period', kickoff_q3: 'Kickoff 3rd period',
      period_end: 'End of period', timeout: 'Timeout', goal: 'Goal',
      penalty_2: '2-minute penalty', penalty_5: '5-minute penalty',
      match_penalty: 'Match penalty', game_end: 'End of game', shot: 'Shot',
    },
    outcomeLabels: { goal: 'Goal', save: 'Save', miss: 'Miss', block: 'Block' },
    statusLabels: { playing: 'Playing', reserve: 'Reserve', injured: 'Injured', absent: 'Absent' },
  },
};

const STATUS_PRIORITY_SQL = `CASE gs.status
  WHEN 'playing' THEN 0 WHEN 'reserve' THEN 1 WHEN 'injured' THEN 2 WHEN 'absent' THEN 3 ELSE 4 END`;

// Rekonstruiert das Anzeige-Label eines Ereignisses aus Typ + Zuordnung,
// exakt dieselbe Logik wie eventLabel() in GamePage.jsx – nur serverseitig,
// da die PDF-Erzeugung serverseitig läuft.
function reportEventLabel(row, texts) {
  let base = texts.eventLabels[row.event_type] ?? row.event_type;
  if (row.event_type === 'shot' && row.outcome) {
    base = `${base} (${texts.outcomeLabels[row.outcome] ?? row.outcome})`;
  }
  if (row.is_opponent) return `${base} – ${texts.attributionOpponent}`;
  if (row.roster_player_id) {
    const label = row.jersey_number != null ? `#${row.jersey_number} ${row.name}` : row.name;
    return `${base} – ${label}`;
  }
  return base;
}

function formatReportDate(date, lang) {
  if (!date) return null;
  return new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatReportTime(date, lang) {
  return new Date(date).toLocaleTimeString(lang === 'en' ? 'en-US' : 'de-DE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * POST /api/export/game-report
 * Body: { gameId, language? }
 */
export async function exportGameReport(req, res) {
  const { gameId, language = 'de' } = req.body;
  const lang = language === 'en' ? 'en' : 'de';
  const texts = REPORT_TEXT[lang];

  try {
    if (!gameId || !(await assertGameRead(gameId, req.user.id))) {
      return res.status(404).json({ success: false, message: 'Spiel nicht gefunden' });
    }

    const gameResult = await pool.query('SELECT opponent, played_at FROM games WHERE id = $1', [gameId]);
    const game = gameResult.rows[0];

    const eventsResult = await pool.query(
      `SELECT ge.id, ge.event_type, ge.roster_player_id, ge.is_opponent, ge.created_at, ge.metadata, ge.outcome, rp.name, rp.jersey_number
       FROM game_events ge
       LEFT JOIN roster_players rp ON rp.id = ge.roster_player_id
       WHERE ge.game_id = $1
       ORDER BY ge.created_at ASC`,
      [gameId]
    );
    // Companion-Goal-Events (Phase 3 Schuss-Tracking, ADR-0002) aus der
    // GEDRUCKTEN Zeitleiste herausfiltern – sonst erscheint ein per
    // "Schuss erfassen" markiertes Tor doppelt (einmal als Schuss-Zeile,
    // einmal als eigenständige Tor-Zeile). Die Spielstand-Berechnung
    // unten läuft bewusst weiterhin über ALLE Zeilen (inkl. Companion-
    // Events) – nur die Anzeige wird gefiltert, nicht die Zählung.
    const companionGoalIds = new Set(
      eventsResult.rows
        .filter((e) => e.event_type === 'shot' && e.metadata?.companionGoalEventId)
        .map((e) => e.metadata.companionGoalEventId)
    );
    const printedEvents = eventsResult.rows.filter((e) => !companionGoalIds.has(e.id));
    const squadResult = await pool.query(
      `SELECT gs.status, rp.name, rp.jersey_number
       FROM game_squad gs
       JOIN roster_players rp ON rp.id = gs.roster_player_id
       WHERE gs.game_id = $1
       ORDER BY ${STATUS_PRIORITY_SQL}, rp.jersey_number ASC NULLS LAST, rp.name ASC`,
      [gameId]
    );

    const { ownGoals, opponentGoals } = calculateMatchScore(eventsResult.rows);
    const opponentName = game.opponent?.trim() || texts.noOpponent;

    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="openfloorball-spielbericht.pdf"');
    doc.pipe(res);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    function drawFooter(pageNum, totalPages) {
      const y = doc.page.height - doc.page.margins.bottom - 14;
      doc.font('Helvetica-Oblique').fontSize(8).fillColor('#9ca3af')
        .text(texts.footer, doc.page.margins.left, y, { width: contentWidth / 2, lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
        .text(texts.page(pageNum, totalPages), doc.page.margins.left, y, { width: contentWidth, align: 'right', lineBreak: false });
    }

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text('OpenFloorball');
    doc.font('Helvetica').fontSize(11).fillColor('#374151').text(texts.title);
    doc.moveDown(0.5);
    doc.font('Helvetica').fontSize(10).fillColor('#6b7280')
      .text(`${texts.opponentLabel}: ${opponentName}    ${texts.dateLabel}: ${formatReportDate(game.played_at, lang) ?? texts.noDate}`);
    doc.moveDown(1);

    doc.font('Helvetica-Bold').fontSize(20).fillColor('#111827')
      .text(`${texts.us} ${ownGoals} : ${opponentGoals} ${opponentName}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(texts.eventsHeading);
    doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);
    if (printedEvents.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#6b7280').text(texts.noEvents);
    } else {
      for (const row of printedEvents) {
        doc.font('Helvetica').fontSize(10).fillColor('#374151')
          .text(`${formatReportTime(row.created_at, lang)}   ${reportEventLabel(row, texts)}`);
      }
    }
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold').fontSize(13).fillColor('#111827').text(texts.squadHeading);
    doc.moveTo(doc.x, doc.y + 2).lineTo(doc.page.width - doc.page.margins.right, doc.y + 2).strokeColor('#d1d5db').stroke();
    doc.moveDown(0.5);
    if (squadResult.rows.length === 0) {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor('#6b7280').text(texts.noSquad);
    } else {
      for (const row of squadResult.rows) {
        const label = row.jersey_number != null ? `#${row.jersey_number} ${row.name}` : row.name;
        doc.font('Helvetica').fontSize(10).fillColor('#374151')
          .text(`${label} – ${texts.statusLabels[row.status] ?? row.status}`);
      }
    }

    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      drawFooter(i + 1, totalPages);
    }

    doc.end();
  } catch (err) {
    logger.error('[exportGameReport]', err);
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Interner Serverfehler' });
  }
}
