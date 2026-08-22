# 🎥 Video-Integration

Bis zu 5 kurze Videoclips pro Board (z. B. eine konkrete Spielsituation
des Gegners), abspielbar über den nativen Browser-Player.

Dieselbe Zeichnen-/Trimmen-/Marken-Funktionalität steht auch für
**Spielvideos** zur Verfügung (Video direkt an ein Spiel statt an ein
Board gehängt, mit eigener Speicherung/Zugriffsrecht über den
[Team-Zugriff des Spiels](./Live-Spielnotizen.md) statt Board-
Kollaboratoren) – siehe
[Live-Spielnotizen: Spielvideos und Video-Verknüpfung](./Live-Spielnotizen.md#spielvideos-und-video-verknüpfung)
für die zusätzliche Möglichkeit, eine Videoposition mit einem Ereignis
aus der Spiel-Zeitleiste zu verknüpfen. Die restliche Beschreibung auf
dieser Seite (Upload-Grenzen, Zeichnen, Trimmen, Marken, "Video →
Taktik-Board") gilt für beide gleichermaßen.

## Upload und Wiedergabe

| Grenze | Wert |
|---|---|
| Formate | MP4, WebM, MOV |
| Max. Dateigröße | 200 MB (Standard, per `MAX_VIDEO_SIZE_MB` änderbar) |
| Max. Videos pro Board | 5 |

Wiedergabe unterstützt Range-Requests (Vor-/Zurückspulen ohne
kompletten Neu-Download). Zugriff wie bei anderen Board-Ressourcen:
Lesen genügt zum Ansehen, Bearbeiten/Löschen braucht Schreibrecht (wie
[Board-Kollaboratoren](./Export.md#board-teilen-kollaboratoren)).

## Zeichnen, Trimmen, Marken

- **Zeichnen-Überlagerung**: taktische Elemente direkt über dem Video
  platzieren.
- **Trimmen**: Start-/Endpunkt festlegen, ohne die Originaldatei zu
  verändern.
- **Szenen-Marken**: Zeitstempel mit Beschriftung, um wichtige Momente
  im Clip schnell wiederzufinden.

## Video → Taktik-Board

Eine über den Zeichen-Werkzeugen angefertigte Video-Überlagerung lässt
sich per Klick auf "Als Taktik-Board übernehmen" in ein neues,
eigenständiges Board überführen – die Situation muss nicht von Hand
neu nachgebaut werden. Das neue Board übernimmt Feldtyp und Farben
des Ursprungs-Boards; ein Hinweistext im Notizfeld verweist auf das
Quellvideo. Übernommen wird ausschließlich die bereits gespeicherte
Zeichnung (Pfeile/Freihand), kein Video-Standbild.

## Speicherung

Videos liegen als Dateien auf der Festplatte (`VIDEOS_DIR`, Docker-
Volume), nicht als Datenbank-Blob – analog zu den temporären
Export-Dateien. Löschen des Boards (bzw. bei Spielvideos: Löschen des
Spiels) entfernt auch die zugehörigen Videodateien.

## Verwandte Seiten

- [Export & Teilen](./Export.md)
- [Live-Spielnotizen](./Live-Spielnotizen.md) – Spielvideos und
  Ereignis-Verknüpfung
