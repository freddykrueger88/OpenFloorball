# 🎬 Frame-by-Frame Animation

*🇩🇪 Deutsch | [🇬🇧 English](Animation.en.md)*

Ein Board besteht aus einer Sequenz von **Frames** – jeder Frame
speichert Spielerpositionen und gezeichnete Elemente als eigenen
Zustand. Die Wiedergabe interpoliert Spielerbewegungen flüssig
zwischen den Frames; gezeichnete Pfeile/Linien blenden dagegen hart
beim Frame-Wechsel ein/aus (kein Tweening für Zeichnungen).

## Frames verwalten

Die Frame-Leiste sitzt über dem unteren Tab-Menü:

- **Frame hinzufügen**: übernimmt die aktuelle Spieleraufstellung und
  Zeichnung als Startpunkt für den neuen Frame
- **Frame löschen**
- **Reihenfolge ändern**: Frames per Drag & Drop neu anordnen
- Klick auf einen Frame springt direkt dorthin

## Wiedergabe

Steuerung direkt unter dem Header:

| Aktion | Tastenkürzel |
|---|---|
| Play/Pause | `Leertaste` |
| Ein Frame vor (nur wenn nicht abgespielt wird) | `→` |
| Ein Frame zurück (nur wenn nicht abgespielt wird) | `←` |

Zusätzlich einstellbar:

- **Geschwindigkeit**: 0.5×, 1×, 2×, 3×
- **Loop**: nach dem letzten Frame wieder von vorne

## Speichern

Änderungen am aktiven Frame (Spielerpositionen, Zeichnungen) werden
automatisch gespeichert (Debounce ~300ms nach der letzten Änderung,
zusätzlich alle 30s). Beim manuellen Wechsel zu einem anderen Frame
wird zuvor explizit gespeichert, damit auch sehr schnell
aufeinanderfolgende Aktionen nichts verlieren.

## Export als Video

Eine Frame-Sequenz lässt sich als **GIF** oder **MP4** exportieren –
siehe [Export & Teilen](./Export.md).
