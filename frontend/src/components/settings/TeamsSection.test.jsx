/**
 * TeamsSection.test.jsx – Vereine-Ausbau: deckt den neuen "Verein
 * gründen"-Hinweis ab, der nur erscheint, solange der Account in keinem
 * Verein ist, und beim Anlegen den `onOrganizationFounded`-Callback an
 * SettingsPage.jsx meldet (dort schaltet das den neu erscheinenden
 * "Vereine"-Tab sichtbar, siehe SettingsPage.jsx).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import i18n from '../../i18n/i18n.js';
import useAuthStore from '../../store/authStore.js';
import TeamsSection from './TeamsSection.jsx';

vi.mock('../../hooks/useTeams.js', () => ({
  useTeams: () => ({
    teams: [],
    error: null,
    fetchTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn(),
    deleteTeam: vi.fn(),
    fetchMembers: vi.fn(),
    inviteMember: vi.fn(),
    updateMemberRole: vi.fn(),
    removeMember: vi.fn(),
  }),
}));

const createOrganization = vi.fn().mockResolvedValue({ _id: 'org-1', name: 'TB Uphusen', role: 'admin' });
const onOrganizationFounded = vi.fn();

function renderSection(organizations = []) {
  return render(
    <TeamsSection
      organizationsApi={{ organizations, error: null, createOrganization }}
      onOrganizationFounded={onOrganizationFounded}
    />
  );
}

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'coach@example.com' } });
  createOrganization.mockClear();
  onOrganizationFounded.mockClear();
});

describe('TeamsSection – "Verein gründen"', () => {
  it('zeigt den Gründen-Hinweis, solange der Account in keinem Verein ist', () => {
    renderSection([]);
    expect(screen.getByRole('heading', { name: 'Verein gründen' })).toBeInTheDocument();
  });

  it('zeigt den Gründen-Hinweis NICHT, sobald bereits ein Verein existiert', () => {
    renderSection([{ _id: 'org-1', name: 'TB Uphusen', role: 'admin' }]);
    expect(screen.queryByRole('heading', { name: 'Verein gründen' })).not.toBeInTheDocument();
  });

  it('legt per Formular einen Verein an und meldet onOrganizationFounded', async () => {
    renderSection([]);
    fireEvent.change(screen.getByPlaceholderText('Name des Vereins'), { target: { value: 'TB Uphusen' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verein anlegen' }));

    expect(createOrganization).toHaveBeenCalledWith('TB Uphusen');
    await vi.waitFor(() => expect(onOrganizationFounded).toHaveBeenCalledTimes(1));
  });
});
