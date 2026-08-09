/**
 * useCalendarFeed – ICS-Kalender-Abo (Roadmap-Audit). Verwaltet den
 * persönlichen calendar_feed_token über /api/user/calendar-feed.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE_PATH = '/api/user/calendar-feed';

export function useCalendarFeed() {
  const [feedUrl, setFeedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(BASE_PATH);
      setFeedUrl(data.feedUrl);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch(BASE_PATH, { method: 'POST' });
      setFeedUrl(data.feedUrl);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const revoke = useCallback(async () => {
    setError(null);
    try {
      const data = await apiFetch(BASE_PATH, { method: 'DELETE' });
      setFeedUrl(data.feedUrl);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  return {
    feedUrl, loading, error,
    fetchStatus, generate, revoke,
  };
}
