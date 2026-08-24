# 🤝 Contributing Guide

*🇩🇪 Deutsch | [🇬🇧 English](Contributing.en.md)*

Die vollständige Anleitung liegt im Repository selbst, um sie nicht an
zwei Stellen aktuell halten zu müssen:

👉 **[CONTRIBUTING.md](../../CONTRIBUTING.md)**

Kurzfassung:

- Docker-first – lokale Entwicklung siehe auch
  [Manuelle Installation (Entwicklung)](./Installation-Entwicklung.md)
- Commits im [Conventional-Commits](https://www.conventionalcommits.org/)-Stil
- ESLint muss auf beiden Seiten sauber durchlaufen
  (`npm run lint`, `--max-warnings=0`)
- Neue Backend-Endpunkte brauchen Jest-Tests
- Barrierefreiheit bei UI-Änderungen mitdenken (Tastaturbedienbarkeit,
  ARIA-Labels)
- PRs gegen `main`, CI muss grün sein
