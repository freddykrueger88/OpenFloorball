/**
 * saisonmanagerClient.test.js – reine Unit-Tests für den Saisonmanager-
 * Client (Spieler-Dashboard-Ausbau), `global.fetch` gemockt (Muster wie
 * aiProvider.test.js). Jeder Test nutzt einen eigenen `apiKey`, da der
 * In-Memory-Cache im Client modulweit und testübergreifend geteilt wird.
 */
import './setup.js';
import { jest } from '@jest/globals';
import { fetchNextMatch, fetchTable, SaisonmanagerError } from '../services/saisonmanagerClient.js';

const TABLE_FIXTURE = [
  { team_id: 111, team_name: 'Floorball Tigers', position: 1, games: 10, won: 8, draw: 1, lost: 1, goals_diff: 25, points: 25 },
  { team_id: 222, team_name: 'Floorball Wolves', position: 2, games: 10, won: 6, draw: 0, lost: 4, goals_diff: 5, points: 18 },
];

function mockFetchWith({ schedule = [], table = TABLE_FIXTURE, ok = true, status = 200 } = {}) {
  global.fetch = jest.fn((url) => {
    if (!ok) return Promise.resolve({ ok: false, status });
    const body = url.includes('/schedule.json') ? schedule : table;
    return Promise.resolve({ ok: true, json: async () => body });
  });
}

describe('saisonmanagerClient.fetchNextMatch', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('findet das nächste, noch nicht abgesagte Spiel unseres Teams (Heim- und Auswärts-Fall)', async () => {
    mockFetchWith({
      schedule: [
        { date: '2026-01-01', time: '18:00', home_team_name: 'Floorball Tigers', guest_team_name: 'Other Team', state: 'scheduled', arena_name: 'Halle A', arena_address: 'Adr A' },
        { date: '2099-05-01', time: '19:30', home_team_name: 'Away Team', guest_team_name: 'Floorball Tigers', state: 'scheduled', arena_name: 'Halle B', arena_address: 'Adr B' },
      ],
    });
    const match = await fetchNextMatch({ apiKey: 'key-1', leagueId: 1, smTeamId: 111 });
    expect(match).toEqual(expect.objectContaining({
      source: 'saisonmanager',
      date: expect.any(String),
      opponent: expect.any(String),
      status: 'scheduled',
    }));
  });

  it('markiert isHome/opponent korrekt für ein Auswärtsspiel', async () => {
    mockFetchWith({
      schedule: [
        { date: '2099-05-01', time: '19:30', home_team_name: 'Away Team', guest_team_name: 'Floorball Tigers', state: 'scheduled', arena_name: 'Halle B', arena_address: 'Adr B' },
      ],
    });
    const match = await fetchNextMatch({ apiKey: 'key-2', leagueId: 1, smTeamId: 111 });
    expect(match.isHome).toBe(false);
    expect(match.opponent).toBe('Away Team');
  });

  it('ignoriert abgesagte Spiele und vergangene Termine', async () => {
    mockFetchWith({
      schedule: [
        { date: '2020-01-01', time: '18:00', home_team_name: 'Floorball Tigers', guest_team_name: 'Vergangen', state: 'scheduled' },
        { date: '2099-06-01', time: '18:00', home_team_name: 'Floorball Tigers', guest_team_name: 'Abgesagt', state: 'cancelled' },
        { date: '2099-07-01', time: '18:00', home_team_name: 'Floorball Tigers', guest_team_name: 'Richtig', state: 'scheduled' },
      ],
    });
    const match = await fetchNextMatch({ apiKey: 'key-3', leagueId: 1, smTeamId: 111 });
    expect(match.opponent).toBe('Richtig');
  });

  it('gibt null zurück, wenn kein zukünftiges Spiel existiert', async () => {
    mockFetchWith({ schedule: [] });
    const match = await fetchNextMatch({ apiKey: 'key-4', leagueId: 1, smTeamId: 111 });
    expect(match).toBeNull();
  });

  it('gibt null zurück, wenn die sm_team_id in keiner Tabellenzeile vorkommt', async () => {
    mockFetchWith({ schedule: [{ date: '2099-01-01', home_team_name: 'X', guest_team_name: 'Y', state: 'scheduled' }] });
    const match = await fetchNextMatch({ apiKey: 'key-5', leagueId: 1, smTeamId: 999999 });
    expect(match).toBeNull();
  });

  it('wirft SaisonmanagerError bei Non-2xx-Antwort', async () => {
    mockFetchWith({ ok: false, status: 401 });
    await expect(fetchNextMatch({ apiKey: 'key-6', leagueId: 1, smTeamId: 111 })).rejects.toThrow(SaisonmanagerError);
  });

  it('wirft SaisonmanagerError bei Netzwerkfehler', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(fetchNextMatch({ apiKey: 'key-7', leagueId: 1, smTeamId: 111 })).rejects.toThrow(SaisonmanagerError);
  });

  it('cached wiederholte Anfragen innerhalb der TTL (kein zweiter fetch-Call)', async () => {
    mockFetchWith({ schedule: [{ date: '2099-01-01', home_team_name: 'Floorball Tigers', guest_team_name: 'Y', state: 'scheduled' }] });
    await fetchNextMatch({ apiKey: 'key-8', leagueId: 1, smTeamId: 111 });
    const callsAfterFirst = global.fetch.mock.calls.length;
    await fetchNextMatch({ apiKey: 'key-8', leagueId: 1, smTeamId: 111 });
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('saisonmanagerClient.fetchTable', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('mappt die Tabellenzeilen und markiert das eigene Team', async () => {
    mockFetchWith({});
    const table = await fetchTable({ apiKey: 'key-9', leagueId: 1, smTeamId: 222 });
    expect(table.source).toBe('saisonmanager');
    expect(table.standings).toHaveLength(2);
    expect(table.standings.find((t) => t.teamId === 222).isOwnTeam).toBe(true);
    expect(table.standings.find((t) => t.teamId === 111).isOwnTeam).toBe(false);
  });
});
