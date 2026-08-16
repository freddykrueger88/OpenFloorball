/**
 * SHOT_TYPES/SHOT_OUTCOMES – Statistik-Architektur Phase 3. Schusstypen
 * bewusst floorball-eigen benannt (Schlagschuss statt "Slapshot"), nicht
 * aus dem Eishockey übernommen.
 */
export const SHOT_TYPES = [
  { key: 'wrist',    labelDe: 'Handgelenkschuss', labelEn: 'Wrist shot' },
  { key: 'swing',    labelDe: 'Schlagschuss',      labelEn: 'Swing shot' },
  { key: 'direct',   labelDe: 'Direktschuss',      labelEn: 'One-timer' },
  { key: 'backhand', labelDe: 'Rückhand',          labelEn: 'Backhand shot' },
];

export const SHOT_OUTCOMES = [
  { key: 'goal',  labelDe: 'Tor',      labelEn: 'Goal' },
  { key: 'save',  labelDe: 'Gehalten', labelEn: 'Save' },
  { key: 'miss',  labelDe: 'Verfehlt', labelEn: 'Miss' },
  { key: 'block', labelDe: 'Geblockt', labelEn: 'Block' },
];
