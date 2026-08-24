# 📶 Offline-Modus (PWA)

*🇩🇪 Deutsch | [🇬🇧 English](Offline-Modus.en.md)*

OpenFloorball ist eine installierbare Progressive Web App (Service
Worker via `vite-plugin-pwa`) und funktioniert eingeschränkt auch ohne
Internetverbindung – z. B. in der Sporthalle mit schlechtem WLAN.

## Was offline funktioniert

- Die App-Oberfläche selbst (App-Shell) lädt auch offline.
- Zuvor geladene Daten (z. B. `GET /api/boards`) bleiben über einen
  `NetworkFirst`-Cache eine Zeit lang sichtbar.
- **Bewusst ausgeschlossen** vom Cache: `/api/auth`, `/api/admin`,
  `/api/user/export` – aus Datensparsamkeit werden sensible Antworten
  nicht auf dem Gerät zwischengespeichert.

## Änderungen offline speichern

Ändert oder löscht man eine bestehende Ressource (PUT/DELETE) ohne
Verbindung, landet die Änderung in einer lokalen Warteschlange
(IndexedDB) und wird automatisch gesendet, sobald die Verbindung
zurückkommt. **Neuanlagen (POST) werden bewusst nicht gepuffert** –
ein neues Board offline anzulegen funktioniert daher nicht.

## Konflikterkennung

Für folgende Ressourcen wird beim Wiederverbinden geprüft, ob
zwischenzeitlich jemand anderes (z. B. ein Co-Trainer) dieselbe
Ressource bereits geändert hat:

- Boards und Frames
- Trainingseinheiten
- Kader-Einträge

Wird ein Konflikt erkannt, erscheint ein Hinweis-Dialog – die
Änderung wird **nicht** automatisch überschrieben oder zusammengeführt,
der Trainer entscheidet manuell, ob und wie er die Änderung erneut
vornimmt. Für alle anderen Ressourcen (z. B. Playbooks, Formationen)
gilt beim Wiederverbinden weiterhin "letzte Änderung gewinnt" ohne
Warnung.

## Verwandte Seiten

- [Echtzeit-Zusammenarbeit](./Echtzeit-Zusammenarbeit.md)
- [Architektur](./Architektur.md)
