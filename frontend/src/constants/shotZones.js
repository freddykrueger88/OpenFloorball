/**
 * SHOT_ZONES/deriveZone – floorball-eigene Zonen-Taxonomie (Statistik-
 * Architektur Phase 3). Bewusste kleine Duplikation der Logik aus
 * backend/src/services/statisticsEngine.js (kein Shared-Package
 * zwischen Backend/Frontend, gleiche Toleranz wie z.B. toDateString) –
 * bei Änderung der Schwellwerte beide Dateien synchron halten.
 *
 * x∈[0,1] = Nähe zum beschossenen Tor (1=am Tor), y∈[0,1] = quer zur
 * Torbreite (0=links, 1=rechts aus Schützensicht).
 */
export const SHOT_ZONES = [
  { key: 'nahzone_zentrum', labelDe: 'Nahzone Zentrum', labelEn: 'Close range – central' },
  { key: 'nahzone_links',   labelDe: 'Nahzone Links',    labelEn: 'Close range – left' },
  { key: 'nahzone_rechts',  labelDe: 'Nahzone Rechts',   labelEn: 'Close range – right' },
  { key: 'halbdistanz',     labelDe: 'Halbdistanz',      labelEn: 'Mid range' },
  { key: 'distanz',         labelDe: 'Distanz',          labelEn: 'Long range' },
];

const ZONE_CLOSE_X = 0.72;
const ZONE_MID_X = 0.40;
const ZONE_Y_LEFT = 0.35;
const ZONE_Y_RIGHT = 0.65;

export function deriveZone(x, y) {
  if (x == null || y == null) return null;
  const cx = Math.min(1, Math.max(0, x));
  const cy = Math.min(1, Math.max(0, y));
  if (cx >= ZONE_CLOSE_X) {
    if (cy < ZONE_Y_LEFT) return 'nahzone_links';
    if (cy > ZONE_Y_RIGHT) return 'nahzone_rechts';
    return 'nahzone_zentrum';
  }
  return cx >= ZONE_MID_X ? 'halbdistanz' : 'distanz';
}
