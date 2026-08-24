# 🤖 AI Assistants

*[🇩🇪 Deutsch](KI-Assistenten.md) | 🇬🇧 English*

Five optional, text-based assistants (`/api/ai/*`), visible only if
this instance has an AI provider configured. No assistant saves
anything automatically – each one only produces a text draft that the
coach reviews, edits, and explicitly applies (exception: Game Insights
is a pure read-only result with no "apply" step, see below).

## Configuration (admin)

Under [Settings](./Einstellungen.en.md#admin-settings) → Admin: base
URL, model, timeout, API key. The API works with any provider that
offers an OpenAI-compatible `/v1/chat/completions` interface – local
(e.g. Ollama, LM Studio) or as a cloud service. No vendor lock-in to a
specific provider. The API key is never returned to the frontend (only
whether one is set).

Alternatively via environment variables (`AI_PROVIDER_*` in `.env`,
see [Environment variables](./Umgebungsvariablen.en.md)) – the admin
UI values take precedence once they've been set.

## The five assistants

| Assistant | Page | Input | Output |
|---|---|---|---|
| Training assistant | Training plans | Age group (fixed list), goal, duration, number of players | Text draft of a training session (warm-up/technique/tactics/game form/cool-down) |
| Tactics assistant | Boards | Category (forechecking/power play/penalty kill/general), question | 2–3 tactical variants with pros/cons |
| Analysis assistant | Boards | Free-text observations about a game/situation | Summary, detected patterns, follow-up questions |
| Knowledge assistant | Knowledge | Question in natural language | Answer based on your own boards/trainings/library entries, with sources |
| Game Insights | Game page (`/games/:id`) | None – automatically uses this game's already-calculated statistics | Notable patterns + possible training focus areas, basis is viewable |

### Game Insights in detail

"AI game analysis" button on the game page. Unlike the other four
assistants, this one needs **no input** – its basis is exclusively
already-calculated team metrics for this game (shot statistics incl.
zones, special teams, situational splits by score state), no raw
events, no player names. "Show basis" displays the exact text block
that was actually sent to the AI – traceability instead of a black
box. No "apply" step: the underlying numbers are permanently visible
in [Statistics](./Statistiken.en.md) anyway, the AI text is a
read-only result.

## Privacy and limits

- No player or talent evaluation, no rankings of individual people –
  the prompt templates (`backend/src/services/ai/prompts/`) explicitly
  prohibit this.
- The analysis assistant shows a visible hint in the UI not to enter
  names/jersey numbers.
- The knowledge assistant doesn't call the AI **at all** if no
  matching entries of your own are found – this prevents fabricated
  answers without a real basis. The source list comes directly from
  the database search, not from the AI text.
- The training assistant/tactics assistant deliberately use fixed
  selection lists instead of free text for fields sensitive to
  personal data.
- Game Insights goes one step further: the input consists exclusively
  of already-aggregated team numbers – there's structurally no field
  through which names/jersey numbers could enter at all (no free text,
  no raw events with `roster_player_id`).

## Related pages

- [Architecture – AI provider](./Architektur.en.md#ai-provider-optional)
- [Settings](./Einstellungen.en.md)
