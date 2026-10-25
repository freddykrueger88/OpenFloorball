/**
 * useAutoSave – Auto-Save alle 30s + debounced bei jeder Änderung
 * Zeigt Status: 'idle' | 'saving' | 'saved' | 'error'
 */
import { useState, useEffect, useRef, useCallback } from 'react';

const DEBOUNCE_MS  = 300;    // kurz nach letzter Änderung (bündelt State-Updates im selben Tick)
const INTERVAL_MS  = 30000;  // 30s Intervall

export function useAutoSave(data, saveFn, enabled = true) {
  const [status,   setStatus  ] = useState('idle');  // idle | saving | saved | offline | error
  const [errorMessage, setErrorMessage] = useState(null);
  const [lastSaved,setLastSaved] = useState(null);
  const debounceRef = useRef(null);
  const intervalRef = useRef(null);
  const dataRef     = useRef(data);
  dataRef.current   = data;

  const save = useCallback(async () => {
    if (!enabled) return;
    setStatus('saving');
    setErrorMessage(null);
    try {
      await saveFn(dataRef.current);
      setStatus('saved');
      setLastSaved(new Date());
      // Nach 3s wieder auf idle
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      // Issue #49 – bei fehlender Verbindung wurde die Änderung bereits
      // in der offlineQueue gepuffert (siehe apiFetch.js), kein
      // Datenverlust – UI zeigt das getrennt von einem echten Fehler
      setStatus(err?.offlineQueued ? 'offline' : 'error');
      // Konkrete Servermeldung (z.B. 413 "Anfrage zu groß") anzeigen,
      // statt nur eines generischen "Fehler beim Speichern".
      setErrorMessage(err?.offlineQueued ? null : (err?.message ?? null));
    }
  }, [saveFn, enabled]);

  // Debounce bei Änderung
  useEffect(() => {
    if (!enabled) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(save, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), enabled]);

  // 30s Intervall
  useEffect(() => {
    if (!enabled) return;
    intervalRef.current = setInterval(save, INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [save, enabled]);

  return { status, errorMessage, lastSaved, saveNow: save };
}
