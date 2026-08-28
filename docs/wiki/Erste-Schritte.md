# 🚀 Erste Schritte

*🇩🇪 Deutsch | [🇬🇧 English](Erste-Schritte.en.md)*

Kurzer Rundgang durch OpenFloorball nach der [Installation](./Installation-Docker.md).

## 1. Registrieren

Der **erste registrierte Account wird automatisch Admin** – es gibt
keinen separaten Setup-Assistenten. `http://localhost` (bzw. der
konfigurierte `APP_PORT`) öffnen, auf **Registrieren** klicken,
E-Mail + Passwort vergeben.

## 2. Geführte Tour

Nach der ersten Anmeldung startet automatisch eine kurze, jederzeit
überspringbare Einführungstour durch das Hauptmenü. Das Hauptmenü
selbst ist in fünf Bereiche gruppiert (Boards, Kader, Spielbetrieb,
Team, Wissen) statt einer langen Liste einzelner Links – jeder Bereich
lässt sich per Klick aufklappen. Die Tour lässt sich jederzeit über
[Einstellungen](./Einstellungen.md) erneut starten.

Im Board-Editor selbst gibt es eine zweite, unabhängige Tour zu den
Editor-Werkzeugen (Spieler platzieren, Zeichnen, Szenen/Animation,
Speichern, Lines/Formationsvorlagen/Video im Seitenpanel, Export) –
erneut aufrufbar über das Hilfe-Symbol (❓) oben rechts im Editor oder
ebenfalls über die Einstellungen.

## 3. Erstes Board anlegen

Auf der Board-Übersicht (`/boards`, Startseite nach dem Login) auf
**Neues Board** klicken. Dabei wählbar:

- **Name** des Boards
- **Spielfeld-Typ**: Großfeld (40×20m), Kleinfeld (20×14m), Street
  Floorball (25×15m), 3vs3 (22×11m) – siehe
  [IFF-Spielfelder](./IFF-Spielfelder.md)
- **Design/Theme**: Dark, Light, Vikings, IFF
- Optional: einem [Playbook](./Playbooks.md) zuordnen

OpenFloorball legt automatisch eine IFF-konforme Standardaufstellung
(2‑1‑2-System, alle Feldspieler in der eigenen Hälfte) als ersten
[Frame](./Animation.md) an.

## 4. Spielzug aufbauen

Im Board-Editor:

- Spieler per Drag & Drop verschieben
- Über die Werkzeugleiste links Pfeile/Linien
  [zeichnen](./Spielzuege-Zeichnen.md)
- Weitere [Frames](./Animation.md) für eine Bewegungsabfolge anlegen
  (Frame-Leiste unten)

Änderungen werden automatisch gespeichert (Sichtbar am
Speicherstatus im Header).

## 5. Exportieren oder teilen

Im unteren Tab-Menü ("⚙️ Einstellungen"-Tab ausklappen für Details):

- **GIF/MP4**: Bewegungsablauf über alle Frames als Video
- **PDF**: Taktikblatt zum Ausdrucken
- **Link teilen**: öffentlich einsehbarer Link ohne Login (läuft nach
  `SHARE_LINK_EXPIRES_HOURS` automatisch ab)
- **Board teilen**: einen anderen OpenFloorball-Nutzer als Kollaborator
  hinzufügen (siehe [Export & Teilen](./Export.md))

## 6. Team & Training

- [Kader](./Kader.md): zentraler Spieler-Pool, einmal pflegen, in
  jedem Board zuweisbar
- [Lines](./Lines.md): taktische Kader-Spieler-Kombinationen, schnell
  während eines Spiels wechselbar
- [Trainingsplaner](./Trainingsplaner.md): mehrere Boards zu einer
  Trainingseinheit mit Dauer/Reihenfolge zusammenstellen
- [Live-Spielnotizen](./Live-Spielnotizen.md): Spiele anlegen,
  zeitgestempelte Notizen während des Spiels erfassen

## Nächste Schritte

- [Spielzüge zeichnen](./Spielzuege-Zeichnen.md)
- [Frame-by-Frame Animation](./Animation.md)
- [Einstellungen](./Einstellungen.md) (Theme, Sprache, Schriftart)
