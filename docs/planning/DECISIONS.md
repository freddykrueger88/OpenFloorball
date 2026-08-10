# DECISIONS.md

# OpenFloorball Coach Platform

## Architecture Decision Records

---

# Zweck

Dieses Dokument hält wichtige technische Entscheidungen fest.

Warum?

Weil zukünftige Entwickler verstehen müssen:

* was entschieden wurde
* warum es entschieden wurde
* welche Alternativen betrachtet wurden

---

# Format

Jede Entscheidung folgt diesem Muster:

---

# ADR-XXXX: Titel

## Datum

YYYY-MM-DD

---

## Status

Optionen:

* vorgeschlagen
* akzeptiert
* abgelehnt
* ersetzt

---

## Kontext

Welches Problem muss gelöst werden?

Welche Anforderungen bestehen?

---

## Entscheidung

Welche Lösung wurde gewählt?

---

## Alternativen

Welche anderen Lösungen wurden betrachtet?

---

## Begründung

Warum wurde diese Lösung gewählt?

---

## Konsequenzen

Welche Vorteile entstehen?

Welche Nachteile entstehen?

---

# Beispiel ADR-0001

## Titel

Local First Architektur

---

## Status

Akzeptiert

---

## Kontext

Trainer arbeiten häufig in Umgebungen mit schlechter Internetverbindung.

Die Plattform muss zuverlässig funktionieren.

---

## Entscheidung

Die Anwendung wird nach Local-First-Prinzipien entwickelt.

Lokale Datenhaltung ist Standard.

Cloud dient zur Synchronisation.

---

## Alternativen

### Cloud First

Vorteile:

* einfache zentrale Verwaltung

Nachteile:

* abhängig vom Internet
* weniger Datensouveränität

---

### Offline Export

Vorteile:

* einfach

Nachteile:

* keine echte Zusammenarbeit

---

## Begründung

Local First unterstützt:

* Datenschutz
* Geschwindigkeit
* Offline Nutzung
* Nutzerkontrolle

---

## Konsequenzen

Vorteile:

* bessere Nutzererfahrung
* weniger Abhängigkeit

Nachteile:

* komplexere Synchronisation

---

# Beispiel ADR-0002

## Titel

Offene Datenformate

---

## Status

Akzeptiert

---

## Entscheidung

Alle Kernobjekte werden in offenen Formaten gespeichert.

---

## Begründung

Die Nutzer besitzen ihre Daten.

Export und Migration müssen jederzeit möglich sein.

---

# Beispiel ADR-0003

## Titel

KI-Abstraktionsschicht

---

## Status

Akzeptiert

---

## Entscheidung

KI-Funktionen werden über eine austauschbare Schnittstelle integriert.

---

## Begründung

Keine Abhängigkeit von einem einzelnen Anbieter.

Unterstützung für:

* lokale Modelle
* Open Source
* verschiedene Anbieter

---

# Tatsächliche Entscheidungen

Die obigen ADR-0001 bis ADR-0003 sind Beispiele aus der ursprünglichen
Planung. Ab hier folgen echte, getroffene Entscheidungen.

---

# ADR-0001: Erweiterbares Event-Typ-System statt starres Enum

## Datum

2026-08-10

---

## Status

Akzeptiert

---

## Kontext

`game_events.event_type` ist ein starres `CHECK`-Constraint-Enum mit
genau 10 Werten, zusätzlich dreifach dupliziert (DB-Constraint,
Route-Validator, Frontend-Presets). Die geplante Statistik-/
Analytics-Architektur (siehe
`docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md`) braucht
langfristig deutlich mehr Ereignistypen (Schüsse mit Ergebnis,
Ballverluste/-gewinne, perspektivisch von Trainern selbst definierte
Custom-Events), ohne dass jeder neue Typ eine Schema-Migration
erfordert.

---

## Entscheidung

`event_type` bleibt ein Text-Feld, verweist aber per Fremdschlüssel
auf eine neue Tabelle `event_type_definitions` (Key, Kategorie,
Label DE/EN, Icon, Farbe, benötigte Zusatzfelder, `is_builtin`,
optionales `team_id` für vereinsspezifische Custom-Typen). Die 10
bestehenden Typen werden unverändert als `is_builtin = true`
übernommen. Neue Typen erfordern nur einen `INSERT`, keine Migration
mehr.

---

## Alternativen

### Enum unverändert lassen, neue Typen weiter per Migration ergänzen

Vorteile: keine Änderung nötig.

Nachteile: jeder neue Event-Typ (auch vereinsspezifische
Custom-Events, siehe Anforderung Abschnitt 7) erfordert eine
Migration – widerspricht dem Ziel, Trainern eigene Tagging-Vorlagen
zu ermöglichen (Recherche-Befund: genau dieses Muster – Sportscode
"Code Windows", Nacsport freie Buttons, LongoMatch-Dashboards – zieht
sich durch praktisch alle professionellen Systeme).

### Rein freies Textfeld ohne Definitionstabelle

Vorteile: maximal flexibel, keine neue Tabelle.

Nachteile: keine Validierung, keine Kategorisierung/Farben/Icons für
die UI, keine Unterscheidung "eingebaut, unlöschbar" vs. "vom Verein
selbst angelegt" – Statistik-Konsistenz (z.B. Torhüter-Statistiken,
die sich auf `event_type = 'shot'` verlassen) wäre nicht geschützt.

---

## Begründung

Die Definitionstabelle erhält die heutige Sicherheit (nur bekannte
Typen sind gültig, per FK statt CHECK erzwungen) und macht das System
gleichzeitig erweiterbar, ohne die zehn bestehenden, in Tests und
Frontend fest verankerten Typen anzufassen. Entspricht CLAUDE.md
§5.4 (Open Source First/keine unnötige Komplexität) und dem in der
Anforderung explizit geforderten Prinzip "Event System muss
erweiterbar sein, ohne massive Migrationen".

---

## Konsequenzen

Vorteile:

* Neue Ereignistypen (auch vereinsspezifische) ohne Migration.
* Bestehende Typen/Tests/Frontend-Presets bleiben unverändert
  funktionsfähig.
* Grundlage für spätere Custom-Tagging-Vorlagen (Roadmap Phase 7).

Nachteile:

* Eine zusätzliche Tabelle und ein zusätzlicher JOIN gegenüber einem
  reinen Constraint.
* Schutz der `is_builtin`-Zeilen (nicht löschbar/deaktivierbar durch
  Vereine) muss in der Anwendungslogik durchgesetzt werden, nicht nur
  in der DB.

---

# Regel

Architekturentscheidungen werden nicht vergessen.

Sie werden dokumentiert.
