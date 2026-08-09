# 🗺️ Roadmap

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

## Offene Backlog-Highlights (Auszug)

**Feature-Ideen:**
- Native App-Store-Präsenz (Google Play + Apple App Store) – App ist
  schon eine installierbare PWA (vite-plugin-pwa), naheliegender Weg
  wäre ein Wrapper wie Capacitor/Trusted Web Activity statt einer
  komplett separaten Codebasis.

**Technisch:**
- Vite 7→8 (Stand 2026-08-07 erneut geprüft, weiterhin blockiert: jetzt
  `@vitejs/plugin-react@6` ↔ dessen optionale Peer-Dependency
  `@rolldown/plugin-babel` ↔ `@babel/core` – anderer Konflikt als zuvor,
  aber weiterhin im Rolldown-Ökosystem)
- ESLint 10 im Frontend (Stand 2026-08-07 erneut geprüft, weiterhin
  blockiert: `eslint-plugin-react@7.37.5` deklariert als Peer maximal
  `eslint@^9.7`)
- Formale WCAG 2.1 AA / BITV 2.0 / EN 301 549 Zertifizierung durch Dritte

Alle abgeschlossenen und geplanten Meilensteine mit Details: siehe
verlinktes `ROADMAP.md`.
