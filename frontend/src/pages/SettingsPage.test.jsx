/**
 * SettingsPage.test.jsx – Vereine-Ausbau: der "Vereine"-Tab existiert nur,
 * solange der Account bereits Mitglied eines Vereins ist (siehe
 * SettingsPage.jsx-Kommentar) – für die meisten Trainer mit genau einem
 * Team ist der Verein sonst nur eine verwirrende, leere zweite Ebene.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import i18n from '../i18n/i18n.js';
import useAuthStore from '../store/authStore.js';
import SettingsPage from './SettingsPage.jsx';

let mockOrganizations = [];

vi.mock('../hooks/useSettings.js', () => ({
  useSettings: () => ({ settings: {}, loading: false, updateSettings: vi.fn() }),
}));

vi.mock('../hooks/useOrganizations.js', () => ({
  useOrganizations: () => ({
    organizations: mockOrganizations,
    error: null,
    fetchOrganizations: vi.fn().mockResolvedValue(mockOrganizations),
    createOrganization: vi.fn(),
  }),
}));

vi.mock('../hooks/useTeams.js', () => ({
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

function renderSettingsPage() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsPage />
    </MemoryRouter>
  );
}

beforeAll(async () => { await i18n.changeLanguage('de'); });

beforeEach(() => {
  useAuthStore.setState({ user: { id: 'u1', email: 'coach@example.com', role: 'user' } });
});

describe('SettingsPage – Sichtbarkeit des "Vereine"-Tabs', () => {
  it('zeigt keinen "Vereine"-Tab, solange der Account in keinem Verein ist', () => {
    mockOrganizations = [];
    renderSettingsPage();
    expect(screen.queryByRole('tab', { name: 'Vereine' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Teams' })).toBeInTheDocument();
  });

  it('zeigt den "Vereine"-Tab, sobald der Account Mitglied eines Vereins ist', () => {
    mockOrganizations = [{ _id: 'org-1', name: 'TB Uphusen', role: 'admin' }];
    renderSettingsPage();
    expect(screen.getByRole('tab', { name: 'Vereine' })).toBeInTheDocument();
  });
});
