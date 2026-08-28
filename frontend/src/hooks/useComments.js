/**
 * useComments – Kommentare auf Boards und Trainingseinheiten (ROADMAP
 * Phase 2). Struktur analog useBoardCollaborators.js, parametrisiert
 * über resourceKind ('boards' | 'trainings') + resourceId, da beide
 * Ressourcentypen dieselbe API-Form unter unterschiedlichen
 * Mountpunkten teilen (siehe backend/src/routes/comments.js).
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

export function useComments(resourceKind, resourceId) {
  const [comments, setComments] = useState([]);
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState(null);

  const basePath = `/api/${resourceKind}/${resourceId}/comments`;

  const fetchComments = useCallback(async () => {
    if (!resourceId) return;
    setLoading(true);
    try {
      const data = await apiFetch(basePath);
      setComments(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [basePath, resourceId]);

  // position (Layer-System, CLAUDE.md §10.2): optionales { x, y } macht
  // den Kommentar zu einem Pin auf dem Taktikboard. Nur beim Anlegen
  // möglich – updateComment unten nimmt bewusst weiterhin nur Text
  // entgegen, eine Pin-Position ist danach unveränderlich (siehe
  // commentsController.js).
  const addComment = useCallback(async (text, position) => {
    try {
      const body = position ? { text, x: position.x, y: position.y } : { text };
      const comment = await apiFetch(basePath, { method: 'POST', body: JSON.stringify(body) });
      setComments((prev) => [...prev, comment]);
      return comment;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const updateComment = useCallback(async (commentId, text) => {
    try {
      const updated = await apiFetch(`${basePath}/${commentId}`, { method: 'PUT', body: JSON.stringify({ text }) });
      setComments((prev) => prev.map((c) => c._id === commentId ? updated : c));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  const deleteComment = useCallback(async (commentId) => {
    try {
      await apiFetch(`${basePath}/${commentId}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [basePath]);

  return {
    comments, loading, error,
    fetchComments, addComment, updateComment, deleteComment,
  };
}
