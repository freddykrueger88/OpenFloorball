# 🏒 OpenFloorball

*🇩🇪 Deutsch | [🇬🇧 English](README.en.md)*

**Selbst gehostetes Taktikboard und Coaching-Plattform für Floorball.**

[![CI](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml/badge.svg)](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/freddykrueger88/OpenFloorball)](https://github.com/freddykrueger88/OpenFloorball/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/freddykrueger88/OpenFloorball?style=flat&label=Stars&color=f5a623)](https://github.com/freddykrueger88/OpenFloorball/stargazers)
[![GitHub Sponsors](https://img.shields.io/badge/sponsor-💝_GitHub-purple?logo=github)](https://github.com/sponsors/freddykrueger88)
[![Open Collective](https://img.shields.io/badge/sponsor-💜_Open_Collective-blue?logo=opencollective)](https://opencollective.com/freddykrueger)

---

## 🤔 Was ist OpenFloorball?

OpenFloorball ist ein digitales Taktikboard für Floorball-Trainer:
Spielfeld, Spieler und Spielzüge platzieren, zeichnen, als Animation
abspielen und als GIF/MP4/PDF/Link teilen. Dazu kommt die
Trainingsplanung, Kaderverwaltung, eine Community-Übungsbibliothek
zum Teilen mit anderen Vereinen, optionale KI-Unterstützung bei
Taktik und Analyse, Live-Spielnotizen und Echtzeit-Zusammenarbeit
(Live-Cursor). Die Plattform wird selbst gehostet (Docker) – die
Daten bleiben auf der eigenen Infrastruktur.

## 📸 Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/02-board-editor-taktik.png" alt="Board-Editor mit gezeichneter Taktik" /></td>
<td width="50%"><img src="docs/screenshots/07-ki-wissensassistent.png" alt="KI-Wissensassistent mit Quellenangaben" /></td>
</tr>
</table>

Weitere Ansichten (Trainingsplaner, Kader, Community-Bibliothek,
mobile Nutzung): **[docs/wiki/Screenshots.md](docs/wiki/Screenshots.md)**

## ✨ Features

| Bereich | Status | Details |
|---|---|---|
| Taktikboard (Spielfeld, Zeichnen, Frame-Animation, Versionierung) | ✅ | [Spielzüge zeichnen](docs/wiki/Spielzuege-Zeichnen.md), [Animation](docs/wiki/Animation.md) |
| Formationsvorlagen, Playbooks | ✅ | [Formationen](docs/wiki/Formationen.md), [Playbooks](docs/wiki/Playbooks.md) |
| Trainingsplaner, Kader, Lines | ✅ | [Trainingsplaner](docs/wiki/Trainingsplaner.md), [Kader](docs/wiki/Kader.md), [Lines](docs/wiki/Lines.md) |
| Live-Spielnotizen | ✅ | [Live-Spielnotizen](docs/wiki/Live-Spielnotizen.md) |
| Teams und Vereine | ✅ | [Teams und Vereine](docs/wiki/Teams-und-Vereine.md) |
| Board-Sharing (Kollaboratoren, Einladungen, Links) | ✅ | [Export & Teilen](docs/wiki/Export.md) |
| Community-Übungsbibliothek | ✅ | [Community-Bibliothek](docs/wiki/Community-Bibliothek.md) |
| KI-Assistenten (Training/Taktik/Analyse/Wissen, optional) | ✅ | [KI-Assistenten](docs/wiki/KI-Assistenten.md) |
| Video-Integration (Upload, Zeichnen-Overlay, Trimmen, Marken, Video→Board) | ✅ | [Video-Integration](docs/wiki/Video-Integration.md) |
| Echtzeit-Präsenz (Live-Cursor) | ✅ | [Echtzeit-Zusammenarbeit](docs/wiki/Echtzeit-Zusammenarbeit.md) |
| Export als GIF/MP4/PDF | ✅ | [Export & Teilen](docs/wiki/Export.md) |
| PWA / Offline-Modus | 🟡 | Konflikterkennung nur für Boards/Frames/Trainings/Kader, siehe [Offline-Modus](docs/wiki/Offline-Modus.md) |
| Onboarding-Tour | ✅ | Beim ersten Login, überspringbar |
| DSGVO (Export, Löschung, Backup) | ✅ | [Datenschutz](docs/wiki/Datenschutz.md), [Backup](docs/wiki/Backup.md) |
| Barrierefreiheit | ✅ | Farbenblind-Filter, Screenreader, Tastatur, Schriftgrößen |
| Passwort-Reset | ✅ | Per E-Mail-Link, erfordert konfigurierten SMTP-Versand |
| 10 Sprachen (DE, EN, SV, FI, CS, SK, NB, LV, PL, FR) | ✅ | Übersetzungsbeiträge willkommen |

## 🚀 Schnellstart

Voraussetzungen: Docker und Docker Compose.

```bash
git clone https://github.com/freddykrueger88/OpenFloorball.git
cd OpenFloorball
cp .env.example .env
docker compose up -d
```

**Vor dem Start `.env` bearbeiten** – mindestens `DB_PASSWORD`,
`REDIS_PASSWORD` und `JWT_SECRET` müssen gesetzt sein. Alle
Variablen sind erklärt in
[docs/wiki/Umgebungsvariablen.md](docs/wiki/Umgebungsvariablen.md).

Danach im Browser öffnen: `http://localhost:${APP_PORT:-3000}`

<details>
<summary>Optional: TLS/HTTPS für produktiven Einsatz</summary>

```bash
DOMAIN=deine-domain.de docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

</details>

Details: [docs/wiki/Installation-Docker.md](docs/wiki/Installation-Docker.md)

## 📚 Dokumentation

- **[Wiki](docs/wiki/Home.md)** – Installation, Features, API-Referenz
- **[Roadmap](docs/wiki/Roadmap.md)** – laufend aktualisierte Entwicklungsübersicht
- **[CHANGELOG](CHANGELOG.md)** – vollständige Versionshistorie
- **[Architektur](docs/wiki/Architektur.md)** – Technische Details, Datenmodell, KI-Anbindung

## 👨‍💻 Entwicklung

Kein lokales Node.js nötig – Lint, Tests und Build laufen containerisiert.
Den vollständigen Workflow inkl. Live-Reload findest du in
[docs/wiki/Installation-Entwicklung.md](docs/wiki/Installation-Entwicklung.md).

## ⭐ Star-Historie

<a href="https://star-history.com/#freddykrueger88/OpenFloorball&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date" />
  </picture>
</a>

## 🤝 Mitwirken

Beiträge sind willkommen – lies zuerst [CONTRIBUTING.md](CONTRIBUTING.md).
Verhaltensregeln: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Sicherheitslücken bitte gemäß [SECURITY.md](SECURITY.md) melden,
nicht als öffentliches Issue. Sprachbeiträge? Siehe
[TRANSLATING.md](docs/TRANSLATING.md).

## 💝 Projekt unterstützen

OpenFloorball ist kostenlos und quelloffen – Entwicklung und Hosting
sind aber Arbeit und Kosten. Über einen Besuch auf `/<deine-Instanz>/support`
informierst du dich über alle Möglichkeiten:

- **[GitHub Sponsors](https://github.com/sponsors/freddykrueger88)** –
  monatliche oder einmalige Spende
- **[Open Collective](https://opencollective.com/freddykrueger)** –
  transparente Spendensammlung

## 📄 Lizenz

MIT-Lizenz – siehe [LICENSE](LICENSE).

---

<p align="center">
  <em>OpenFloorball – weil Taktik mehr ist als Kreide an der Tafel.</em>
</p>