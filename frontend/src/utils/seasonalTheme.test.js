import { describe, it, expect } from 'vitest';
import { isHalloweenActive, halloweenGlyphFor } from './seasonalTheme.js';

describe('isHalloweenActive', () => {
  it('ist am 31. Oktober aktiv', () => {
    expect(isHalloweenActive(new Date(2026, 9, 31))).toBe(true);
  });

  it('ist am 30. Oktober noch nicht aktiv', () => {
    expect(isHalloweenActive(new Date(2026, 9, 30))).toBe(false);
  });

  it('ist am 1. November nicht mehr aktiv', () => {
    expect(isHalloweenActive(new Date(2026, 10, 1))).toBe(false);
  });

  it('ist am 31. eines anderen Monats nicht aktiv', () => {
    expect(isHalloweenActive(new Date(2026, 7, 31))).toBe(false);
  });
});

describe('halloweenGlyphFor', () => {
  it('gibt Torhütern (beider Teams) das Spinnen-Glyph, unabhängig vom Team', () => {
    expect(halloweenGlyphFor({ team: 'home', role: 'TW' })).toBe('🕷️');
    expect(halloweenGlyphFor({ team: 'away', role: 'TW' })).toBe('🕷️');
  });

  it('gibt Heim-Feldspielern den Kürbis', () => {
    expect(halloweenGlyphFor({ team: 'home', role: 'C' })).toBe('🎃');
  });

  it('gibt Auswärts-Feldspielern das Gespenst', () => {
    expect(halloweenGlyphFor({ team: 'away', role: 'V' })).toBe('👻');
  });
});
