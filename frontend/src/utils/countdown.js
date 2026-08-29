/**
 * countdown – zuverlässiger Countdown bis zu einem Spiel-/Trainingstermin
 * (Spieler-Dashboard-Ausbau). Reine, testbare Funktionen ohne React-Bezug –
 * `MatchCountdown.jsx` ruft `getCountdown` per `setInterval` erneut auf.
 */

// `dateStr`/`timeStr` werden als LOKALE Zeit interpretiert, nicht UTC –
// analog utils/formatDate.js::formatDateOnly: ein "YYYY-MM-DD"-String über
// `new Date(str)` würde als UTC-Mitternacht interpretiert und könnte in
// Zeitzonen westlich von UTC einen Tag zu früh erscheinen.
export function toLocalDate(dateStr, timeStr = null) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;

  let hours = 0;
  let minutes = 0;
  if (timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    hours = h || 0;
    minutes = m || 0;
  }
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

// Ein Spiel ohne bekannte Dauer gilt für dieses Zeitfenster nach dem
// Anstoß noch als "läuft" statt "vorbei" – lang genug für eine reguläre
// Floorball-Partie inkl. Pausen, kurz genug um am nächsten Tag nicht mehr
// fälschlich als laufend zu gelten.
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

// getCountdown – { days, hours, minutes, isToday, isPast, isLive }
export function getCountdown(targetDate, now = new Date()) {
  if (!targetDate) return null;

  const diffMs = targetDate.getTime() - now.getTime();
  const isToday = targetDate.toDateString() === now.toDateString();

  if (diffMs <= 0) {
    return {
      days: 0, hours: 0, minutes: 0,
      isToday,
      isLive: diffMs > -LIVE_WINDOW_MS,
      isPast: diffMs <= -LIVE_WINDOW_MS,
    };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  return {
    days: Math.floor(totalMinutes / (60 * 24)),
    hours: Math.floor((totalMinutes % (60 * 24)) / 60),
    minutes: totalMinutes % 60,
    isToday,
    isLive: false,
    isPast: false,
  };
}

export function isWithinLiveOrFutureWindow(targetDate, now = new Date()) {
  if (!targetDate) return false;
  return now.getTime() - targetDate.getTime() < LIVE_WINDOW_MS;
}
