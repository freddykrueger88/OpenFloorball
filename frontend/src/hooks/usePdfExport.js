/**
 * usePdfExport – PDF-Taktikblatt-Export (Issue #24)
 * Synchroner POST (kein Job-Polling, anders als GIF/MP4 – pdfkit-Erzeugung
 * aus bereits gerenderten PNGs ist schnell genug für eine direkte Antwort).
 * Gleiches Blob-Download-Muster wie useBackup.js.
 */
import { useState, useCallback } from 'react';

function filenameFromDisposition(header, fallback) {
  const match = /filename="([^"]+)"/.exec(header ?? '');
  return match?.[1] ?? fallback;
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function usePdfExport() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const exportPdf = useCallback(async ({ boardName, frames, framesPerPage, paperSize, language }) => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/export/pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardName, frames, framesPerPage, paperSize, language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      downloadBlob(blob, filenameFromDisposition(res.headers.get('Content-Disposition'), 'openfloorball-taktikblatt.pdf'));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  // Spielbericht (Roadmap-Audit, Fortsetzung Phase C) – gleiches
  // synchrones POST+Blob-Download-Muster wie exportPdf, nur ohne
  // Bild-Payload (der Server liest games/game_events/game_squad selbst).
  const exportGameReport = useCallback(async ({ gameId, language }) => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/export/game-report', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      downloadBlob(blob, filenameFromDisposition(res.headers.get('Content-Disposition'), 'openfloorball-spielbericht.pdf'));
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setExporting(false);
    }
  }, []);

  return { exporting, error, exportPdf, exportGameReport };
}
