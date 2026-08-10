/**
 * dateMath.js – reine Datums-Arithmetik für "YYYY-MM-DD"-Strings
 * (Serientermine, Roadmap-Audit). Bewusst über `Date.UTC(...)` statt
 * `new Date(dateStr)` (String-Parsing als UTC-Mitternacht interpretiert,
 * aber lokale Getter würden dann in Zeitzonen westlich von UTC einen
 * Tag zurückspringen) und statt eines lokalen `Date`-Objekts (DST-
 * Sprünge könnten +1 Tag zu +23h/+25h verzerren) – Y/M/D werden explizit
 * zerlegt, über UTC-Millisekunden verschoben und wieder über die
 * UTC-Getter zurückformatiert, dadurch komplett zeitzonenunabhängig.
 */

function pad2(n) { return String(n).padStart(2, '0'); }

export function addDays(dateStr, days) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`;
}
