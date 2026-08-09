# BACKLOG.md

# OpenFloorball Coach Platform

## Entwicklungs-Backlog

---

# Arbeitsprinzip

Jede Aufgabe wird nach folgenden Kriterien bewertet:

Priorität:

* P0 = unverzichtbar für MVP
* P1 = wichtig nach MVP
* P2 = spätere Erweiterung
* P3 = Zukunftsidee

Jede Aufgabe benötigt:

* klare Beschreibung
* technische Überlegungen
* Akzeptanzkriterien

---

# EPIC 001 – Projektfundament

## Ziel

Eine stabile Entwicklungsgrundlage schaffen.

Priorität:

P0

---

# ISSUE 001

## Repository erstellen

### Beschreibung

Einrichtung der Projektstruktur.

---

## Aufgaben

Erstellen:

* Repository
* README
* CLAUDE.md
* Dokumentationsstruktur
* Lizenzdatei

---

## Akzeptanzkriterien

* Projekt kann lokal gestartet werden
* Dokumentation vorhanden
* Entwicklungsregeln definiert

---

# ISSUE 002

## Entwicklungsumgebung

### Aufgaben

Einrichten:

* TypeScript
* Linter
* Formatter
* Testing Framework
* Build System

---

## Akzeptanzkriterien

Ein Entwickler kann das Projekt nach Anleitung starten.

---

# ISSUE 003

## Designsystem Grundstruktur

### Aufgaben

Erstellen:

* Farben
* Typografie
* Buttons
* Dialoge
* Grundkomponenten

---

## Anforderungen

Design muss unterstützen:

* Desktop
* Tablet
* Touch

---

# EPIC 002 – Floorball Field Engine

## Ziel

Das digitale Spielfeld.

Priorität:

P0

---

# ISSUE 004

## Floorballfeld rendern

### Beschreibung

Darstellung eines offiziellen Floorballfeldes.

---

## Anforderungen

Unterstützen:

* Linien
* Tore
* Zonen
* Mittellinie

---

## Akzeptanzkriterien

Das Feld wird korrekt dargestellt.

---

# ISSUE 005

## Spielfeldinteraktion

### Aufgaben

Unterstützen:

* Zoom
* Verschieben
* Touch-Gesten

---

## Akzeptanzkriterien

Nutzung auf Tablet möglich.

---

# EPIC 003 – Spieler-System

## Ziel

Spielerobjekte verwalten.

Priorität:

P0

---

# ISSUE 006

## Spielerobjekt erstellen

### Eigenschaften

* Position
* Farbe
* Nummer
* Name
* Teamzugehörigkeit

---

# ISSUE 007

## Spieler bewegen

Unterstützung:

* Drag & Drop
* Snap Funktionen optional

---

# ISSUE 008

## Spielergruppen

Unterstützung:

* eigene Mannschaft
* Gegner
* Torhüter

---

# EPIC 004 – Taktikobjekte

## Ziel

Trainer können Situationen zeichnen.

Priorität:

P0

---

# ISSUE 009

## Laufwege

Unterstützen:

* Linie
* Richtung
* Farbe
* Geschwindigkeit

---

# ISSUE 010

## Passwege

Unterstützen:

* Start
* Ziel
* Ballbewegung

---

# ISSUE 011

## Schüsse

Unterstützen:

* Richtung
* Ziel
* Markierung

---

# ISSUE 012

## Zonen und Markierungen

Unterstützen:

* Rechtecke
* Kreise
* Freihand
* Text

---

# EPIC 005 – Szenen und Animation

## Ziel

Taktische Abläufe erklären.

Priorität:

P0

---

# ISSUE 013

## Szenensystem

Eine Taktik besteht aus mehreren Szenen.

---

## Beispiel

```text
Szene 1:
Aufstellung

Szene 2:
Bewegung

Szene 3:
Abschluss
```

---

# ISSUE 014

## Timeline

Minimal:

* Start
* Pause
* Ende

---

# ISSUE 015

## Animationssteuerung

Unterstützen:

* Wiederholung
* Geschwindigkeit

---

# EPIC 006 – Speicherung

## Ziel

Taktiken dauerhaft speichern.

Priorität:

P0

---

# ISSUE 016

## Datenmodell implementieren

Objekte:

* Tactic
* Scene
* Player
* Movement

---

# ISSUE 017

## Lokale Speicherung

Unterstützung:

* Browser Storage
* IndexedDB

---

# ISSUE 018

## Export und Import

Formate:

* JSON
* PNG
* PDF

---

# EPIC 007 – UX Qualität

Priorität:

P0

---

# ISSUE 019

## Trainerfreundliche Oberfläche

Prüfen:

* wenige Klicks
* klare Navigation
* verständliche Begriffe

---

# ISSUE 020

## Accessibility

Prüfen:

* Tastatur
* Kontrast
* Screenreader
* Touch

---

# EPIC 008 – Qualität

Priorität:

P0

---

# ISSUE 021

## Tests

Erstellen:

* Unit Tests
* Integration Tests
* UI Tests

---

# ISSUE 022

## Performance

Prüfen:

* Rendering
* Speicher
* Animation
* mobile Geräte

---

# ISSUE 023

## Onboarding-Tour für neue Nutzer

### Beschreibung

Ein neuer Nutzer soll ohne Schulung schnell verstehen, wie die
wichtigsten Bereiche der Plattform funktionieren (Taktikboard
anlegen, Trainingsplanung, Übungsbibliothek, KI-Assistenten) –
passend zu CLAUDE.md Kapitel 15 "Einfach starten".

### Aufgaben

* Kurze, jederzeit überspringbare Schritt-für-Schritt-Tour beim
  ersten Login (Hinweis-Overlay auf zentrale UI-Elemente: Neues
  Board erstellen, Trainingsplanung, Übungsbibliothek,
  Einstellungen).
* Erneuter Aufruf der Tour über die Einstellungen möglich – kein
  einmaliges Erlebnis, das man verpasst hat.
* Speicherung eines minimalen "Tour gesehen"-Status pro Nutzer
  (Datensparsamkeit, CLAUDE.md 5.1 – keine neue Tabelle nötig).

### Technische Überlegungen

* Kein externes Tour-Framework mit Telemetrie/Cloud-Abhängigkeit
  (Open Source First) – eigene, leichte Overlay-Komponente oder eine
  kleine, selbst gehostete Open-Source-Bibliothek ohne Tracking.
* Muss mit dem bestehenden i18n-System (de/en) funktionieren.
* Kein Pflichtschritt, der die Nutzung blockiert (keine Dark
  Patterns, CLAUDE.md 5.11).

### Akzeptanzkriterien

* Ein neu registrierter Nutzer sieht beim ersten Login automatisch
  die Tour.
* Die Tour lässt sich jederzeit überspringen/abbrechen.
* Ein bestehender Nutzer kann die Tour über die Einstellungen erneut
  starten.
* Tour ist per Tastatur bedienbar und mit Screenreader nutzbar
  (Accessibility First, CLAUDE.md 16).

Priorität:

P1

---

# ISSUE 024

## Vertiefte Editor-Tour: Spielfeld-Erstellung erklären

### Beschreibung

Feedback nach dem ersten Live-Einsatz von ISSUE 023: die Einführungs-
tour zeigt bisher nur, WO die wichtigsten Bereiche liegen (Nav-Links),
erklärt aber nicht, WIE man z.B. ein Taktikboard tatsächlich anlegt
und benutzt ("wie erstelle ich das, was ist wofür"). Sinnvolle
Erweiterung: eine zweite, tiefere Tour-Ebene direkt im Board-Editor,
die die konkreten Werkzeuge erklärt statt nur die Navigation.

### Aufgaben

* Eigene, optionale Editor-Tour (getrennt von der Nav-Tour aus
  ISSUE 023), die beim ersten Öffnen eines neu erstellten Boards
  startet – erklärt z.B.: Spieler platzieren/verschieben, Laufwege/
  Passwege zeichnen, Szenen anlegen und wechseln, Abspielen/Animation,
  Speichern, Teilen.
* Gleiches Muster wie ISSUE 023 wiederverwenden (Spotlight auf
  Werkzeugleiste/Editor-Elemente, jederzeit überspringbar, Fokus-
  Falle, Screenreader-Ankündigungen) – kein zweites Tour-Framework,
  dieselbe `tourStore.js`/`TourOverlay.jsx`-Grundlage erweitern statt
  parallel etwas Neues zu bauen.
* Erneuter Aufruf ebenfalls über die Einstellungen (oder direkt aus
  dem Editor über ein Hilfe-Icon) möglich.
* Eigener "gesehen"-Status getrennt von der Nav-Tour (z.B.
  `editorTourCompleted` neben `tourCompleted` in `preferences_json`).

### Technische Überlegungen

* Editor-Werkzeuge sind komplexer als Nav-Links (Canvas-Elemente statt
  einfacher DOM-Buttons) – Zielelemente brauchen ggf. eigene
  `data-tour`-Attribute auf der Werkzeugleiste statt auf Canvas-
  Objekten selbst.
* Reihenfolge/Inhalt der Schritte sollte sich eng an CLAUDE.md Kapitel
  10 (Virtuelles Taktikboard) orientieren (Drag & Drop, Layer-System,
  Animation Engine, Vorlagen).

### Akzeptanzkriterien

* Ein Nutzer, der zum ersten Mal ein Board öffnet, bekommt optional
  eine kurze Erklärung der wichtigsten Editor-Werkzeuge.
* Jederzeit überspringbar, erneut aufrufbar, tastatur- und
  screenreader-bedienbar (wie ISSUE 023).
* Nav-Tour (ISSUE 023) und Editor-Tour sind unabhängig voneinander
  – Überspringen/Abschließen der einen beeinflusst die andere nicht.

Priorität:

P2

---

# EPIC 009 – Nach MVP

Priorität:

P1

---

## Teamfunktionen

* Accounts
* Teams
* Rollen
* Teilen

---

## Trainingsplanung

* Übungen
* Einheiten
* Kalender

---

## Synchronisation

* Offline Sync
* Cloud Sync
* Konfliktlösung

---

# EPIC 010 – Zukunft

Priorität:

P2/P3

---

## Videoanalyse

* Clips
* Markierungen
* Taktiklayer

---

## KI-Assistent

* Trainingsvorschläge
* Taktikvarianten
* Analysehilfe

---

## Community

* Bibliotheken
* Vorlagen
* Austausch

---

# EPIC 011 – Vereinsebene als Koordinationsschicht

Priorität:

P3

---

## Ausgangslage

Organizations (Vereine) sind bisher rein verwaltend: mehrere Teams
einem Verein zuordnen, Admin/Member-Rollen, aber kein geteilter Inhalt
über Teams hinweg. Diskussion (2026-08-09): Trainer-Alltag bleibt der
Kern der Plattform, aber ein Verein mit mehreren Sparten (z.B. 1.
Herren, U15, U18) braucht zusätzlich eine dünne
Koordinationsschicht **über** den einzelnen Teams, ohne sich Richtung
generisches Vereinsverwaltungs-Tool zu entwickeln (Finanzen,
Mitgliederverwaltung, Registrierung bleiben bewusst außerhalb, siehe
Roadmap-Audit "Phase Z" für die dort schon geprüften, nicht
empfohlenen Punkte).

---

## Mögliche Bausteine

* Vereins-Dashboard: Termine/Spiele aller Teams eines Vereins
  gebündelt (nur Lesen, kein neuer Bearbeitungsweg)
* Vereinsweit geteilte Übungsbibliothek/Playbooks – optional zusätzlich
  zu `teamId`, analog zum bestehenden Muster
* Org-Admin sieht Team-übergreifend, wer wo Trainer ist (Übersicht,
  kein automatisches Bearbeitungsrecht an Team-Inhalten)

---

## Abgrenzung (bewusst NICHT Teil dieses Epics)

* Finanzen/Mitgliedsbeiträge/Rechnungen
* Mitgliederregistrierung/Formulare/Waiver
* Turniere/Ligen zwischen mehreren Vereinen

---

# Entscheidungsregel

Bei jedem neuen Issue prüfen:

1. Unterstützt es Trainer?
2. Passt es zur Architektur?
3. Ist Datenschutz gewährleistet?
4. Ist es die einfachste Lösung?
5. Kann es modular umgesetzt werden?

---

# Ende Backlog

OpenFloorball Coach wird Schritt für Schritt aufgebaut.

Qualität vor Geschwindigkeit.

Nachhaltigkeit vor kurzfristigen Features.
