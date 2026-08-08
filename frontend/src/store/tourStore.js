/**
 * tourStore – Zustand einer Onboarding-Tour (ISSUE 023 Nav-Tour, ISSUE 024
 * Editor-Tour). Reiner UI-State, analog announceStore.js/offlineStore.js
 * – kennt keine API-Aufrufe. Das Persistieren des "gesehen"-Status
 * übernimmt TourOverlay.jsx beim Aufruf von skip()/finish().
 *
 * `activeTourId` statt eines bloßen Booleans, weil es zwei unabhängige
 * Touren gibt (Nav-Tour vs. Editor-Tour) – dieser eine Store reicht für
 * beide, da ohnehin nie mehr als eine Tour gleichzeitig laufen kann
 * (start() eines Tour-Ids überschreibt automatisch jede andere).
 */
import { create } from 'zustand';

const useTourStore = create((set, get) => ({
  activeTourId: null,
  stepIndex: 0,
  start: (tourId) => set({ activeTourId: tourId, stepIndex: 0 }),
  next: () => set({ stepIndex: get().stepIndex + 1 }),
  prev: () => set({ stepIndex: Math.max(0, get().stepIndex - 1) }),
  skip: () => set({ activeTourId: null, stepIndex: 0 }),
  finish: () => set({ activeTourId: null, stepIndex: 0 }),
}));

export default useTourStore;
