/**
 * csv – minimaler RFC-4180-Serialisierer (Statistik-Architektur Phase 7,
 * "Report Builder" durch einen konkret abgegrenzten CSV-Export ersetzt,
 * siehe Phasenplanungs-Review 2026-08-21). Bewusst keine neue
 * Abhängigkeit für so eine kleine, wohlbekannte Aufgabe (CLAUDE.md §5.4/23
 * – keine unnötige Abhängigkeit ohne klaren Nutzen).
 */
function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// columns: [{ key, header }] – key liest das Feld aus jeder Zeile,
// header ist die (bereits übersetzte) Spaltenüberschrift.
export function toCsv(rows, columns) {
  const lines = [
    columns.map((c) => escapeCsvField(c.header)).join(','),
    ...rows.map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(',')),
  ];
  return `${lines.join('\r\n')}\r\n`;
}
