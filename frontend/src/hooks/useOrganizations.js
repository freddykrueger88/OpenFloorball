/**
 * useOrganizations – Verein-Ebene, reine Verwaltungsebene über mehreren
 * Teams (ROADMAP Phase 2). Struktur analog useTeams.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useOrganizations() {
  const [organizations, setOrganizations] = useState([]);
  const [loading,       setLoading      ] = useState(false);
  const [error,         setError        ] = useState(null);

  const fetchOrganizations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/organizations');
      setOrganizations(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOrganization = useCallback(async (orgId) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const createOrganization = useCallback(async (name) => {
    try {
      const org = await apiFetch('/api/organizations', { method: 'POST', body: JSON.stringify({ name }) });
      setOrganizations((prev) => [...prev, org]);
      return org;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const renameOrganization = useCallback(async (orgId, name) => {
    try {
      const updated = await apiFetch(`/api/organizations/${orgId}`, { method: 'PUT', body: JSON.stringify({ name }) });
      setOrganizations((prev) => prev.map((o) => o._id === orgId ? updated : o));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteOrganization = useCallback(async (orgId) => {
    try {
      await apiFetch(`/api/organizations/${orgId}`, { method: 'DELETE' });
      setOrganizations((prev) => prev.filter((o) => o._id !== orgId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchMembers = useCallback(async (orgId) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}/members`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const inviteMember = useCallback(async (orgId, { email, role }) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}/members`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const updateMemberRole = useCallback(async (orgId, memberId, role) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}/members/${memberId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const removeMember = useCallback(async (orgId, memberId) => {
    try {
      await apiFetch(`/api/organizations/${orgId}/members/${memberId}`, { method: 'DELETE' });
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const fetchSchedule = useCallback(async (orgId) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}/schedule`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  // "Wer ist wo Trainer" (EPIC 011) – admin-only, siehe organizationsController.getCoaches.
  const fetchCoaches = useCallback(async (orgId) => {
    try {
      return await apiFetch(`/api/organizations/${orgId}/coaches`);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    organizations, loading, error,
    fetchOrganizations, fetchOrganization, createOrganization, renameOrganization, deleteOrganization,
    fetchMembers, inviteMember, updateMemberRole, removeMember, fetchSchedule, fetchCoaches,
  };
}
