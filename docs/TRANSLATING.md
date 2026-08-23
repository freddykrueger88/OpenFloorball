# TRANSLATING.md

*[🇬🇧 Read this in English](TRANSLATING.en.md)*

# OpenFloorball übersetzen

Danke, dass du OpenFloorball in deine Sprache bringen willst. Floorball
ist außerhalb des deutschsprachigen Raums in einigen Ländern viel
stärker verwurzelt als hierzulande – Trainer dort sollen die Plattform
in ihrer eigenen Sprache nutzen können.

Diese Anleitung ist bewusst so gehalten, dass du **kein** Konto bei
einem externen Übersetzungsdienst brauchst und **kein** Build-Setup
verstehen musst, um einen ersten Entwurf beizusteuern. Alles, was du
brauchst, ist ein Texteditor, Node.js und einen Terminal-Befehl.

---

## 1. Welche Sprache?

Schau zuerst in [BACKLOG.md, ISSUE 027](planning/BACKLOG.md) nach der
aktuellen Prioritätsliste – sie orientiert sich an tatsächlicher
Floorball-Aktivität (IFF-Mitgliedsverbände, Ligastärke), nicht an
Sprecherzahl. Aktuell fehlen z. B. noch Finnisch, Tschechisch und
Slowakisch; Schwedisch existiert bereits als erster – von einer KI
erstellter, **noch nicht muttersprachlich geprüfter** – Entwurf
(`frontend/src/i18n/locales/sv.json`), der Korrektur statt Neuerstellung
braucht.

Willst du eine Sprache übersetzen, die noch niemand begonnen hat?
Kommentiere kurz im verlinkten Sammel-Issue auf GitHub, welche Sprache
du übernimmst, damit sich niemand doppelt Arbeit macht.

---

## 2. Wo liegen die Texte?

Alle UI-Texte liegen als JSON in `frontend/src/i18n/locales/`, eine
Datei pro Sprache (`de.json`, `en.json`, `sv.json`, …). Jede Datei hat
exakt dieselbe Struktur – nur die Werte (rechts vom `:`) unterscheiden
sich, niemals die Schlüssel (links vom `:`).

```json
"resetPosition": "Reset position"
```

wird zu

```json
"resetPosition": "Återställ position"
```

---

## 3. Neue Sprache anlegen

1. Kopiere `frontend/src/i18n/locales/en.json` zu
   `frontend/src/i18n/locales/<code>.json` (`<code>` = zweistelliger
   ISO-639-1-Code, z. B. `fi` für Finnisch, `cs` für Tschechisch, `sk`
   für Slowakisch).
2. Übersetze nach und nach die Werte. Dabei unbedingt unverändert
   lassen:
   * die Schlüssel selbst (`"resetPosition"`)
   * Platzhalter wie `{{name}}` oder `{{count}}` – sie werden zur
     Laufzeit durch echte Werte ersetzt
   * Schlüssel-Suffixe wie `_one` / `_other` (Pluralformen; manche
     Sprachen brauchen zusätzlich `_few`/`_many`/`_zero` – siehe
     [i18next-Pluralisierung](https://www.i18next.com/translation-function/plurals),
     dann bitte im Sammel-Issue kurz erwähnen, falls das für deine
     Sprache nötig ist)
3. In `frontend/src/i18n/locales/locales.test.js` deine Sprache in das
   `LOCALES`-Objekt eintragen (Import + Eintrag, zwei Zeilen).
4. In `frontend/src/i18n/i18n.js` deine Sprache zu `resources` und
   `supportedLngs` hinzufügen.
5. In `frontend/src/components/settings/PreferencesSection.jsx` eine
   `<option>`-Zeile für deine Sprache in der Sprachauswahl ergänzen,
   plus den Schlüssel `settings.language<Code>` in **allen**
   Sprachdateien (auch in `de.json` und `en.json` – dort auf Deutsch/
   Englisch, z. B. `"languageFi": "Finnisch"` bzw. `"Finnish"`).

---

## 4. Bestehende Sprache verbessern

Einfacher: Öffne einfach die passende Datei
(`frontend/src/i18n/locales/<code>.json`) und ändere die betroffenen
Werte. Kein weiterer Schritt nötig.

---

## 5. Automatische Prüfung – dein wichtigstes Werkzeug

Im `frontend`-Verzeichnis:

```bash
npm test -- locales.test.js
```

Das prüft automatisch:

* **Vollständigkeit** – fehlt in deiner Datei ein Schlüssel, der in
  `en.json` existiert (oder ist einer zu viel), wird er dir namentlich
  aufgelistet.
* **Keine leeren Werte** – ein `""` fällt sofort auf.

Du musst dafür nichts weiter einrichten – kein externes Tool, kein
Account. Einfach übersetzen, Befehl laufen lassen, Lücken schließen,
wiederholen, bis der Test grün ist.

---

## 6. Floorball-Fachbegriffe

Übersetze Fachbegriffe so, wie sie Trainer in deiner Sprache
tatsächlich benutzen, nicht wörtlich. Beispiele aus dem Deutschen/
Englischen mit Kontext:

| Begriff (DE/EN) | Bedeutung |
|---|---|
| Wechselblock / line | Fest zusammenspielende Spielergruppe, die gemeinsam wechselt |
| Powerplay | Zahlenmäßige Überlegenheit nach Zeitstrafe des Gegners |
| Boxplay / penalty kill | Zahlenmäßige Unterlegenheit während eigener Zeitstrafe |
| Forechecking | Aktives Anlaufen/Pressing in der gegnerischen Zone |
| Center / Verteidiger / Stürmer | Feldspieler-Positionen im 2-1-2-System |

Im Zweifel: so übersetzen, wie es in der Liga-Berichterstattung deines
Landes üblich ist (viele Länder übernehmen z. B. "Powerplay" und
"Boxplay" unverändert als Lehnwörter aus dem Eishockey – dann einfach
so lassen).

---

## 7. Pull Request

* Kleine, fokussierte PRs bevorzugt – eine neue Sprache oder eine
  Korrektur, nicht beides mit einer unabhängigen Code-Änderung
  vermischt (siehe [CONTRIBUTING.md](../CONTRIBUTING.md)).
* Erwähne im PR, ob du **Muttersprachler:in** bist und einen
  Floorball-Bezug hast (Spieler:in, Trainer:in, Vereinsmitglied). Das
  hilft beim Review mehr als jede Sprachprüfung.
* Ein von einer KI erstellter Rohentwurf ist als **Ausgangspunkt**
  willkommen (siehe `sv.json`), sollte aber im PR klar als
  ungeprüfter Entwurf gekennzeichnet sein und braucht vor dem Merge
  mindestens eine muttersprachliche Prüfung – falsche
  Floorball-Terminologie schadet mehr, als eine fehlende Sprache es
  tut.

Danke für deinen Beitrag!
