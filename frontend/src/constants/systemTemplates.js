/**
 * systemTemplates – eingebaute Systemvorlagen (CLAUDE.md 9.4-9.6)
 *
 * Forechecking/Powerplay/Boxplay als fertige Grundaufstellungen für das
 * Großfeld (5 Feldspieler + Torwart, Heim greift nach rechts an, eigenes
 * Tor bei x≈2). Trainer laden eine Vorlage in den Editor und passen sie
 * mit Drag & Drop an die eigene Situation an. Beim Laden auf einen
 * anderen Feldtyp skaliert der Aufrufer (BoardEditorPage) die
 * Koordinaten via rescalePlayers() – identisch zu gespeicherten
 * Formations-Vorlagen.
 *
 * Koordinaten in IFF-Metern, siehe fieldConfig.js (IFF_FIELDS.large:
 * 40×20m, Mittelpunkt 20/10). `nameKey` verweist auf die i18n-Keys
 * unter `formations.templates.*` – so bleiben die Anzeigenamen
 * übersetzt und alle Locales synchron.
 */
import { IFF_FIELDS } from './fieldConfig.js';

const TW = { id: 'h1', role: 'TW', position: 'Torwart', x: 2.0, y: 10.0, team: 'home' };

function skaters(entries) {
  return [TW, ...entries];
}

const SK = (n, role, position, x, y) => ({ id: `h${n}`, role, position, x, y, team: 'home' });

export const SYSTEM_TEMPLATES = [
  // ── Forechecking (Anlaufen/Anpresse im gegnerischen Drittel, x 21-37) ──
  {
    id: 'forechecking-2-1-2',
    nameKey: 'formations.templates.forechecking212',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 35, 6),
      SK(3, 'S', 'Stürmer', 35, 14),
      SK(4, 'C', 'Center', 31, 10),
      SK(5, 'V', 'Verteidiger', 26, 6),
      SK(6, 'V', 'Verteidiger', 26, 14),
    ]),
  },
  {
    id: 'forechecking-2-2-1',
    nameKey: 'formations.templates.forechecking221',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 36, 5),
      SK(3, 'S', 'Stürmer', 36, 15),
      SK(4, 'C', 'Center', 31, 6),
      SK(5, 'V', 'Verteidiger', 31, 14),
      SK(6, 'V', 'Verteidiger', 26, 10),
    ]),
  },
  {
    id: 'forechecking-1-2-2',
    nameKey: 'formations.templates.forechecking122',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 36, 10),
      SK(3, 'C', 'Center', 31, 5),
      SK(4, 'C', 'Center', 31, 15),
      SK(5, 'V', 'Verteidiger', 26, 6),
      SK(6, 'V', 'Verteidiger', 26, 14),
    ]),
  },
  {
    id: 'forechecking-high-press',
    nameKey: 'formations.templates.forecheckingHighPress',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 36, 4),
      SK(3, 'S', 'Stürmer', 36, 16),
      SK(4, 'C', 'Center', 32, 10),
      SK(5, 'V', 'Verteidiger', 28, 6),
      SK(6, 'V', 'Verteidiger', 28, 14),
    ]),
  },
  {
    id: 'forechecking-mid-press',
    nameKey: 'formations.templates.forecheckingMidPress',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 28, 6),
      SK(3, 'S', 'Stürmer', 28, 14),
      SK(4, 'C', 'Center', 25, 10),
      SK(5, 'V', 'Verteidiger', 21, 6),
      SK(6, 'V', 'Verteidiger', 21, 14),
    ]),
  },
  {
    id: 'forechecking-low-block',
    nameKey: 'formations.templates.forecheckingLowBlock',
    category: 'forechecking',
    fieldType: 'large',
    players: skaters([
      SK(2, 'C', 'Center', 15, 8),
      SK(3, 'C', 'Center', 15, 12),
      SK(4, 'C', 'Center', 12, 10),
      SK(5, 'V', 'Verteidiger', 8, 7),
      SK(6, 'V', 'Verteidiger', 8, 13),
    ]),
  },

  // ── Powerplay (Überzahl im gegnerischen Drittel, Tor bei x≈37) ──
  {
    id: 'powerplay-5v4-umbrella',
    nameKey: 'formations.templates.powerplay5v4Umbrella',
    category: 'powerplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'V', 'Verteidiger', 27, 5),
      SK(3, 'V', 'Verteidiger', 27, 15),
      SK(4, 'V', 'Verteidiger', 25, 10),
      SK(5, 'C', 'Center', 32, 10),
      SK(6, 'S', 'Stürmer', 35, 10),
    ]),
  },
  {
    id: 'powerplay-5v3-overload',
    nameKey: 'formations.templates.powerplay5v3Overload',
    category: 'powerplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'V', 'Verteidiger', 26, 3),
      SK(3, 'V', 'Verteidiger', 26, 17),
      SK(4, 'V', 'Verteidiger', 24, 10),
      SK(5, 'C', 'Center', 33, 10),
      SK(6, 'S', 'Stürmer', 35, 12),
    ]),
  },
  {
    id: 'powerplay-4v3',
    nameKey: 'formations.templates.powerplay4v3',
    category: 'powerplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'V', 'Verteidiger', 27, 5),
      SK(3, 'V', 'Verteidiger', 27, 15),
      SK(4, 'V', 'Verteidiger', 25, 10),
      SK(5, 'S', 'Stürmer', 35, 10),
    ]),
  },
  {
    id: 'powerplay-6v5-empty-net',
    nameKey: 'formations.templates.powerplay6v5EmptyNet',
    category: 'powerplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'V', 'Verteidiger', 28, 4),
      SK(3, 'V', 'Verteidiger', 28, 16),
      SK(4, 'V', 'Verteidiger', 25, 10),
      SK(5, 'V', 'Verteidiger', 22, 10),
      SK(6, 'C', 'Center', 31, 13),
      SK(7, 'S', 'Stürmer', 34, 10),
    ]),
  },

  // ── Boxplay (Unterzahl vor dem eigenen Tor, Tor bei x≈2) ──
  {
    id: 'boxplay-box',
    nameKey: 'formations.templates.boxplayBox',
    category: 'boxplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 6, 8),
      SK(3, 'S', 'Stürmer', 6, 12),
      SK(4, 'C', 'Center', 11, 6),
      SK(5, 'C', 'Center', 11, 14),
      SK(6, 'V', 'Verteidiger', 13, 10),
    ]),
  },
  {
    id: 'boxplay-diamond',
    nameKey: 'formations.templates.boxplayDiamond',
    category: 'boxplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 5, 10),
      SK(3, 'C', 'Center', 9, 6),
      SK(4, 'C', 'Center', 9, 14),
      SK(5, 'V', 'Verteidiger', 13, 10),
      SK(6, 'V', 'Verteidiger', 12, 12),
    ]),
  },
  {
    id: 'boxplay-aggressive',
    nameKey: 'formations.templates.boxplayAggressive',
    category: 'boxplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 6, 8),
      SK(3, 'S', 'Stürmer', 6, 12),
      SK(4, 'C', 'Center', 10, 5),
      SK(5, 'C', 'Center', 10, 15),
      SK(6, 'V', 'Verteidiger', 14, 10),
    ]),
  },
  {
    id: 'boxplay-passive',
    nameKey: 'formations.templates.boxplayPassive',
    category: 'boxplay',
    fieldType: 'large',
    players: skaters([
      SK(2, 'S', 'Stürmer', 5, 9),
      SK(3, 'S', 'Stürmer', 5, 11),
      SK(4, 'C', 'Center', 8, 7),
      SK(5, 'C', 'Center', 8, 13),
      SK(6, 'V', 'Verteidiger', 11, 10),
    ]),
  },
];

/** Erlaubte Kategorien für die Systemvorlagen / die Kategorie-Box beim Speichern */
export const SYSTEM_CATEGORIES = ['forechecking', 'powerplay', 'boxplay'];

/** Vorlagen für eine Kategorie (findById als Helfer für Tests/UI) */
export function getSystemTemplatesByCategory(category) {
  return SYSTEM_TEMPLATES.filter((t) => t.category === category);
}

export const SYSTEM_TEMPLATE_BY_ID = Object.fromEntries(
  SYSTEM_TEMPLATES.map((t) => [t.id, t])
);

// LEDIGLICH Gültigkeits-Check zur Laufzeit: kein Vorlagen-Spieler darf das
// Feld verlassen (schützt vor Tippfehlern in den Koordinaten oben).
for (const t of SYSTEM_TEMPLATES) {
  const field = IFF_FIELDS[t.fieldType];
  for (const p of t.players) {
    if (p.x < 0 || p.x > field.width || p.y < 0 || p.y > field.height) {
      throw new Error(`Systemvorlage "${t.id}" hat Spieler außerhalb des Feldes`);
    }
  }
}