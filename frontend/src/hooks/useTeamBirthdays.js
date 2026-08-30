/**
 * useTeamBirthdays – Geburtstage aller Teamkolleg:innen (GET
 * /api/teams/birthdays, dedupliziert über alle eigenen Teams). Nur
 * Nutzer mit gesetztem Geburtsdatum – siehe teamsController.getMyBirthdays.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useTeamBirthdays() {
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBirthdays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/teams/birthdays');
      setBirthdays(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { birthdays, loading, error, fetchBirthdays };
}
