# 🗺️ Roadmap

*🇩🇪 Deutsch | [🇬🇧 English](Roadmap.en.md)*

Die vollständige, langfristige Roadmap und der Backlog liegen im
Repository und werden dort kontinuierlich aktualisiert:

👉 **[docs/planning/ROADMAP.md](../planning/ROADMAP.md)** (Vision/Phasen)
👉 **[docs/planning/BACKLOG.md](../planning/BACKLOG.md)** (einzelne Issues)

## Bereits umgesetzt (ehemalige Backlog-Punkte)

- **Video-Integration** – Videoclips hochladen/abspielen pro Board,
  inkl. Zeichnen-Überlagerung, Trimmen, Szenen-Marken und Übernahme
  der Video-Zeichnung als neues Taktik-Board. Siehe
  [Video-Integration](./Video-Integration.md).
- **Live-Spielnotizen** ("Erweiterung: Live-Unterstützung") – Spiele
  anlegen und während des laufenden Spiels schnelle, zeitgestempelte
  Notizen erfassen. Siehe [Live-Spielnotizen](./Live-Spielnotizen.md).
- **Manueller Backup-Trigger** – "Jetzt ausführen"-Button im
  Admin-Bereich für einen sofortigen Backup-Lauf unabhängig vom
  Zeitplan. Siehe [Backup](./Backup.md).
- **Lines grundlegend überarbeitet** (fachlicher Umbau) – Lines waren
  bisher rein board-interne Hervorhebungs-Gruppen ohne Bezug zum
  Kader; jetzt echte taktische Kader-Spieler-Kombinationen (ein
  Spieler kann in beliebig vielen Lines stehen), schneller Wechsel
  direkt auf der Spielseite. Siehe [Lines](./Lines.md).
- **Echtzeit-Zusammenarbeit** – Präsenzanzeige und Live-Cursor beim
  gemeinsamen Bearbeiten eines Boards. Siehe
  [Echtzeit-Zusammenarbeit](./Echtzeit-Zusammenarbeit.md).
- **Onboarding-Tour** (Backlog-ISSUE 023) – kurze, überspringbare
  Einführungstour beim ersten Login.
- **Vertiefte Editor-Tour** (Backlog-ISSUE 024) – zweite, unabhängige
  Tour direkt im Board-Editor, erklärt die konkreten Werkzeuge
  (Spieler platzieren, Zeichnen, Szenen/Animation, automatisches
  Speichern, Export/Teilen). Jederzeit über das Hilfe-Symbol im
  Editor erneut aufrufbar.
- **Fahrgemeinschaften** (Backlog-ISSUE 028) – Fahrtangebote mit freier
  Platzzahl an Spiele/Trainings anhängen, Eintragen ohne Überbuchen,
  öffentliche Freigabeseite per `share_token`. Siehe ISSUE 030
  (Anbieter-Name). Offene Frage (Eltern ohne eigenen Account) bewusst
  zurückgestellt, bis mit Vereinen geklärt.
- **Statistik- und Performance-Analytics** (EPIC 012) – Phasen 1–9
  vollständig umgesetzt (Events-Modell, Line-Tracking, Shot Tracking,
  Special Teams, Trainings-Analytics, Video↔Event, Assists/CSV-Export,
  Line-Chemie, KI-Insights) inkl. Gegner-Entität
  ([Statistik-Architektur](../planning/STATISTICS_ANALYTICS_ARCHITECTURE.md)).
  xG/Shot Quality bewusst zurückgestellt (keine reale Datenbasis),
  ebenso die Saison-/Wettbewerbs-Gruppierung von Spielen.

## Offene Backlog-Highlights (Auszug)

**Feature-Ideen:**
- Europaweite Sprachunterstützung (Backlog-ISSUE 027) – Phasen 1 und 2
  sind als KI-Rohentwürfe komplett: Schwedisch (`sv`), Finnisch
  (`fi`), Tschechisch (`cs`), Slowakisch (`sk`), Norwegisch Bokmål
  (`nb`), Lettisch (`lv`), Polnisch (`pl`) und Französisch (`fr`) sind
  in der Oberfläche wählbar (Markierung `needs-native-review`);
  Phase 3 (`da`/`et`/`nl`/`it`) bei Bedarf. Jede Übersetzung braucht
  muttersprachliches Review vor offiziellem Abschluss des Issues.
- Saison-/Wettbewerbs-Gruppierung von Spielen (aus EPIC 012 bewusst
  ausgenommen) – eigenständiges, größeres Thema.
- Native App-Store-Präsenz (Google Play + Apple App Store) – App ist
  schon eine installierbare PWA (vite-plugin-pwa), naheliegender Weg
  wäre ein Wrapper wie Capacitor/Trusted Web Activity statt einer
  komplett separaten Codebasis.

**Technisch:**
- ESLint 10 im Frontend (Stand 2026-09-05 erneut geprüft, weiterhin
  blockiert: `eslint-plugin-react@7.37.5` deklariert als Peer maximal
  `eslint@^9.7`)
- Formale WCAG 2.1 AA / BITV 2.0 / EN 301 549 Zertifizierung durch Dritte

Alle abgeschlossenen und geplanten Meilensteine mit Details: siehe
verlinktes `ROADMAP.md`.
