/**
 * useTeamSaisonmanager – Spieler-Dashboard-Ausbau: optionale, rein lesende
 * Anbindung eines Teams an die externe Saisonmanager-Liga-Verwaltung.
 * Verbindung verwalten (setzen/lesen/trennen) ist owner-only serverseitig
 * (siehe teamSaisonmanagerController.js) – dieser Hook wird sowohl von der
 * Team-Settings-Section als auch von useDashboardData.js genutzt.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useTeamSaisonmanager(teamId) {
  const [status, setStatus] = useState(null); // { connected, leagueId?, smTeamId? }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const base = `/api/teams/${teamId}/saisonmanager`;

  const fetchStatus = useCallback(async () => {
    if (!teamId) return null;
    setLoading(true);
    try {
      const data = await apiFetch(base);
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [base, teamId]);

  const connect = useCallback(async ({ apiKey, leagueId, smTeamId }) => {
    try {
      const data = await apiFetch(base, { method: 'PUT', body: JSON.stringify({ apiKey, leagueId, smTeamId }) });
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [base]);

  const disconnect = useCallback(async () => {
    try {
      const data = await apiFetch(base, { method: 'DELETE' });
      setStatus(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [base]);

  const fetchNextMatch = useCallback(() => apiFetch(`${base}/next-match`), [base]);
  const fetchTable = useCallback(() => apiFetch(`${base}/table`), [base]);

  return { status, loading, error, fetchStatus, connect, disconnect, fetchNextMatch, fetchTable };
}
