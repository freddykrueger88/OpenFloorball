import { describe, it, expect } from 'vitest';
import { getNextOccurrence, selectUpcomingBirthdays, getMonthOccurrences } from './birthdaySelectors.js';

describe('getNextOccurrence', () => {
  it('liefert dieses Jahr, wenn der Geburtstag noch bevorsteht', () => {
    const today = new Date(2026, 2, 1); // 1. März 2026
    const { date, age } = getNextOccurrence('1990-06-15', today);
    expect(date).toEqual(new Date(2026, 5, 15));
    expect(age).toBe(36);
  });

  it('liefert nächstes Jahr, wenn der Geburtstag dieses Jahr schon vorbei ist', () => {
    const today = new Date(2026, 8, 1); // 1. September 2026
    const { date, age } = getNextOccurrence('1990-06-15', today);
    expect(date).toEqual(new Date(2027, 5, 15));
    expect(age).toBe(37);
  });

  it('behandelt "heute" als bevorstehend (Tag 0), nicht als vergangen', () => {
    const today = new Date(2026, 5, 15);
    const { date, age } = getNextOccurrence('1990-06-15', today);
    expect(date).toEqual(new Date(2026, 5, 15));
    expect(age).toBe(36);
  });

  it('legt den 29. Februar in einem Nicht-Schaltjahr auf den 28. Februar', () => {
    const today = new Date(2027, 0, 1); // 2027 ist kein Schaltjahr
    const { date } = getNextOccurrence('1992-02-29', today);
    expect(date).toEqual(new Date(2027, 1, 28));
  });

  it('zeigt den 29. Februar im tatsächlichen Schaltjahr korrekt an', () => {
    const today = new Date(2028, 0, 1); // 2028 ist ein Schaltjahr
    const { date } = getNextOccurrence('1992-02-29', today);
    expect(date).toEqual(new Date(2028, 1, 29));
  });
});

describe('selectUpcomingBirthdays', () => {
  it('sortiert aufsteigend nach Tagen bis zur nächsten Wiederkehr und markiert "heute"', () => {
    const today = new Date(2026, 5, 10);
    const result = selectUpcomingBirthdays([
      { _id: 'a', name: 'Anna', birthday: '1990-06-20' },
      { _id: 'b', name: 'Bo', birthday: '1990-06-10' },
      { _id: 'c', name: 'Cem', birthday: '1990-07-01' },
    ], today);

    expect(result.map((r) => r._id)).toEqual(['b', 'a', 'c']);
    expect(result[0].isToday).toBe(true);
    expect(result[0].daysUntil).toBe(0);
    expect(result[1].daysUntil).toBe(10);
  });

  it('gibt eine leere Liste zurück, wenn niemand ein Geburtsdatum hat', () => {
    expect(selectUpcomingBirthdays([])).toEqual([]);
  });
});

describe('getMonthOccurrences', () => {
  it('liefert den Tag, wenn der Geburtstag in den angefragten Monat fällt', () => {
    expect(getMonthOccurrences('1990-06-15', 2026, 5)).toEqual([15]); // Monat 0-indiziert: 5 = Juni
  });

  it('liefert eine leere Liste für einen anderen Monat', () => {
    expect(getMonthOccurrences('1990-06-15', 2026, 6)).toEqual([]);
  });

  it('lässt den 29. Februar in einem Nicht-Schaltjahr ehrlich weg statt ihn zu verschieben', () => {
    expect(getMonthOccurrences('1992-02-29', 2027, 1)).toEqual([]);
    expect(getMonthOccurrences('1992-02-29', 2028, 1)).toEqual([29]);
  });
});
