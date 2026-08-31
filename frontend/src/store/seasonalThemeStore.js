/**
 * seasonalThemeStore – Nutzer-Präferenz für saisonale Deko-Themes (aktuell:
 * Halloween). Default AN (Opt-out statt Opt-in): die Deko ist rein visuell,
 * blockiert nichts und lässt sich jederzeit in den Einstellungen abschalten
 * (CLAUDE.md §5.11 keine Dark Patterns – Zwang wäre ein anderes eigenes
 * Theme oder ein Pflichtschritt, ein abschaltbares Default-Extra nicht).
 * `enabled` allein reicht nicht für "aktiv" – siehe useSeasonalThemeActive:
 * das eigentliche Datum (isHalloweenActive) entscheidet zusätzlich mit.
 */
import { create } from 'zustand';
import { isHalloweenActive } from '../utils/seasonalTheme.js';

const useSeasonalThemeStore = create((set) => ({
  enabled: true,
  setEnabled: (enabled) => set({ enabled }),
}));

export function useSeasonalThemeActive() {
  const enabled = useSeasonalThemeStore((s) => s.enabled);
  return enabled && isHalloweenActive();
}

export default useSeasonalThemeStore;
