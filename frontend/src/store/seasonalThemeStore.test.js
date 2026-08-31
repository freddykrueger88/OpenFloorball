import { describe, it, expect, beforeEach } from 'vitest';
import useSeasonalThemeStore from './seasonalThemeStore.js';

describe('useSeasonalThemeStore', () => {
  beforeEach(() => {
    useSeasonalThemeStore.setState({ enabled: true });
  });

  it('ist standardmäßig aktiviert (Opt-out statt Opt-in)', () => {
    expect(useSeasonalThemeStore.getState().enabled).toBe(true);
  });

  it('setEnabled(false) schaltet die Präferenz ab', () => {
    useSeasonalThemeStore.getState().setEnabled(false);
    expect(useSeasonalThemeStore.getState().enabled).toBe(false);
  });
});
