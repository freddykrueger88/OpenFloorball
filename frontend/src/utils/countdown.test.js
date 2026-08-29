/**
 * countdown.test.js – Spieler-Dashboard-Ausbau: Countdown-Berechnung
 * (heute/morgen/live/vergangen), zeitzonensicher.
 */
import { describe, it, expect } from 'vitest';
import { toLocalDate, getCountdown, isWithinLiveOrFutureWindow } from './countdown.js';

describe('toLocalDate', () => {
  it('baut ein lokales Datum ohne Uhrzeit-Verschiebung', () => {
    const d = toLocalDate('2026-09-20', '18:30');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // 0-indexiert
    expect(d.getDate()).toBe(20);
    expect(d.getHours()).toBe(18);
    expect(d.getMinutes()).toBe(30);
  });

  it('setzt 00:00, wenn keine Uhrzeit übergeben wird', () => {
    const d = toLocalDate('2026-09-20');
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it('gibt null für ein leeres Datum zurück', () => {
    expect(toLocalDate(null)).toBeNull();
    expect(toLocalDate('')).toBeNull();
  });
});

describe('getCountdown', () => {
  it('berechnet Tage/Stunden/Minuten für einen zukünftigen Termin', () => {
    const now = new Date(2026, 8, 18, 10, 0, 0);
    const target = new Date(2026, 8, 20, 14, 30, 0);
    const c = getCountdown(target, now);
    expect(c.days).toBe(2);
    expect(c.isPast).toBe(false);
    expect(c.isLive).toBe(false);
  });

  it('markiert isToday korrekt für einen Termin am selben Kalendertag', () => {
    const now = new Date(2026, 8, 18, 10, 0, 0);
    const target = new Date(2026, 8, 18, 18, 30, 0);
    const c = getCountdown(target, now);
    expect(c.isToday).toBe(true);
    expect(c.days).toBe(0);
  });

  it('markiert ein Spiel innerhalb des Live-Fensters als isLive', () => {
    const now = new Date(2026, 8, 18, 19, 0, 0);
    const target = new Date(2026, 8, 18, 18, 0, 0); // vor 1h angepfiffen
    const c = getCountdown(target, now);
    expect(c.isLive).toBe(true);
    expect(c.isPast).toBe(false);
  });

  it('markiert einen lang vergangenen Termin als isPast', () => {
    const now = new Date(2026, 8, 20, 10, 0, 0);
    const target = new Date(2026, 8, 18, 18, 0, 0);
    const c = getCountdown(target, now);
    expect(c.isPast).toBe(true);
    expect(c.isLive).toBe(false);
  });

  it('gibt null für ein fehlendes Zieldatum zurück', () => {
    expect(getCountdown(null)).toBeNull();
  });
});

describe('isWithinLiveOrFutureWindow', () => {
  it('ist true für zukünftige und laufende Termine, false für lang vergangene', () => {
    const now = new Date(2026, 8, 18, 12, 0, 0);
    expect(isWithinLiveOrFutureWindow(new Date(2026, 8, 19), now)).toBe(true);
    expect(isWithinLiveOrFutureWindow(new Date(2026, 8, 18, 11, 0, 0), now)).toBe(true);
    expect(isWithinLiveOrFutureWindow(new Date(2026, 8, 17, 8, 0, 0), now)).toBe(false);
  });
});
