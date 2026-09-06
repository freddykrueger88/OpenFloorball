/**
 * SupportPage.test.jsx – Support-Seite: rendert Spenden- und
 * Mitmach-Optionen aus der Konfiguration (leicht erweiterbar).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import i18n from '../i18n/i18n.js';
import SupportPage from './SupportPage.jsx';

beforeAll(async () => { await i18n.changeLanguage('de'); });

describe('SupportPage', () => {
  it('zeigt Titel, Spenden-Optionen und Mitmach-Optionen', () => {
    render(<SupportPage />);

    expect(screen.getByRole('heading', { name: 'OpenFloorball unterstützen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Finanzielle Unterstützung' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beim Projekt mithelfen' })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /GitHub Sponsors/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Collective/ })).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Fehler melden/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Code beitragen/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Übersetzen/ })).toBeInTheDocument();
  });

  it('öffnet externe Optionen in einem neuen Tab', () => {
    render(<SupportPage />);

    const githubLink = screen.getByRole('link', { name: /GitHub Sponsors/ });
    expect(githubLink).toHaveAttribute('href', 'https://github.com/sponsors/freddykrueger88');
    expect(githubLink).toHaveAttribute('target', '_blank');
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});