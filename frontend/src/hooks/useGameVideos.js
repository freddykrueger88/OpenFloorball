/**
 * useGameVideos – Video-Integration Phase 6 (Statistik-Architektur,
 * ADR-0005): Videos direkt an ein Spiel gehängt, strukturell identisch zu
 * useVideos.js (Board-Videos), nur mit games/:id/videos als Basis-Pfad.
 *
 * uploadVideo nutzt bewusst KEIN apiFetch – siehe useVideos.js.
 */
import { useState, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch.js';

const BASE = (gameId) => `/api/games/${gameId}/videos`;

export function useGameVideos(gameId) {
  const [videos,    setVideos   ] = useState([]);
  const [loading,   setLoading  ] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error,     setError    ] = useState(null);

  const fetchVideos = useCallback(async () => {
    if (!gameId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(BASE(gameId));
      setVideos(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const uploadVideo = useCallback(async (file, title) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('video', file);
      if (title) form.append('title', title);

      const res = await fetch(BASE(gameId), {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);

      setVideos((prev) => [...prev, json.data]);
      return json.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [gameId]);

  const updateVideo = useCallback(async (videoId, patch) => {
    try {
      const updated = await apiFetch(`${BASE(gameId)}/${videoId}`, {
        method: 'PUT',
        body: JSON.stringify(patch),
      });
      setVideos((prev) => prev.map((v) => (v._id === videoId ? updated : v)));
      return updated;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [gameId]);

  const deleteVideo = useCallback(async (videoId) => {
    try {
      await apiFetch(`${BASE(gameId)}/${videoId}`, { method: 'DELETE' });
      setVideos((prev) => prev.filter((v) => v._id !== videoId));
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [gameId]);

  const streamUrl = useCallback((videoId) => `${BASE(gameId)}/${videoId}/stream`, [gameId]);

  return { videos, loading, uploading, error, fetchVideos, uploadVideo, updateVideo, deleteVideo, streamUrl };
}
