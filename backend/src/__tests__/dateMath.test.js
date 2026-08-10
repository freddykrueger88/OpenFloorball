/**
 * dateMath.test.js – reine Unit-Tests für die Serientermine-
 * Datumsarithmetik, ohne DB/App (siehe utils/dateMath.js).
 */
import { addDays } from '../utils/dateMath.js';

describe('addDays', () => {
  it('addiert Tage innerhalb eines Monats', () => {
    expect(addDays('2026-08-11', 7)).toBe('2026-08-18');
  });

  it('behandelt einen Monatsübergang korrekt', () => {
    expect(addDays('2026-08-28', 7)).toBe('2026-09-04');
  });

  it('behandelt einen Jahresübergang korrekt', () => {
    expect(addDays('2026-12-29', 7)).toBe('2027-01-05');
  });

  it('behandelt einen Schaltjahr-Februar korrekt (2028 ist ein Schaltjahr)', () => {
    expect(addDays('2028-02-25', 7)).toBe('2028-03-03');
  });

  it('funktioniert für 14-Tage-Schritte (alle 2 Wochen)', () => {
    expect(addDays('2026-08-11', 14)).toBe('2026-08-25');
  });
});
