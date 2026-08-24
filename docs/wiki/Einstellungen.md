# ⚙️ Einstellungen

*🇩🇪 Deutsch | [🇬🇧 English](Einstellungen.en.md)*

Erreichbar über `/settings` (angemeldeter Nutzer) bzw. den
"Einstellungen"-Tab im Board-Editor für feldbezogene Optionen.

## Account-weite Einstellungen (`/settings`)

| Einstellung | Werte |
|---|---|
| **Theme** | Dark, Light, Vikings, IFF |
| **Sprache** | Deutsch, Englisch |
| **Dyslexie-freundliche Schrift** | ein/aus ([OpenDyslexic](https://opendyslexic.org/)) |

Alle Account-Einstellungen werden pro Nutzer als JSON gespeichert und
gelten geräteübergreifend nach dem Login.

## Feldbezogene Einstellungen (Board-Editor, "Einstellungen"-Tab)

Diese gelten pro Browser-Sitzung, nicht global gespeichert:

| Einstellung | Beschreibung |
|---|---|
| **Namen anzeigen** | Spielernamen ein-/ausblenden, Position oben/unten am Spieler-Token |
| **Positions-Hinweise** | Kurzbeschreibung + Tipps beim Hover über eine Position |
| **Spielfeld-Typ** | Großfeld/Kleinfeld/Street/3vs3 – siehe [IFF-Spielfelder](./IFF-Spielfelder.md) |
| **Board teilen** | Kollaborator hinzufügen – siehe [Export & Teilen](./Export.md) |

Teamfarben (Heim/Auswärts/Ball) und Tastaturkürzel-Übersicht bleiben
bewusst im Header oben rechts, da sie ohne Menü-Klick schnell
erreichbar sein sollen.

## Admin-Einstellungen

Der erste registrierte Nutzer ist automatisch Admin. Admin-only:

- Nutzerliste einsehen, Rollen ändern, Nutzer löschen
- Backup-Zeitplan konfigurieren – siehe [Backup](./Backup.md)

Es gibt aktuell keine eigene Admin-UI-Seite dafür im Frontend über die
API hinaus (siehe [API-Dokumentation](./API.md#admin)).
