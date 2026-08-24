# 🩹 Troubleshooting

*🇩🇪 Deutsch | [🇬🇧 English](Troubleshooting.en.md)*

## Login funktioniert nicht / Cookie wird sofort wieder verworfen

Meist `COOKIE_SECURE=true` (Standard) ohne HTTPS davor. Für reinen
HTTP-Betrieb im Heimnetz `COOKIE_SECURE=false` in der `.env` setzen und
neu starten (`docker compose up -d --build`).

## Nach `docker compose up -d --build` sieht die App noch alt aus

Zwei mögliche Ursachen:

1. **Service Worker cacht die alte Version** – die PWA nutzt
   `autoUpdate`; ein einmaliges hartes Neuladen (Strg+Umschalt+R) reicht
   meist, den neuen Stand zu laden.
2. Es wurde nur `git pull` ausgeführt, aber kein Rebuild – `git pull`
   allein aktualisiert nicht die laufenden Container. Immer mit
   `docker compose up -d --build` neu bauen und starten.

## Container startet nicht / "port already in use"

Ein anderer Dienst belegt bereits Port 80 (oder den in `APP_PORT`
konfigurierten Port). Entweder den anderen Dienst stoppen oder
`APP_PORT` in der `.env` auf einen freien Port ändern.

## Postgres-Container hängt im Neustart-Loop nach einem Major-Upgrade

Postgres-Images ≥ 18 erwarten ein Daten-Volume unter
`/var/lib/postgresql` (Elternverzeichnis), nicht mehr
`/var/lib/postgresql/data` wie bei älteren Versionen. Bei einem
manuellen Wechsel des Postgres-Major-Images: Volume-Mount in
`docker-compose.yml` prüfen und ggf. per `pg_dump`/`pg_restore` in ein
neu gemountetes Volume migrieren (siehe [Backup](./Backup.md)).

## E-Mail-Versand funktioniert nicht

Siehe eigene Anleitung: [E-Mail-Versand einrichten](./E-Mail-Versand.md)
(Abschnitt "Testen").

## Backup-Verzeichnis wächst unbegrenzt

Prüfen, ob unter Admin-Einstellungen ein sinnvoller
Aufbewahrungswert (`retention`) konfiguriert ist – siehe
[Backup](./Backup.md). Standard ist 7 Läufe.

## "JWT_SECRET fehlt oder ist kürzer als 32 Zeichen" beim Start

`JWT_SECRET` in der `.env` muss gesetzt und ausreichend lang sein
(empfohlen: 64 Zeichen, `openssl rand -base64 64`). Der Server startet
mit Absicht nicht ohne einen ausreichend starken Wert.

## Logs ansehen

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Weiterführend

- [FAQ](./FAQ.md)
- [Umgebungsvariablen](./Umgebungsvariablen.md)
- Bug melden: [Issue-Templates](https://github.com/freddykrueger88/OpenFloorball/issues/new/choose)
