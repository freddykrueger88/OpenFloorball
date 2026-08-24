# 📋 Trainingsplaner

*🇩🇪 Deutsch | [🇬🇧 English](Trainingsplaner.en.md)*

Ein Trainingsplan ("Training Session") reiht mehrere bestehende Boards
zu einer Übungssequenz mit Dauer aneinander – z. B. Aufwärmen (Board A,
10 Min.) → Passübung (Board B, 15 Min.) → Abschlussspiel (Board C, 20
Min.).

## Trainingsplan erstellen

Unter `/trainings`:

1. Neuen Trainingsplan mit Namen anlegen
2. Bestehende Boards als Übungen hinzufügen, jeweils mit:
   - **Dauer** in Minuten (Standard 15)
   - Optionaler **Notiz** (z. B. Fokus der Übung)
3. Reihenfolge per Drag & Drop anpassen

Die Gesamtdauer des Trainings wird automatisch aus der Summe der
Übungsdauern berechnet.

## Wichtig: keine Kopie

Ein Trainingsplan **referenziert** bestehende Boards, statt sie zu
kopieren. Änderungen an einem Board wirken sich also auch auf jeden
Trainingsplan aus, der dieses Board enthält. Wird ein Board gelöscht,
verschwindet die entsprechende Übung auch aus allen Trainingsplänen.

## Serientermine

Sobald eine Trainingseinheit ein Datum hat, erscheint darunter der
Button "Serie erstellen". Damit lassen sich Folgetermine anlegen –
täglich, wöchentlich oder alle 2 Wochen, bis zu einem gewählten
Enddatum (maximal 52 neue Termine pro Durchlauf).

Jeder erzeugte Termin ist danach ein ganz normaler, eigenständiger
Trainingsplan (Name, Ziel und Notiz werden vom Ausgangstermin
übernommen) – es gibt **keine** fortlaufende Verknüpfung zur Serie.
Das heißt:

- Ein einzelner Termin lässt sich jederzeit verschieben, umbenennen
  oder löschen, ohne die anderen zu beeinflussen (z. B. wenn ein
  Training an einem Feiertag ausfällt).
- Übungen (Board-Referenzen) werden **nicht** mitkopiert – die Serie
  legt nur das Datums-Grundgerüst an, jede Einheit wird inhaltlich
  einzeln geplant.
- Das Gesamt-Kontingent an Trainingseinheiten pro Nutzer liegt bei
  200 (auch für Serien).

## Zusage vor dem Termin (RSVP)

Bei einer team-geteilten Trainingseinheit erscheint über den
Kommentaren ein "Anwesenheit"-Bereich – identisch zum RSVP-Bereich auf
der [Spielseite](./Live-Spielnotizen.md#anwesenheit-rsvp): jedes
Team-Mitglied sieht die volle Team-Liste und antwortet für sich selbst
mit Zusage/Absage/Unsicher, optional mit Absagegrund.

## Tatsächliche Anwesenheit

Unabhängig von der RSVP-Zusage (die nur eine Selbstauskunft VOR dem
Termin ist) kann der Coach direkt auf der Trainingsseite für jeden
Kader-Spieler festhalten, wer tatsächlich da war: **Anwesend**,
**Entschuldigt**, **Unentschuldigt** oder **Verletzt**. Ein Klick auf
den jeweiligen Status setzt ihn, ein weiterer Klick auf das
Zurücksetzen-Symbol macht ihn wieder rückgängig ("nicht erfasst").

Diese Anwesenheit fließt in die [Spieler-Statistiken](./Statistiken.md)
ein (Beteiligungsquote, Last-5/Last-10/Saison-Trend) – die RSVP-Zusage
selbst wird dort nicht ausgewertet, da sie nur eine Absicht, keine
belegte Anwesenheit ist.

## Verwandt

- [Erste Schritte](./Erste-Schritte.md)
- [Export & Teilen](./Export.md) – einzelne Boards als PDF/GIF exportieren
- [Live-Spielnotizen](./Live-Spielnotizen.md) – gleiches Anwesenheits-Konzept für Spiele
