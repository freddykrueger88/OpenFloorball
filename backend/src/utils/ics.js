/**
 * ics.js – Minimaler iCalendar-Generator (RFC 5545) für den
 * Kalender-Feed (Roadmap-Audit: ICS-Kalender-Abo). Bewusst ohne
 * npm-Abhängigkeit: der Umfang ist einfach genug (nur Ganztags-VEVENTs
 * aus Spielen/Trainingseinheiten, kein Recurrence-/Timezone-Handling).
 *
 * Datumsverarbeitung bewusst NIE über `new Date(dateStr)` (String-
 * Parsing interpretiert als UTC-Mitternacht, Off-by-one-Risiko in
 * Zeitzonen westlich von UTC) – Jahr/Monat/Tag werden immer explizit
 * aus dem "YYYY-MM-DD"-String zerlegt und über die lokalen
 * Date-Konstruktor-Argumente (new Date(year, month, day)) verarbeitet,
 * exakt das bereits im Frontend etablierte Muster
 * (frontend/src/utils/formatDate.js, frontend/src/pages/CalendarPage.jsx).
 */

const FOLD_LIMIT = 75;

export function escapeIcsText(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// RFC 5545 §3.1: Zeilen über 75 Zeichen werden umgebrochen, jede
// Folgezeile beginnt mit genau einem Leerzeichen (Continuation).
export function foldLine(line) {
  if (line.length <= FOLD_LIMIT) return line;
  const parts = [];
  let rest = line;
  while (rest.length > FOLD_LIMIT) {
    parts.push(rest.slice(0, FOLD_LIMIT));
    rest = rest.slice(FOLD_LIMIT);
  }
  parts.push(rest);
  return parts.join('\r\n ');
}

function pad2(n) { return String(n).padStart(2, '0'); }

function parseDateParts(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return { year, month, day };
}

function toCompactDate(year, month, day) {
  return `${year}${pad2(month)}${pad2(day)}`;
}

// Exklusives DTEND für Ganztags-Events – ein Tag nach dem Startdatum.
// new Date(year, month-1, day+1) mit lokalen Integer-Komponenten ist
// sicher (kein String-Parsing), JS normalisiert einen Tag-Überlauf
// (z.B. 31.+1 -> 1. des Folgemonats) automatisch korrekt.
function nextDayCompact(year, month, day) {
  const next = new Date(year, month - 1, day + 1);
  return toCompactDate(next.getFullYear(), next.getMonth() + 1, next.getDate());
}

function nowStamp() {
  const now = new Date();
  return `${now.getUTCFullYear()}${pad2(now.getUTCMonth() + 1)}${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}${pad2(now.getUTCMinutes())}${pad2(now.getUTCSeconds())}Z`;
}

// events: [{ uid, dateStr ("YYYY-MM-DD"), summary }]
export function buildVevent({ uid, dateStr, summary }) {
  const { year, month, day } = parseDateParts(dateStr);
  const dtstart = toCompactDate(year, month, day);
  const dtend = nextDayCompact(year, month, day);
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART;VALUE=DATE:${dtstart}`,
    `DTEND;VALUE=DATE:${dtend}`,
    foldLine(`SUMMARY:${escapeIcsText(summary)}`),
    'END:VEVENT',
  ].join('\r\n');
}

export function buildIcsFeed(events) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OpenFloorball//Kalender-Feed//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events.map(buildVevent),
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n';
}
