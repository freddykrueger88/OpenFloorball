/**
 * Header.test.jsx – gruppierte Dropdown-Navigation (UI/UX-Audit
 * 2026-08-28, Ablösung der vormals 13 flachen Nav-Links). Deckt die
 * neue Interaktion ab, die vorher kein Komponententest hatte: Öffnen/
 * Schließen einzelner Gruppen, Escape/Klick-außerhalb, und dass die
 * Tour-Zielattribute (data-tour) für tourSteps.js erhalten bleiben.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import i18n from '../../i18n/i18n.js';
import useAuthStore from '../../store/authStore.js';
import Header from './Header.jsx';

// Sprache deterministisch festlegen (unabhängig vom Sprach-Detector, der
// in jsdom ohne Browser-Locale unvorhersagbar auf 'en' statt 'de' fallen
// kann) – die Assertions unten prüfen konkrete deutsche Label-Texte.
beforeAll(async () => { await i18n.changeLanguage('de'); });

function renderHeader() {
  return render(
    <MemoryRouter initialEntries={['/boards']}>
      <Header />
    </MemoryRouter>
  );
}

describe('Header – gruppierte Navigation', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'coach@example.com' } });
  });

  afterEach(() => {
    useAuthStore.setState({ user: null });
  });

  it('zeigt fünf Gruppen-Trigger und einen separaten Einstellungen-Link, aber keine eingeblendeten Untermenüs', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /Boards/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kader/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spielbetrieb/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Team/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wissen/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toBeInTheDocument();

    // Untermenü-Links sind erst nach Klick auf den Trigger im DOM
    expect(screen.queryByRole('link', { name: 'Kader' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lines' })).not.toBeInTheDocument();
  });

  it('öffnet eine Gruppe per Klick und zeigt ihre Unterpunkte', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Kader/ }));

    expect(screen.getByRole('link', { name: 'Kader' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lines' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Kader/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('schließt eine offene Gruppe bei erneutem Klick auf denselben Trigger', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: /Kader/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'Lines' })).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByRole('link', { name: 'Lines' })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('öffnet nie zwei Gruppen gleichzeitig – eine neue Gruppe schließt die vorherige', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Kader/ }));
    expect(screen.getByRole('link', { name: 'Lines' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Team/ }));
    expect(screen.queryByRole('link', { name: 'Lines' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Umfragen' })).toBeInTheDocument();
  });

  it('schließt die offene Gruppe bei Escape und gibt den Fokus an den Trigger zurück', () => {
    renderHeader();
    const trigger = screen.getByRole('button', { name: /Kader/ });
    fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'Lines' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: 'Lines' })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('schließt die offene Gruppe bei einem Klick außerhalb der Navigation', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: /Kader/ }));
    expect(screen.getByRole('link', { name: 'Lines' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('link', { name: 'Lines' })).not.toBeInTheDocument();
  });

  it('trägt data-tour-Zielattribute für alle fünf Gruppen-Trigger sowie Einstellungen (tourSteps.js)', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /Boards/ })).toHaveAttribute('data-tour', 'nav-group-boards');
    expect(screen.getByRole('button', { name: /Kader/ })).toHaveAttribute('data-tour', 'nav-group-roster');
    expect(screen.getByRole('button', { name: /Spielbetrieb/ })).toHaveAttribute('data-tour', 'nav-group-games');
    expect(screen.getByRole('button', { name: /Team/ })).toHaveAttribute('data-tour', 'nav-group-team');
    expect(screen.getByRole('button', { name: /Wissen/ })).toHaveAttribute('data-tour', 'nav-group-knowledge');
    expect(screen.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute('data-tour', 'nav-settings');
  });

  it('zeigt keine Navigation, solange kein Nutzer eingeloggt ist', () => {
    useAuthStore.setState({ user: null });
    renderHeader();
    expect(screen.queryByRole('button', { name: /Boards/ })).not.toBeInTheDocument();
  });
});
