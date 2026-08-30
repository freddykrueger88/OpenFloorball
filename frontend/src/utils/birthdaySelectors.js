/**
 * birthdaySelectors – reine, testbare Funktionen rund um Geburtstage
 * (Dashboard-Widget + Kalender-Kategorie). Geburtsdatum kommt als
 * "YYYY-MM-DD"-String (Postgres DATE via pg → ISO-String) aus
 * GET /api/teams/birthdays.
 *
 * 29. Februar: die nächste Wiederkehr in einem Nicht-Schaltjahr wird auf
 * den 28. Februar gelegt (verbreitete, einfache Konvention) – betrifft
 * nur den Countdown im Dashboard, nicht die Kalender-Kategorie (dort
 * erscheint der 29.02. ehrlich nur in Schaltjahren, wird nicht verschoben).
 */

function parseBirthday(birthday) {
  const [year, month, day] = birthday.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Nächstes Auftreten (heute oder in der Zukunft) als lokales Date-Objekt. */
export function getNextOccurrence(birthday, today = new Date()) {
  const { year: birthYear, month, day } = parseBirthday(birthday);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
    const effectiveDay = (month === 2 && day === 29 && !isLeapYear(year)) ? 28 : day;
    const candidate = new Date(year, month - 1, effectiveDay);
    if (candidate >= todayStart) return { date: candidate, age: year - birthYear };
  }
  // Unerreichbar (Schleife deckt beide Fälle ab), nur zur Typsicherheit.
  return { date: todayStart, age: today.getFullYear() - birthYear };
}

/**
 * Sortierte Liste aller Team-Geburtstage mit Countdown-Infos, aufsteigend
 * nach Tagen bis zur nächsten Wiederkehr (0 = heute).
 */
export function selectUpcomingBirthdays(birthdays, today = new Date()) {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return birthdays
    .map((b) => {
      const { date, age } = getNextOccurrence(b.birthday, today);
      const daysUntil = Math.round((date - todayStart) / (24 * 60 * 60 * 1000));
      return { ...b, nextOccurrence: date, turningAge: age, daysUntil, isToday: daysUntil === 0 };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Tage-des-Monats, an denen dieser Geburtstag im gegebenen Jahr/Monat fällt (0 oder 1 Eintrag). */
export function getMonthOccurrences(birthday, year, month) {
  const { month: bMonth, day } = parseBirthday(birthday);
  if (bMonth !== month + 1) return [];
  if (bMonth === 2 && day === 29 && !isLeapYear(year)) return [];
  return [day];
}
