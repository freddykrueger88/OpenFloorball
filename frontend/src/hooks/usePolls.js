/**
 * usePolls – Umfragen/Polls (Roadmap-Audit, Phase D). Struktur analog
 * useAnnouncements.js, Top-Level-Ressource ohne resourceKind/resourceId.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/polls';

export function usePolls() {
  const [polls,   setPolls  ] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE);
      setPolls(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createPoll = useCallback(async (teamId, question, multipleChoice, options) => {
    try {
      const poll = await apiFetch(BASE, { method: 'POST', body: JSON.stringify({ teamId, question, multipleChoice, options }) });
      setPolls((prev) => [poll, ...prev]);
      return poll;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const vote = useCallback(async (pollId, optionId) => {
    try {
      const updated = await apiFetch(`${BASE}/${pollId}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
      setPolls((prev) => prev.map((p) => p._id === pollId ? updated : p));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const closePoll = useCallback(async (pollId) => {
    try {
      await apiFetch(`${BASE}/${pollId}/close`, { method: 'PUT' });
      setPolls((prev) => prev.map((p) => p._id === pollId ? { ...p, closedAt: new Date().toISOString() } : p));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const deletePoll = useCallback(async (pollId) => {
    try {
      await apiFetch(`${BASE}/${pollId}`, { method: 'DELETE' });
      setPolls((prev) => prev.filter((p) => p._id !== pollId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    polls, loading, error,
    fetchPolls, createPoll, vote, closePoll, deletePoll,
  };
}
