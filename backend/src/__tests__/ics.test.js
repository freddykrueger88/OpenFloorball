/**
 * ics.test.js – reine Unit-Tests für den iCalendar-Generator, ohne
 * DB/App (siehe utils/ics.js).
 */
import { escapeIcsText, foldLine, buildVevent, buildIcsFeed } from '../utils/ics.js';

describe('escapeIcsText', () => {
  it('escaped Backslash, Semikolon, Komma und Newline', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('lässt normalen Text unverändert', () => {
    expect(escapeIcsText('Kalender-Test-Gegner')).toBe('Kalender-Test-Gegner');
  });
});

describe('foldLine', () => {
  it('lässt kurze Zeilen unverändert', () => {
    expect(foldLine('SUMMARY:Kurz')).toBe('SUMMARY:Kurz');
  });

  it('bricht eine Zeile über 75 Zeichen um, Folgezeile beginnt mit einem Leerzeichen', () => {
    const longText = 'SUMMARY:' + 'A'.repeat(100);
    const folded = foldLine(longText);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBe(75);
    expect(lines[1].startsWith(' ')).toBe(true);
  });
});

describe('buildVevent', () => {
  it('baut DTSTART/DTEND korrekt (DTEND = Folgetag, exklusiv)', () => {
    const vevent = buildVevent({ uid: 'game-1@openfloorball', dateStr: '2026-08-09', summary: 'Test-Gegner' });
    expect(vevent).toContain('DTSTART;VALUE=DATE:20260809');
    expect(vevent).toContain('DTEND;VALUE=DATE:20260810');
    expect(vevent).toContain('UID:game-1@openfloorball');
    expect(vevent).toContain('SUMMARY:Test-Gegner');
    expect(vevent.startsWith('BEGIN:VEVENT')).toBe(true);
    expect(vevent.endsWith('END:VEVENT')).toBe(true);
  });

  it('behandelt einen Monatsübergang korrekt (31. -> 1. des Folgemonats)', () => {
    const vevent = buildVevent({ uid: 'game-2@openfloorball', dateStr: '2026-08-31', summary: 'Monatsende' });
    expect(vevent).toContain('DTSTART;VALUE=DATE:20260831');
    expect(vevent).toContain('DTEND;VALUE=DATE:20260901');
  });

  it('behandelt einen Jahresübergang korrekt (31.12. -> 1.1. des Folgejahres)', () => {
    const vevent = buildVevent({ uid: 'game-3@openfloorball', dateStr: '2026-12-31', summary: 'Jahresende' });
    expect(vevent).toContain('DTSTART;VALUE=DATE:20261231');
    expect(vevent).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('escaped Sonderzeichen im Summary-Feld', () => {
    const vevent = buildVevent({ uid: 'game-4@openfloorball', dateStr: '2026-08-09', summary: 'Team A, Team B; Halle' });
    expect(vevent).toContain('SUMMARY:Team A\\, Team B\\; Halle');
  });
});

describe('buildIcsFeed', () => {
  it('umschließt alle Events mit einer gültigen VCALENDAR-Hülle', () => {
    const feed = buildIcsFeed([
      { uid: 'game-1@openfloorball', dateStr: '2026-08-09', summary: 'Gegner A' },
      { uid: 'session-1@openfloorball', dateStr: '2026-08-10', summary: 'Training' },
    ]);
    expect(feed.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(feed.trim().endsWith('END:VCALENDAR')).toBe(true);
    expect(feed).toContain('VERSION:2.0');
    expect((feed.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((feed.match(/END:VEVENT/g) ?? []).length).toBe(2);
  });

  it('liefert eine gültige, leere Hülle ohne Events', () => {
    const feed = buildIcsFeed([]);
    expect(feed).toContain('BEGIN:VCALENDAR');
    expect(feed).toContain('END:VCALENDAR');
    expect(feed).not.toContain('BEGIN:VEVENT');
  });
});
