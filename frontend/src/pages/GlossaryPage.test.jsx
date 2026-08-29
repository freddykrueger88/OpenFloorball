/**
 * GlossaryPage.test.jsx – Floorball-Lexikon (Onboarding-Ausbau). Deckt
 * Suche, Kategorie-Filter und den Leer-Zustand ab.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../i18n/i18n.js';
import GlossaryPage from './GlossaryPage.jsx';

beforeAll(async () => { await i18n.changeLanguage('de'); });

describe('GlossaryPage', () => {
  it('zeigt den Titel und eine Liste von Begriffen', () => {
    render(<GlossaryPage />);
    expect(screen.getByRole('heading', { name: 'Floorball-Lexikon' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Torhüter/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bully/ })).toBeInTheDocument();
  });

  it('filtert per Suchfeld auf passende Begriffe', () => {
    render(<GlossaryPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Schlenzer' } });

    expect(screen.getByRole('button', { name: /Schlenzer/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bully/ })).not.toBeInTheDocument();
  });

  it('findet einen Begriff auch über ein Synonym', () => {
    render(<GlossaryPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Goalie' } });

    expect(screen.getByRole('button', { name: /Torhüter/ })).toBeInTheDocument();
  });

  it('filtert per Kategorie auf "Positionen"', () => {
    render(<GlossaryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Positionen' }));

    expect(screen.getByRole('button', { name: /Torhüter/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bully/ })).not.toBeInTheDocument();
  });

  it('zeigt einen Leer-Zustand, wenn nichts zur Suche passt', () => {
    render(<GlossaryPage />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyz-kein-treffer' } });

    expect(screen.getByText('Keine Begriffe gefunden.')).toBeInTheDocument();
  });

  it('klappt einen Begriff per Klick auf und zeigt Detailtext samt Querverweisen', () => {
    render(<GlossaryPage />);
    fireEvent.click(screen.getByRole('button', { name: /Torhüter/ }));

    expect(screen.getByText('Siehe auch:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verteidiger' })).toBeInTheDocument();
  });
});
