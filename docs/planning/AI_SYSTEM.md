# AI_SYSTEM.md

# OpenFloorball Coach Platform

## KI-Systemkonzept und Richtlinien

---

# 1. Zweck

KI unterstützt Trainer bei:

* Planung
* Organisation
* Analyse
* Wissensmanagement
* Ideenentwicklung

KI ersetzt keine Trainerentscheidung.

Der Trainer bleibt verantwortlich.

---

# 2. KI-Leitprinzipien

## Transparenz

Der Nutzer muss erkennen:

* wann KI verwendet wird
* welche Daten genutzt werden
* wie Ergebnisse entstehen

---

## Kontrolle

KI schlägt vor.

Der Mensch entscheidet.

---

## Datenschutz

Standard:

So wenig Daten wie möglich.

Keine personenbezogenen Daten an externe Systeme ohne klare Zustimmung.

---

## Offenheit

Bevorzugt:

* Open Source Modelle
* lokale Verarbeitung
* austauschbare Anbieter

---

# 3. KI-Architektur

Die Anwendung verwendet eine Abstraktionsschicht.

Nicht:

```text id="0d8l6c"
App

↓

KI-Anbieter
```

Sondern:

```text id="7kq3tq"
OpenFloorball

↓

AI Interface

↓

Model Adapter

↓

--------------------------------

Lokales Modell

Cloud Modell

Spezialmodell

```

---

# 4. AI Interface

Alle KI-Funktionen laufen über eine einheitliche Schnittstelle.

Beispiel:

```typescript id="v3s5sf"
interface AIProvider {

 analyze(input): Result;

 generate(input): Result;

 explain(input): Result;

}
```

---

# 5. KI-Bereiche

---

# 5.1 Trainingsassistent

Ziel:

Trainer bei der Planung unterstützen.

---

Eingaben:

* Altersgruppe
* Trainingsziel
* Zeit
* Spieleranzahl
* Schwerpunkt

---

Ausgabe:

* Trainingsstruktur
* Übungsideen
* Variationen
* Coachingpunkte

---

Die KI erstellt keine endgültige Trainingseinheit ohne Kontrolle.

---

# 5.2 Taktikassistent

Ziel:

Taktisches Denken unterstützen.

---

Beispiele:

"Wie können wir unser Forechecking variieren?"

"Welche Optionen gibt es im Powerplay?"

---

Ausgabe:

* Varianten
* Vor- und Nachteile
* mögliche Anpassungen

---

# 5.3 Analyseassistent

Ziel:

Beobachtungen strukturieren.

---

Möglichkeiten:

* Spielsituationen zusammenfassen
* Muster erkennen
* Fragen erzeugen

---

Nicht erlaubt:

Automatische Bewertung einzelner Spieler ohne Kontext.

---

# 5.4 Wissensassistent

Ziel:

Vereinswissen zugänglich machen.

Beispiele:

"Welche Powerplay-Varianten haben wir gespeichert?"

"Welche Übungen nutzen wir für Ballbesitz?"

---

# 5.5 Spiel-Insights-Assistent

> Ergänzt 2026-08-22 (Statistik-Architektur Phase 9, EPIC 012 – siehe
> `docs/planning/BACKLOG.md`). Nutzt dieselbe KI-Provider-Abstraktion
> wie 5.1–5.4, keine eigene Anbindung.

Ziel:

Muster in bereits erfassten Spielstatistiken erkennen ("Pattern
Detection"), ausschließlich als nachvollziehbare Vorschläge (§18).

Eingabe:

Bereits berechnete Team-Aggregate eines einzelnen Spiels
(`statisticsEngine.js`: Schuss-Statistiken inkl. Zonen, Special
Teams, Situations-Splits) – explizit KEINE Rohereignisse, KEINE
Spieler-Namen/-Rückennummern, KEINE Roh-Freitexteingabe des Trainers.
Der exakte, an die KI gesendete Textblock ist im Frontend über
"Grundlage anzeigen" einsehbar (Explainable AI, §2/18.3).

Beispiele:

"Auffällig ist eine hohe Schusszahl aus der Distanzzone bei
gleichzeitig niedriger Schuss-%."

"Das Penalty Kill lag deutlich unter dem Powerplay-Wert."

Nicht erlaubt:

Bewertung, Ranking oder Leistungsprognose einzelner Spieler – die
Eingabe enthält dafür ohnehin keine Personendaten, die Prompt-Vorlage
(`prompts/insights.md`) schreibt es zusätzlich explizit vor.

---

# 6. Floorball-Wissensbasis

KI benötigt eine fachliche Grundlage.

Diese besteht aus:

* Floorball-Begriffen
* Spielprinzipien
* Trainingsmethodik
* taktischen Konzepten

---

Quellen:

* offene Inhalte
* vom Verein erstelltes Wissen
* eigene Dokumente

---

# 7. Retrieval Augmented Generation (RAG)

Empfohlen:

KI greift auf relevante eigene Inhalte zu.

Beispiel:

Trainer fragt:

"Wie trainieren wir unser Umschaltverhalten?"

System:

1. sucht passende Vereinsinhalte
2. gibt Kontext an KI
3. erstellt Antwort

---

Vorteile:

* weniger Halluzinationen
* Vereinswissen bleibt zentral
* bessere Antworten

---

# 8. Datenschutz bei KI

Vor jeder KI-Anfrage prüfen:

Welche Daten werden benötigt?

---

Beispiel:

Nicht senden:

"Max Müller, 15 Jahre, verletzt, spielt schlecht."

Besser:

"U15-Team benötigt Verbesserung im Umschaltspiel."

---

# 9. Personenbezogene KI-Daten

Besondere Vorsicht bei:

* Minderjährigen
* Leistungsdaten
* Gesundheit
* Bewertungen

---

Grundregel:

Keine automatisierte Persönlichkeits- oder Leistungsbewertung.

---

# 10. Lokale KI

Langfristiges Ziel:

KI lokal betreiben können.

Vorteile:

* Datenschutz
* Kontrolle
* Unabhängigkeit

---

Mögliche Einsatzbereiche:

* Vereinsserver
* Trainer-PC
* private Infrastruktur

---

# 11. Externe KI-Anbieter

Falls externe Modelle genutzt werden:

Anforderungen:

* transparente Verarbeitung
* klare Verträge
* EU-Datenschutzprüfung
* minimale Datenübertragung

---

# 12. KI-Ausgaben

Jede Ausgabe sollte enthalten:

* Ergebnis
* mögliche Unsicherheiten
* Kontext

---

Beispiel:

Nicht:

"Diese Taktik ist falsch."

Besser:

"Eine mögliche Schwäche dieser Variante könnte sein..."

---

# 13. Prompt-Architektur

Prompts werden nicht verstreut im Code gespeichert.

Zentral:

```text id="rjv7yy"
AI/

prompts/

training.md

tactics.md

analysis.md

knowledge.md
```

---

# 14. KI-Versionierung

Änderungen dokumentieren:

* Modell
* Prompt-Version
* Datenbasis

---

# 15. KI-Tests

KI-Funktionen benötigen Tests.

Prüfen:

* Fachlichkeit
* Datenschutz
* Stabilität
* Verständlichkeit

---

# 16. KI-Fehlerbehandlung

KI kann falsch liegen.

Die Anwendung muss damit umgehen.

Regeln:

* Ergebnisse überprüfbar machen
* keine automatischen Entscheidungen
* Alternativen anzeigen

---

# 17. KI und Open Source

Bevorzugte Strategie:

Die Plattform bleibt unabhängig von einzelnen KI-Anbietern.

---

Unterstützung:

* Open Source Modelle
* eigene Wissensdatenbanken
* austauschbare Adapter

---

# 18. KI-Rollenmodell

Nicht jede Rolle darf jede KI-Funktion nutzen.

Beispiele:

Trainer:

* Planung
* Taktik

Spieler:

* eigene Lerninhalte

Administrator:

* Verwaltung

---

# 19. Zukunftsmöglichkeiten

Später möglich:

* Sprachsteuerung
* Trainingsassistent im Auto
* Live-Coaching-Unterstützung
* automatische Szenenerkennung
* taktische Simulationen

---

# 20. Leitgedanke

Die beste KI ist nicht die, die am meisten entscheidet.

Die beste KI ist die, die Trainern hilft, bessere Entscheidungen zu treffen.
