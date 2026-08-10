/**
 * useAnnouncements – News/Ankündigungen (Roadmap-Audit, Phase D).
 * Struktur analog useComments.js, aber Top-Level-Ressource ohne
 * resourceKind/resourceId (jede Ankündigung trägt ihre eigene teamId).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/announcements';

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading,       setLoading      ] = useState(false);
  const [error,         setError        ] = useState(null);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setAnnouncements(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createAnnouncement = useCallback(async (teamId, text) => {
    try {
      const announcement = await apiFetch(BASE, { method: 'POST', body: JSON.stringify({ teamId, text }) });
      setAnnouncements((prev) => [announcement, ...prev]);
      return announcement;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deleteAnnouncement = useCallback(async (id) => {
    try {
      await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
      setAnnouncements((prev) => prev.filter((a) => a._id !== id));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    announcements, loading, error,
    fetchAnnouncements, createAnnouncement, deleteAnnouncement,
  };
}
