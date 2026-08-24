# ❓ FAQ

*🇩🇪 Deutsch | [🇬🇧 English](FAQ.en.md)*

**Läuft OpenFloorball auch ohne Docker?**
Nicht offiziell unterstützt – das Projekt ist bewusst Docker-first
aufgebaut (Backend, Frontend/Nginx, Postgres, Redis als eigene
Container). Für lokale Entwicklung siehe
[Manuelle Installation](./Installation-Entwicklung.md).

**Brauche ich HTTPS?**
Für reinen Heimnetz-/LAN-Betrieb nicht zwingend
(`COOKIE_SECURE=false` setzen). Für Zugriff über das offene Internet:
ja – siehe [Sicherheit](./Sicherheit.md).

**Kann ich mehrere Trainer gleichzeitig an einem Board arbeiten
lassen?**
Boards lassen sich teilen (Lese-/Schreibzugriff, siehe
[Export & Teilen](./Export.md)). Echte Gleichzeitig-Bearbeitung mit
Live-Cursor ist bewusst (noch) nicht Teil des Funktionsumfangs, siehe
[ROADMAP](./Roadmap.md).

**Warum kommt beim "Board teilen" ein Fehler "Kein Nutzer mit dieser
E-Mail-Adresse gefunden"?**
Board-Sharing setzt zwingend einen bereits **registrierten**
OpenFloorball-Account voraus – es gibt (noch) keinen Einladungslink für
neue, unregistrierte E-Mail-Adressen. Die eingeladene Person muss sich
zuerst selbst unter `/register` registrieren.

**Verschickt OpenFloorball E-Mails?**
Nur optional, und nur eine kurze Benachrichtigung beim Hinzufügen als
Kollaborator – siehe [E-Mail-Versand einrichten](./E-Mail-Versand.md).
Ohne konfigurierten SMTP-Server passiert einfach nichts, die App bleibt
voll funktionsfähig.

**Ist OpenFloorball für Tablets/Smartphones optimiert?**
Nicht dediziert – Desktop/Laptop ist der primäre Anwendungsfall, das
Layout ist nicht speziell für Touch-Gesten getestet.

**Ist OpenFloorball barrierefrei?**
Die App orientiert sich durchgehend an WCAG 2.1 AA / BITV 2.0 /
EN 301 549 (Tastaturbedienbarkeit, ARIA-Labels, Screenreader-
Ankündigungen), wurde aber bislang nicht extern zertifiziert.

**Funktioniert OpenFloorball offline?**
Teilweise – die App-Shell und zuletzt geladene Board-Daten werden per
Service Worker gecacht (PWA). Schreibzugriffe während einer
Offline-Phase werden gepuffert und automatisch synchronisiert, sobald
wieder eine Verbindung besteht. Details:
[Architektur – Offline-Modus](./Architektur.md#offline-modus-pwa).

**Wie aktualisiere ich auf eine neue Version?**
```bash
git pull
docker compose up -d --build
```
Datenbank-Migrationen laufen automatisch beim Backend-Start.

**Wo finde ich alle Änderungen einer neuen Version?**
[Changelog](./Changelog.md).
