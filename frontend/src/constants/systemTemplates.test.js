import { describe, it, expect } from 'vitest';
import { IFF_FIELDS } from './fieldConfig.js';
import {
  SYSTEM_TEMPLATES, SYSTEM_CATEGORIES, getSystemTemplatesByCategory, SYSTEM_TEMPLATE_BY_ID,
} from './systemTemplates.js';

describe('systemTemplates (CLAUDE.md 9.4-9.6 – Forechecking/Powerplay/Boxplay)', () => {
  it('liefert für jede Kategorie mindestens eine Vorlage', () => {
    for (const category of SYSTEM_CATEGORIES) {
      expect(getSystemTemplatesByCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('hat eindeutige IDs und keine Duplikat-Kandidaten', () => {
    const ids = SYSTEM_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('referenziert pro Vorlage eine eindeutige, vollständige Spieleraufstellung', () => {
    for (const template of SYSTEM_TEMPLATES) {
      expect(SYSTEM_TEMPLATE_BY_ID[template.id]).toBe(template);
      expect(template.players.some((p) => p.team === 'away')).toBe(false);
      expect(template.players.every((p) => p.team === 'home')).toBe(true);
    }
  });

  it('hält sich für alle Vorlagen innerhalb der Großfeld-Grenzen', () => {
    const field = IFF_FIELDS.large;
    for (const template of SYSTEM_TEMPLATES) {
      for (const p of template.players) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(field.width);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(field.height);
      }
    }
  });

  it('enthält pro Vorlage einen Torwart plus vier bis sechs Feldspieler', () => {
    const expectedSkaters = {
      'forechecking-2-1-2': 5, 'forechecking-2-2-1': 5, 'forechecking-1-2-2': 5,
      'forechecking-high-press': 5, 'forechecking-mid-press': 5, 'forechecking-low-block': 5,
      'powerplay-5v4-umbrella': 5, 'powerplay-5v3-overload': 5,
      'powerplay-4v3': 4, 'powerplay-6v5-empty-net': 6,
      'boxplay-box': 5, 'boxplay-diamond': 5, 'boxplay-aggressive': 5, 'boxplay-passive': 5,
    };
    for (const template of SYSTEM_TEMPLATES) {
      const skaters = template.players.filter((p) => p.role !== 'TW');
      expect(skaters).toHaveLength(expectedSkaters[template.id]);
      expect(template.players.filter((p) => p.role === 'TW')).toHaveLength(1);
    }
  });

  it('hat innerhalb einer Vorlage eindeutige Spieler-IDs', () => {
    for (const template of SYSTEM_TEMPLATES) {
      const ids = template.players.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});