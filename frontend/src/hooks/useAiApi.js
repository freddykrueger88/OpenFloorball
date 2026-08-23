/**
 * useAiApi – API-Hook für die KI-Assistenten (EPIC 010: Trainings-,
 * Taktik-, Analyse- und Wissensassistent, AI_SYSTEM.md §5.1-5.4)
 * Struktur analog useLibraryApi.js
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = '/api/ai';

export function useAiApi() {
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState(null);

  const request = useCallback(async (fn) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(() =>
    request(() => apiFetch(`${BASE}/status`)), [request]);

  const generateTrainingPlan = useCallback((params) =>
    request(() => apiFetch(`${BASE}/training-plan`, { method: 'POST', body: JSON.stringify(params) })), [request]);

  const generateTacticSuggestion = useCallback((params) =>
    request(() => apiFetch(`${BASE}/tactic-suggestion`, { method: 'POST', body: JSON.stringify(params) })), [request]);

  const generateAnalysis = useCallback((params) =>
    request(() => apiFetch(`${BASE}/analysis`, { method: 'POST', body: JSON.stringify(params) })), [request]);

  const generateKnowledgeAnswer = useCallback((params) =>
    request(() => apiFetch(`${BASE}/knowledge-query`, { method: 'POST', body: JSON.stringify(params) })), [request]);

  // Statistik-Architektur Phase 9 (Spiel-Insights)
  const generateGameInsights = useCallback((params) =>
    request(() => apiFetch(`${BASE}/game-insights`, { method: 'POST', body: JSON.stringify(params) })), [request]);

  return {
    loading, error, fetchStatus, generateTrainingPlan, generateTacticSuggestion, generateAnalysis,
    generateKnowledgeAnswer, generateGameInsights,
  };
}
