# 🧤 Torhüter-Werkzeuge

*🇩🇪 Deutsch | [🇬🇧 English](Torhüter-Werkzeuge.en.md)*

Drei tor-verankerte Zeichen-Werkzeuge im Taktikboard, die den
Torwart-Training-Workflow (Winkel, Rebounds, Kommunikation) visuell
unterstützen. Alle drei Werkzeuge teilen sich die **Tor-Auswahl**
(Automatisch/nächstes Tor, oder explizit links/rechts) und erscheinen
mit eigenem Layer-Toggle in der Sichtbarkeits-Leiste (aktuell 12
Ebenen). Sie sind nur im Board-Editor verfügbar, nicht im
Video-Overlay.

## Werkzeuge

### Torwart-Winkel (`W`)

Zeichnet das **Abdeckungs-Dreieck** von den beiden Torpfosten eines
Tores zum gewählten Torwart-Standort – die klassische Winkel-Lehre
("Winkel verkürzen"). Die Pfostengeometrie wird bei jedem Rendern aus
der aktuellen Feldkonfiguration abgeleitet.

- Presets: Grundstellung, Kontra oben/unten (ein-Klick)
- Pfosten-Skalierung passt sich automatisch an Feldtyp an (Großfeld/
  Kleinfeld/Street/3vs3)

### Rebound-Raum (`R`)

Schattiert den **Abprall-Kontrollraum vor einem Tor** als Trapez –
die Tormaulkante als Grundseite, zum gewählten Tiefenpunkt hin
keilförmig breiter. Die Geometrie wird pro Feldtyp aus der aktuellen
Feldkonfiguration abgeleitet (`computeReboundZone`), alle Punkte
werden ins Spielfeld geclampt.

### Konterauslösung (`K`)

Fetter, **gestrichelter Pfeil vom Torwart** (Anker = Torlinien-Mitte)
zur ersten Anspielstation des Konterangriffs inkl. kleiner
Torwart-Raute am Anker. Optisch bewusst abgrenzbar von einem
normalen Pass.

### Torwart-Kommunikation (`G`)

**Sprechblase mit wählbarer Kommando-Phrase** ("Press!", "Raus!",
"Du hast ihn!", "Stellung!", "Box!", "In Ruhe!") am
angesprochenen Spieler plus gestrichelter Connector zum
Torwart-Anker. Macht die Lautspiel-Organisation des Torwarts
sichtbar. Beim Anlegen wird der Phrasentext eingebrannt (offline-
kompatibel).

## Speicherung & Export

- Alle drei Werkzeuge sind im **GIF/MP4/PDF-Export** in Parität zur
  Live-Darstellung enthalten
- Im **Video-Overlay** werden sie ausgeblendet (dort fehlt die
  Feldgeometrie)
- Ein-Punkt-Koordinaten-Formular für alle drei Werkzeuge,WCAG-
  Tastaturbedienbar

## Technische Details

- Alle Werkzeuge nutzen `angleMath.js` für Geometrieberechnung
- Phrasen-Text wird beim Anlegen als `el.text` eingebrannt (wie
  Kommentar-Pins), damit der Offline-Export ohne i18n-Renderer
  auskommt

---

> Changlog-Referenz: Unreleased – Phase 1 (Torwart-Winkel), Phase 2
> (Rebound/Konter), Phase 3 (Kommunikation), siehe
> [CHANGELOG.md](../../CHANGELOG.md)
