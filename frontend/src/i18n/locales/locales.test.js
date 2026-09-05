import { describe, it, expect } from 'vitest';
import de from './de.json';
import en from './en.json';
import sv from './sv.json';
import fi from './fi.json';
import cs from './cs.json';
import sk from './sk.json';
import nb from './nb.json';
import lv from './lv.json';
import pl from './pl.json';
import fr from './fr.json';

// Neue Sprache hinzufügen: Datei importieren und hier eintragen – der
// Rest der Tests läuft automatisch mit. Das ist absichtlich die
// zentrale "Werkzeug"-Stelle für Community-Übersetzungen (siehe
// docs/TRANSLATING.md): `npm test` zeigt sofort und exakt, welche
// Schlüssel in einer neuen/aktualisierten Sprachdatei fehlen oder leer
// sind, ohne dass Contributors irgendetwas anderes einrichten müssen.
const LOCALES = { de, en, sv, fi, cs, sk, nb, lv, pl, fr };
const REFERENCE_LOCALE = 'en';

function flattenKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flattenKeys(value, path)
      : [path];
  });
}

describe('i18n locale parity (alle Sprachen <-> Referenz)', () => {
  const referenceKeys = new Set(flattenKeys(LOCALES[REFERENCE_LOCALE]));

  for (const [lng, resource] of Object.entries(LOCALES)) {
    if (lng === REFERENCE_LOCALE) continue;

    it(`${lng}.json hat exakt dieselben Übersetzungsschlüssel wie ${REFERENCE_LOCALE}.json`, () => {
      const keys = new Set(flattenKeys(resource));

      const missing = [...referenceKeys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !referenceKeys.has(k));

      expect(missing, `Schlüssel fehlen in ${lng}.json: ${missing.join(', ')}`).toEqual([]);
      expect(extra, `Zusätzliche Schlüssel in ${lng}.json (nicht in ${REFERENCE_LOCALE}.json): ${extra.join(', ')}`).toEqual([]);
    });
  }

  it('enthält keine leeren Übersetzungswerte', () => {
    const emptyIn = (obj, label) =>
      flattenKeys(obj).filter((path) => {
        const value = path.split('.').reduce((o, k) => o?.[k], obj);
        return typeof value === 'string' && value.trim() === '';
      }).map((k) => `${label}:${k}`);

    const empty = Object.entries(LOCALES).flatMap(([lng, resource]) => emptyIn(resource, lng));
    expect(empty).toEqual([]);
  });
});
