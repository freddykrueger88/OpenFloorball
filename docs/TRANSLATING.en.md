# TRANSLATING.en.md

*[🇩🇪 Auf Deutsch lesen](TRANSLATING.md)*

# Translating OpenFloorball

Thanks for wanting to bring OpenFloorball to your language. Floorball
is much more established in some countries than it is in the
German-speaking region where this project started – coaches there
should be able to use the platform in their own language.

This guide is deliberately written so that you need **no** account
with an external translation platform and **no** understanding of the
build setup to contribute a first draft. All you need is a text
editor, Node.js, and one terminal command.

---

## 1. Which language?

Check [BACKLOG.md, ISSUE 027](planning/BACKLOG.md) first for the
current priority list – it's based on actual floorball activity (IFF
member federations, league strength), not on number of speakers.
Currently missing, for example: Finnish, Czech, and Slovak. Swedish
already exists as a first – AI-generated, **not yet reviewed by a
native speaker** – draft (`frontend/src/i18n/locales/sv.json`), which
needs correction rather than starting from scratch.

Want to translate a language nobody has started yet? Leave a short
comment on the linked tracking issue on GitHub to say which language
you're taking on, so no one duplicates the work.

---

## 2. Where do the texts live?

All UI text lives as JSON in `frontend/src/i18n/locales/`, one file
per language (`de.json`, `en.json`, `sv.json`, …). Every file has the
exact same structure – only the values (right of the `:`) differ,
never the keys (left of the `:`).

```json
"resetPosition": "Reset position"
```

becomes

```json
"resetPosition": "Återställ position"
```

---

## 3. Adding a new language

1. Copy `frontend/src/i18n/locales/en.json` to
   `frontend/src/i18n/locales/<code>.json` (`<code>` = two-letter
   ISO-639-1 code, e.g. `fi` for Finnish, `cs` for Czech, `sk` for
   Slovak).
2. Translate the values one by one. Leave these unchanged no matter
   what:
   * the keys themselves (`"resetPosition"`)
   * placeholders like `{{name}}` or `{{count}}` – they're replaced
     with real values at runtime
   * key suffixes like `_one` / `_other` (plural forms; some languages
     also need `_few`/`_many`/`_zero` – see
     [i18next pluralization](https://www.i18next.com/translation-function/plurals),
     and please mention it on the tracking issue if your language
     needs that)
3. Add your language to the `LOCALES` object in
   `frontend/src/i18n/locales/locales.test.js` (import + one entry,
   two lines).
4. Add your language to `resources` and `supportedLngs` in
   `frontend/src/i18n/i18n.js`.
5. Add an `<option>` line for your language to the language dropdown
   in `frontend/src/components/settings/PreferencesSection.jsx`, plus
   the key `settings.language<Code>` in **all** locale files
   (including `de.json` and `en.json` – there, in German/English, e.g.
   `"languageFi": "Finnisch"` / `"Finnish"`).

---

## 4. Improving an existing language

Simpler: just open the relevant file
(`frontend/src/i18n/locales/<code>.json`) and change the affected
values. No further steps needed.

---

## 5. Automated check – your most important tool

From the `frontend` directory:

```bash
npm test -- locales.test.js
```

This automatically checks:

* **Completeness** – if your file is missing a key that exists in
  `en.json` (or has an extra one), it's listed by name.
* **No empty values** – an `""` is flagged immediately.

You don't need to set anything else up for this – no external tool,
no account. Just translate, run the command, fill the gaps, repeat
until the test passes.

---

## 6. Floorball terminology

Translate terminology the way coaches actually use it in your
language, not literally. Examples from German/English, with context:

| Term (DE/EN) | Meaning |
|---|---|
| Wechselblock / line | A fixed group of players who play together and change as a unit |
| Powerplay | Numerical advantage after the opponent takes a penalty |
| Boxplay / penalty kill | Numerical disadvantage while your own team is serving a penalty |
| Forechecking | Actively pressuring/pressing in the opponent's zone |
| Center / Defender / Attacker | Field player positions in the 2-1-2 system |

When in doubt: translate the way your country's league coverage
actually does it (many countries keep "Powerplay" and "Boxplay"
unchanged as loanwords from ice hockey – in that case, just leave them
as-is).

---

## 7. Pull request

* Small, focused PRs preferred – one new language or one fix, not
  both mixed with an unrelated code change (see
  [CONTRIBUTING.md](../CONTRIBUTING.md)).
* Mention in the PR whether you're a **native speaker** and have a
  floorball background (player, coach, club member). That helps the
  review more than any language check.
* An AI-generated first draft is welcome as a **starting point** (see
  `sv.json`), but should be clearly marked as an unreviewed draft in
  the PR and needs at least one native-speaker review before merge –
  wrong floorball terminology does more harm than a missing language.

Thanks for contributing!
