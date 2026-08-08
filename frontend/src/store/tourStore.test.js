import { describe, it, expect, beforeEach } from 'vitest';
import useTourStore from './tourStore.js';

describe('useTourStore', () => {
  beforeEach(() => {
    useTourStore.setState({ activeTourId: null, stepIndex: 0 });
  });

  it('start(tourId) aktiviert die angegebene Tour bei Schritt 0', () => {
    useTourStore.getState().start('nav');
    expect(useTourStore.getState()).toMatchObject({ activeTourId: 'nav', stepIndex: 0 });
  });

  it('next() erhöht den Schritt-Index', () => {
    useTourStore.getState().start('nav');
    useTourStore.getState().next();
    useTourStore.getState().next();
    expect(useTourStore.getState().stepIndex).toBe(2);
  });

  it('prev() verringert den Schritt-Index, aber nie unter 0', () => {
    useTourStore.getState().start('nav');
    useTourStore.getState().next();
    useTourStore.getState().prev();
    expect(useTourStore.getState().stepIndex).toBe(0);
    useTourStore.getState().prev();
    expect(useTourStore.getState().stepIndex).toBe(0);
  });

  it('skip() deaktiviert die Tour und setzt den Schritt-Index zurück', () => {
    useTourStore.getState().start('nav');
    useTourStore.getState().next();
    useTourStore.getState().skip();
    expect(useTourStore.getState()).toMatchObject({ activeTourId: null, stepIndex: 0 });
  });

  it('finish() deaktiviert die Tour und setzt den Schritt-Index zurück', () => {
    useTourStore.getState().start('nav');
    useTourStore.getState().next();
    useTourStore.getState().next();
    useTourStore.getState().finish();
    expect(useTourStore.getState()).toMatchObject({ activeTourId: null, stepIndex: 0 });
  });

  it('zwei Touren schließen sich gegenseitig aus: start() einer anderen Tour übernimmt sofort', () => {
    useTourStore.getState().start('nav');
    useTourStore.getState().next();
    useTourStore.getState().start('editor');
    expect(useTourStore.getState()).toMatchObject({ activeTourId: 'editor', stepIndex: 0 });
  });
});
