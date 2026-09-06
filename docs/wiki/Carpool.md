# 🚗 Fahrgemeinschaften (Carpool)

*🇩🇪 Deutsch | [🇬🇧 English](Carpool.en.md)*

Fahrten zu Spielen und Trainings im Team organisieren. Team-Mitglieder
können eine Fahrt anbieten (Treffpunkt als Freitext, freie Plätze,
optionale Notiz), andere Mitglieder tragen sich ein – direkt auf der
Spiel- oder Trainings-Detailseite, analog zu RSVP und Kommentaren.

## Öffentlicher Link

Zusätzlich gibt es einen **tokenbasierten öffentlichen Link**
(`/carpool/:token`), damit auch Personen **ohne eigenen Account**
(typischerweise Eltern im Nachwuchsbereich) mitfahren oder ihre
Zusage zurückziehen können.

- Der öffentliche Link ist der erste **anonyme Schreib-Zugriff** der
  Plattform
- Eigene, engere Rate-Limits schützen vor Missbrauch
- Datenbank-Transaktion mit Zeilensperre gegen Überbuchung unter
  Nebenläufigkeit

## Datenschutz

- **Kein** Adress- oder Telefonfeld
- Die öffentliche Ansicht gibt **nie** eine E-Mail-Adresse preis
- Datensparsamkeit: Nur nötige Daten (Treffpunkt, freie Plätze,
  optionale Notiz)

## Nutzung

1. Spiel oder Training öffnen → Bereich "Fahrgemeinschaft"
2. Fahrt anbieten: Treffpunkt (Freitext), freie Plätze, optionale
   Notiz eingeben
3. Öffentlichen Link teilen (z.B. für Eltern ohne Account): Button
   "Link kopieren" unterhalb der Liste
4. Andere Members/Personen tragen sich ein oder sagen ab

---

> Changelog-Referenz: Unreleased – Issue 028: Fahrgemeinschaften,
> siehe [CHANGELOG.md](../../CHANGELOG.md)
