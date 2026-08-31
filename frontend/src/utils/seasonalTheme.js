/**
 * seasonalTheme – reine Datums-Logik für saisonale Deko-Themes (aktuell:
 * Halloween). Bewusst nur das lokale Browser-Datum, kein Server-Zustand,
 * kein Tracking (CLAUDE.md §5.1 Datensparsamkeit) – rein dekorativ, ohne
 * jede Auswirkung auf Taktikboard-Daten oder Kernfunktionen.
 */
export function isHalloweenActive(date = new Date()) {
  return date.getMonth() === 9 && date.getDate() === 31; // 31. Oktober
}

// Torhüter bleiben eine eigene Form/eigenes Glyph (wie sonst die Raute) –
// wichtig für die Formunterscheidung bei Farbenblindheit (Issue #19),
// nicht nur für die Kürbis-Optik.
export function halloweenGlyphFor({ team, role } = {}) {
  if (role === 'TW') return '🕷️';
  return team === 'away' ? '👻' : '🎃';
}
