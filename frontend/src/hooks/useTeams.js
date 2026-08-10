/**
 * useTeams – Teams + Mitgliederverwaltung (ROADMAP Phase 2 – Team und
 * Organisation). Struktur analog useBoardCollaborators.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useTeams() {
  const [teams,   setTeams  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const fetchTeams = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/teams');
      setTeams(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // organizationId bewusst optional: ein Team ohne Verein ist der
  // Normalfall, die Zuordnung ist eine bewusste Coach-Entscheidung
  // (Backend prüft dafür Admin-Rechte im jeweiligen Verein).
  const createTeam = useCallback(async (name, organizationId = null) => {
    try {
      const team = await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify({ name, organizationId }) });
      setTeams((prev) => [...prev, team]);
      return team;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const renameTeam = useCallback(async (teamId, name) => {
    try {
      const updated = await apiFetch(`/api/teams/${teamId}`, { method: 'PUT', body: JSON.stringify({ name }) });
      setTeams((prev) => prev.map((t) => t._id === teamId ? updated : t));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteTeam = useCallback(async (teamId) => {
    try {
      await apiFetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      setTeams((prev) => prev.filter((t) => t._id !== teamId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchMembers = useCallback(async (teamId) => {
    try {
      return await apiFetch(`/api/teams/${teamId}/members`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const inviteMember = useCallback(async (teamId, { email, role }) => {
    try {
      return await apiFetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateMemberRole = useCallback(async (teamId, memberId, role) => {
    try {
      return await apiFetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeMember = useCallback(async (teamId, memberId) => {
    try {
      await apiFetch(`/api/teams/${teamId}/members/${memberId}`, { method: 'DELETE' });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    teams, loading, error,
    fetchTeams, createTeam, renameTeam, deleteTeam,
    fetchMembers, inviteMember, updateMemberRole, removeMember,
  };
}
