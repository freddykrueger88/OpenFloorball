# 🤝 Contributing Guide

*[🇩🇪 Deutsch](Contributing.md) | 🇬🇧 English*

The full guide lives in the repository itself, so it doesn't have to
be kept up to date in two places:

👉 **[CONTRIBUTING.md](../../CONTRIBUTING.md)**

Short version:

- Docker-first – for local development also see
  [Manual installation (development)](./Installation-Entwicklung.en.md)
- Commits in [Conventional Commits](https://www.conventionalcommits.org/) style
- ESLint must pass cleanly on both sides
  (`npm run lint`, `--max-warnings=0`)
- New backend endpoints need Jest tests
- Keep accessibility in mind for UI changes (keyboard operability,
  ARIA labels)
- PRs against `main`, CI must be green
