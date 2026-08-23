/**
 * useExport – GIF-/MP4-Export Hook
 * Issue #15 (GIF) – v0.5.0, Issue #23 (MP4) – v0.8.0
 *
 * Rendert alle Board-Frames als PNG via Konva Stage.toDataURL(),
 * schickt sie ans Backend und pollt den Job-Status.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// VITE_API_URL enthält bereits das /api-Präfix (Default '/api', siehe
// utils/api.js) – hier NICHT nochmal /api/ voranstellen, sonst landen die
// Requests unter /api/api/export/... (413/404, Backend sieht die Route nie).
const API = import.meta.env.VITE_API_URL ?? '/api';
const POLL_INTERVAL_MS = 1200;

export function useExport() {
  const { t } = useTranslation();
  const [status,   setStatus  ] = useState('idle'); // idle | rendering | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [fileUrl,  setFileUrl ] = useState(null);
  const [error,    setError   ] = useState(null);
  const pollRef = useRef(null);

  const reset = useCallback(() => {
    clearInterval(pollRef.current);
    setStatus('idle');
    setProgress(0);
    setFileUrl(null);
    setError(null);
  }, []);

  // Polling darf nicht über das Unmounten der Komponente hinaus weiterlaufen
  // (z.B. Export-Panel geschlossen, während ein Job noch verarbeitet wird) –
  // sonst feuert der Poll-Request alle 1.2s unbegrenzt im Hintergrund weiter.
  useEffect(() => () => clearInterval(pollRef.current), []);

  /**
   * stageRef: React ref zu einer Konva Stage-Instanz (per board frame)
   * frames:   Array der Board-Frames (mit .players und .elements)
   * opts:     { fps, width, loop, format, watermark }
   * format:   'gif' (Default) | 'mp4' – wählt Endpunkt und Body-Felder
   *
   * Weil alle Frames in der gleichen Stage gerendert werden müssen,
   * nimmt der Hook eine render-Funktion entgegen:
   * renderFrame(frame) => Promise<string>  (data:image/png;base64,...)
   */
  const startExport = useCallback(async ({ frames, renderFrame, fps = 4, width = 720, loop = true, format = 'gif', watermark = true }) => {
    if (!frames?.length || frames.length < 2) {
      setError(t('export.minFramesHint'));
      setStatus('error');
      return;
    }

    reset();
    setStatus('rendering');

    try {
      // 1. Alle Frames als PNG rendern
      const pngs = [];
      for (let i = 0; i < frames.length; i++) {
        const dataUrl = await renderFrame(frames[i]);
        pngs.push(dataUrl);
        setProgress(Math.round(((i + 1) / frames.length) * 40)); // 0-40%
      }

      // 2. PNGs ans Backend senden
      setStatus('uploading');
      setProgress(45);
      const body = format === 'mp4'
        ? { frames: pngs, fps, width, watermark }
        : { frames: pngs, fps, width, loop };
      const res = await fetch(`${API}/export/${format}`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(body),
      });

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.message ?? `HTTP ${res.status}`);
      }

      const { jobId } = await res.json();
      setStatus('processing');
      setProgress(50);

      // 3. Status pollen
      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch(`${API}/export/status/${jobId}`, { credentials: 'include' });
          const data = await pr.json().catch(() => ({}));
          if (!pr.ok) throw new Error(data.message ?? `HTTP ${pr.status}`);
          setProgress(50 + Math.round((data.progress ?? 0) * 0.5)); // 50-100%
          if (data.status === 'done') {
            clearInterval(pollRef.current);
            setFileUrl(`${API}/export/download/${jobId}`);
            setStatus('done');
            setProgress(100);
          } else if (data.status === 'error') {
            clearInterval(pollRef.current);
            throw new Error(data.message ?? t('errors.generic'));
          }
        } catch (pollErr) {
          clearInterval(pollRef.current);
          setError(pollErr.message);
          setStatus('error');
        }
      }, POLL_INTERVAL_MS);

    } catch (err) {
      clearInterval(pollRef.current);
      setError(err.message);
      setStatus('error');
    }
  }, [reset, t]);

  return { status, progress, fileUrl, error, startExport, reset };
}
