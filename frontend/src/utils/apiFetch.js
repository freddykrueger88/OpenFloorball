/**
 * apiFetch – Gemeinsamer fetch-Wrapper für alle Hook-basierten API-Aufrufe
 * (Boards, Frames, Lines). Leitet bei 401 zum Login um (Session abgelaufen),
 * analog zum Axios-Interceptor in utils/api.js – außer bei Login/Register
 * selbst, wo ein 401 lediglich falsche Zugangsdaten bedeutet.
 *
 * Issue #49 – Offline-Modus: schlägt ein PUT/DELETE (immer eine
 * bestehende, bereits per ID referenzierte Ressource – POST/Neuanlage
 * wird bewusst NICHT gepuffert, siehe offlineQueue.js) wegen eines
 * echten Netzwerkfehlers fehl (nicht wegen einer normalen 4xx/5xx-
 * Serverantwort), wird der Request in der offlineQueue gepuffert statt
 * verloren zu gehen. Der geworfene Error trägt `offlineQueued: true`,
 * damit aufrufender Code (z.B. useAutoSave.js) das von einem echten
 * Fehler unterscheiden kann.
 *
 * ROADMAP Phase 4: optionaler dritter Parameter `offlineMeta` (genutzt
 * von Boards/Frames/Trainingseinheiten/Kader, siehe useBoardsApi.js/
 * useFrames.js/useTrainingSessions.js/useRoster.js) wird nur
 * durchgereicht, ermöglicht offlineSync.js später eine Konfliktprüfung
 * vor dem erneuten Abschicken.
 */
import { enqueueWrite, getQueueCounts } from './offlineQueue.js';
import useOfflineStore from '../store/offlineStore.js';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];
const QUEUEABLE_METHODS = ['PUT', 'DELETE'];

export async function apiFetch(url, options = {}, offlineMeta = {}) {
  const method = (options.method ?? 'GET').toUpperCase();

  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include',
      ...options,
    });
  } catch (networkErr) {
    if (!QUEUEABLE_METHODS.includes(method)) throw networkErr;

    await enqueueWrite({ url, method, body: options.body, ...offlineMeta });
    const counts = await getQueueCounts();
    useOfflineStore.getState().setQueueLength(counts.pending);
    useOfflineStore.getState().setConflictCount(counts.conflict);
    useOfflineStore.getState().setOnline(false);

    const err = new Error('Offline – Änderung wird synchronisiert, sobald wieder online');
    err.offlineQueued = true;
    throw err;
  }

  const json = await res.json();

  if (!res.ok) {
    const isAuthEndpoint = AUTH_ENDPOINTS.some((p) => url.includes(p));
    // Ohne diesen Guard löst ein 401 für einen nicht eingeloggten Besucher,
    // der schon auf /login ist (z.B. durch einen global gemounteten Hook,
    // der unbedingt beim Mount fetcht), einen window.location.href-Reload
    // aus – der erneut denselben 401 provoziert: Reload-Endlosschleife.
    // Siehe analoger Guard im Axios-Interceptor in utils/api.js.
    const alreadyOnLogin = window.location.pathname === '/login';
    if (res.status === 401 && !isAuthEndpoint && !alreadyOnLogin) {
      window.location.href = '/login';
    }
    const err = new Error(json.message ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return json.data;
}
