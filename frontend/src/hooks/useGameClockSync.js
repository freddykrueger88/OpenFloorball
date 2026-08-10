/**
 * useGameClockSync – Echtzeit-Sync der Spieluhr über mehrere Geräte/
 * Tabs (Roadmap-Audit). Bewusst ein eigener, kleiner Hook statt
 * usePresence.js zu verallgemeinern – vermeidet jedes Risiko für die
 * bereits produktiv laufende Board-Kollaboration, etwas doppelter
 * Verbindungs-Code dafür saubere Trennung. Gleiches Connect/Reconnect-
 * Muster wie usePresence.js, nur mit dem 'clock'-Nachrichtentyp.
 *
 * Reiner Nice-to-have: schlägt die Verbindung fehl, bleibt die Uhr
 * einfach nur auf diesem einen Gerät aktuell (normaler REST-Weg bleibt
 * die Quelle der Wahrheit) – kein Fehler-UI.
 */
import { useEffect, useRef, useCallback } from 'react';

const RECONNECT_DELAY_MS = 3000;

export function useGameClockSync(gameId, { onClockUpdate } = {}) {
  const wsRef = useRef(null);
  const onClockUpdateRef = useRef(onClockUpdate);
  onClockUpdateRef.current = onClockUpdate;

  useEffect(() => {
    if (!gameId) return undefined;
    let cancelled = false;
    let reconnectTimer = null;

    const connect = () => {
      if (cancelled) return;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/ws/presence?gameId=${gameId}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'clock') {
            onClockUpdateRef.current?.({
              clockPeriod: msg.clockPeriod,
              clockStatus: msg.clockStatus,
              clockElapsedSeconds: msg.clockElapsedSeconds,
              clockStartedAt: msg.clockStartedAt,
            });
          }
        } catch {
          // Kaputte Nachricht ignorieren – kein kritischer Pfad
        }
      };
      ws.onclose = () => {
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [gameId]);

  const pingClockUpdate = useCallback(() => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'clock' }));
  }, []);

  return { pingClockUpdate };
}
