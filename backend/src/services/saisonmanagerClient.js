/**
 * saisonmanagerClient – dünner Client für die öffentlichen v2-Endpunkte des
 * Saisonmanager von Floorball Deutschland (Spieler-Dashboard-Ausbau).
 *
 * Rein optional/lesend: liefert für ein per `team_saisonmanager_links`
 * verknüpftes Team das nächste Spiel bzw. die Liga-Tabelle. Kein Team ist
 * gezwungen, das zu nutzen (CLAUDE.md §5.5/§5.7 Local-/Self-Hosting-First) –
 * ohne Verknüpfung bleiben die lokalen `games`/abgeleitete Saisonwerte die
 * einzige Quelle (siehe gamesController.js/dashboardSelectors.js).
 *
 * Auth: `X-Api-Key`-Header (verifiziert gegen den echten Backend-Quellcode
 * `floorballdeutschland/saisonmanager-api`, app/controllers/
 * application_controller.rb::authenticate_public_request – NICHT das im
 * älteren, inoffiziellen Client-Repo `SaisonManager/OpenApi` behauptete
 * JWT-Schema, das dort veraltet ist). Basis-URL verifiziert aus
 * `environment.prod.ts` im echten Angular-Frontend-Repo
 * `floorballdeutschland/saisonmanager`.
 *
 * Live-Daten sind bei API-Key-Zugriff serverseitig standardmäßig 10 Minuten
 * verzögert (Saisonmanager-eigene `LIVE_DATA_DELAY`) – für Spielplan/
 * Tabelle irrelevant, nur für Live-Ereignisse während eines laufenden
 * Spiels relevant (hier nicht genutzt).
 */
const BASE_URL = 'https://saisonmanager.de/api/v2';
const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 5 * 60 * 1000;

export class SaisonmanagerError extends Error {
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'SaisonmanagerError';
    if (cause) this.cause = cause;
  }
}

// Modul-weiter In-Memory-Cache (pro Prozess) – schont Rate Limits/Terms of
// Use bei einem League-Endpunkt, den ggf. mehrere Teams derselben Liga
// gleichzeitig abfragen. Bewusst kein Redis: Cache-Verlust bei Neustart ist
// unkritisch (nächster Request holt einfach neu).
const cache = new Map(); // key -> { expiresAt, data }

function getCached(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) return undefined;
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchJson(path, apiKey) {
  const cacheKey = `${apiKey}:${path}`;
  const cached = getCached(cacheKey);
  if (cached !== undefined) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Api-Key': apiKey },
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new SaisonmanagerError('Saisonmanager hat nicht rechtzeitig geantwortet', { cause: err });
    }
    throw new SaisonmanagerError('Saisonmanager nicht erreichbar', { cause: err });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new SaisonmanagerError(`Saisonmanager antwortete mit Status ${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    throw new SaisonmanagerError('Antwort von Saisonmanager konnte nicht gelesen werden', { cause: err });
  }

  setCached(cacheKey, data);
  return data;
}

// Der Liga-Spielplan (SmV2ScheduledGame) enthält nur Team-NAMEN
// (home_team_name/guest_team_name), keine Team-IDs – die Tabelle
// (SmV2TableTeam) verknüpft team_id<->team_name, deshalb hier als
// Namensauflösung wiederverwendet (derselbe Request ist ohnehin gecacht).
async function resolveTeamName({ apiKey, leagueId, smTeamId }) {
  const table = await fetchJson(`/leagues/${leagueId}/table.json`, apiKey);
  return table.find((row) => row.team_id === smTeamId)?.team_name ?? null;
}

// Nächstes noch nicht abgesagtes Spiel unseres Teams, chronologisch – aus
// dem Liga-Spielplan gefiltert (Saisonmanager kennt keinen "gib mir nur mein
// Team"-Endpoint, nur den ganzen Liga-Spielplan).
export async function fetchNextMatch({ apiKey, leagueId, smTeamId }) {
  const teamName = await resolveTeamName({ apiKey, leagueId, smTeamId });
  if (!teamName) return null;

  const schedule = await fetchJson(`/leagues/${leagueId}/schedule.json`, apiKey);
  const today = new Date().toISOString().slice(0, 10);

  const ownGames = schedule.filter((g) =>
    g.state !== 'cancelled' &&
    g.date && g.date >= today &&
    (g.home_team_name === teamName || g.guest_team_name === teamName));
  ownGames.sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`));

  const next = ownGames[0];
  if (!next) return null;

  const isHome = next.home_team_name === teamName;
  return {
    source: 'saisonmanager',
    date: next.date,
    time: next.time ?? null,
    opponent: isHome ? next.guest_team_name : next.home_team_name,
    homeTeamName: next.home_team_name,
    guestTeamName: next.guest_team_name,
    isHome,
    venueName: next.arena_name ?? null,
    venueAddress: next.arena_address ?? null,
    status: next.state ?? 'scheduled',
    result: next.result ? { homeGoals: next.result.home_goals, guestGoals: next.result.guest_goals } : null,
  };
}

export async function fetchTable({ apiKey, leagueId, smTeamId }) {
  const table = await fetchJson(`/leagues/${leagueId}/table.json`, apiKey);
  return {
    source: 'saisonmanager',
    standings: table.map((row) => ({
      teamId: row.team_id,
      teamName: row.team_name,
      position: row.position,
      games: row.games,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      goalsDiff: row.goals_diff,
      points: row.points,
      isOwnTeam: row.team_id === smTeamId,
    })),
  };
}
