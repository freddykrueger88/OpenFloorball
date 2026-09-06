# 🏒 OpenFloorball

*[🇩🇪 Deutsch](README.md) | 🇬🇧 English*

**Self-hosted tactics board and coaching platform for floorball.**

[![CI](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml/badge.svg)](https://github.com/freddykrueger88/OpenFloorball/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/freddykrueger88/OpenFloorball)](https://github.com/freddykrueger88/OpenFloorball/blob/main/LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/freddykrueger88/OpenFloorball?style=flat&label=Stars&color=f5a623)](https://github.com/freddykrueger88/OpenFloorball/stargazers)
[![GitHub Sponsors](https://img.shields.io/badge/sponsor-💝_GitHub-purple?logo=github)](https://github.com/sponsors/freddykrueger88)
[![Open Collective](https://img.shields.io/badge/sponsor-💜_Open_Collective-blue?logo=opencollective)](https://opencollective.com/freddykrueger)

---

## 🤔 What is OpenFloorball?

OpenFloorball is a digital tactics board for floorball coaches: place
field, players, and plays, draw them, play them back as an animation,
and share them as GIF/MP4/PDF/link. It also covers the rest of the
coaching workflow – training planning, roster management, a community
exercise library for sharing with other clubs, optional AI assistance
for tactics and analysis, live game notes, and real-time collaboration
(live cursors). The platform is self-hosted (Docker) – your data stays
on your own infrastructure.

## 📸 Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/02-board-editor-taktik.png" alt="Board editor with a drawn tactic" /></td>
<td width="50%"><img src="docs/screenshots/07-ki-wissensassistent.png" alt="AI knowledge assistant with sources" /></td>
</tr>
</table>

More views (training planner, roster, community library, mobile use):
**[docs/wiki/Screenshots.en.md](docs/wiki/Screenshots.en.md)**

## ✨ Features

| Area | Status | Details |
|---|---|---|
| Tactics board (field, drawing, frame animation, versioning) | ✅ | [Drawing plays](docs/wiki/Spielzuege-Zeichnen.en.md), [Animation](docs/wiki/Animation.en.md) |
| Formation templates, playbooks | ✅ | [Formations](docs/wiki/Formationen.en.md), [Playbooks](docs/wiki/Playbooks.en.md) |
| Training planner, roster, lines | ✅ | [Training planner](docs/wiki/Trainingsplaner.en.md), [Roster](docs/wiki/Kader.en.md), [Lines](docs/wiki/Lines.en.md) |
| Live game notes | ✅ | [Live game notes](docs/wiki/Live-Spielnotizen.en.md) |
| Teams and clubs | ✅ | [Teams and clubs](docs/wiki/Teams-und-Vereine.en.md) |
| Board sharing (collaborators, invites, links) | ✅ | [Export & sharing](docs/wiki/Export.en.md) |
| Community exercise library | ✅ | [Community library](docs/wiki/Community-Bibliothek.en.md) |
| AI assistants (training/tactics/analysis/knowledge, optional) | ✅ | [AI assistants](docs/wiki/KI-Assistenten.en.md) |
| Video integration (upload, drawing overlay, trimming, markers, video→board) | ✅ | [Video integration](docs/wiki/Video-Integration.en.md) |
| Real-time presence (live cursors) | ✅ | [Real-time collaboration](docs/wiki/Echtzeit-Zusammenarbeit.en.md) |
| Export as GIF/MP4/PDF | ✅ | [Export & sharing](docs/wiki/Export.en.md) |
| PWA / offline mode | 🟡 | Conflict detection only for boards/frames/trainings/roster, see [Offline mode](docs/wiki/Offline-Modus.en.md) |
| Onboarding tour | ✅ | On first login, skippable |
| GDPR (export, deletion, backup) | ✅ | [Privacy](docs/wiki/Datenschutz.en.md), [Backup](docs/wiki/Backup.en.md) |
| Accessibility | ✅ | Colorblind filters, screen reader, keyboard, font sizes |
| Password reset | ✅ | Via email link, requires configured SMTP delivery |
| 10 languages (DE, EN, SV, FI, CS, SK, NB, LV, PL, FR) | ✅ | Translation contributions welcome |

## 🚀 Quick start

Requirements: Docker and Docker Compose.

```bash
git clone https://github.com/freddykrueger88/OpenFloorball.git
cd OpenFloorball
cp .env.example .env
docker compose up -d
```

**Edit `.env` before starting** – at minimum `DB_PASSWORD`,
`REDIS_PASSWORD`, and `JWT_SECRET` must be set. All variables are
documented in [docs/wiki/Umgebungsvariablen.en.md](docs/wiki/Umgebungsvariablen.en.md).

Then open in your browser: `http://localhost:${APP_PORT:-3000}`

<details>
<summary>Optional: TLS/HTTPS for production use</summary>

```bash
DOMAIN=your-domain.com docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d
```

</details>

Details: [docs/wiki/Installation-Docker.en.md](docs/wiki/Installation-Docker.en.md)

## 📚 Documentation

- **[Wiki](docs/wiki/Home.en.md)** – installation, features, API reference
- **[Roadmap](docs/wiki/Roadmap.en.md)** – continuously updated development overview
- **[Changelog](docs/wiki/Changelog.en.md)** – full version history
- **[Architecture](docs/wiki/Architektur.en.md)** – technical details, data model, AI integration

## 👨‍💻 Development

No local Node.js needed – lint, tests, and build run containerized.
Find the full workflow including live reload in
[docs/wiki/Installation-Entwicklung.en.md](docs/wiki/Installation-Entwicklung.en.md).

## ⭐ Star history

<a href="https://star-history.com/#freddykrueger88/OpenFloorball&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=freddykrueger88/OpenFloorball&type=Date" />
  </picture>
</a>

## 🤝 Contributing

Contributions are welcome – read [CONTRIBUTING.md](CONTRIBUTING.md)
first (German). Code of conduct: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
Please report security vulnerabilities per [SECURITY.md](SECURITY.md),
not as a public issue. Language contributions? See
[TRANSLATING.en.md](docs/TRANSLATING.en.md) – no external tool needed,
just a text editor and one test command.

## 💝 Support the project

OpenFloorball is free and open source – but development and hosting
take time and money. Visit `/<your-instance>/support` to see all the
ways you can help:

- **[GitHub Sponsors](https://github.com/sponsors/freddykrueger88)** –
  monthly or one-time donation
- **[Open Collective](https://opencollective.com/freddykrueger)** –
  transparent funding for infrastructure and development

## 📄 License

MIT License – see [LICENSE](LICENSE).

---

<p align="center">
  <em>OpenFloorball – because tactics is more than just chalk on the board.</em>
</p>