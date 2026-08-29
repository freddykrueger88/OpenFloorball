/**
 * TeamsSection – Teams anlegen/verwalten (ROADMAP Phase 2), UI/UX-Audit
 * Stufe 3 – aus der vormals 1011-Zeilen-SettingsPage.jsx ausgelagert,
 * reines Verschieben ohne Logik-Änderung.
 *
 * Vereine-Ausbau: bekommt den Vereins-Zustand jetzt per `organizationsApi`
 * von SettingsPage.jsx injiziert (dieselbe Instanz wie OrganizationsSection,
 * kein zweiter Fetch). Solange der Account in keinem Verein ist, zeigt
 * diese Section zusätzlich einen unauffälligen "Verein gründen"-Hinweis –
 * der eigentliche "Vereine"-Tab existiert erst, sobald organizations.length
 * > 0 ist (siehe SettingsPage.jsx). Grund: für die meisten Trainer mit
 * genau einem Team IST das Team schon "ihr Verein" (z.B. "TB Uphusen"),
 * eine dauerhaft sichtbare, leere zweite Ebene wäre nur verwirrend.
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { useTeams } from '../../hooks/useTeams.js';
import Button from '../common/Button.jsx';
import TeamSaisonmanagerSettings from './TeamSaisonmanagerSettings.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function TeamsSection({ organizationsApi, onOrganizationFounded }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const {
    teams, error: teamsError,
    fetchTeams, createTeam, deleteTeam,
    fetchMembers, inviteMember, updateMemberRole, removeMember,
  } = useTeams();
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  // Für die optionale "Team einem Verein zuordnen"-Auswahl beim Anlegen
  const { organizations, createOrganization } = organizationsApi;
  const adminOrgs = organizations.filter((o) => o.role === 'admin');

  const [newTeamName,    setNewTeamName]    = useState('');
  const [newTeamOrgId,   setNewTeamOrgId]   = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [membersByTeam,  setMembersByTeam]  = useState({});
  const [inviteForm,     setInviteForm]     = useState({ email: '', role: 'coach' });
  const [foundOrgName,   setFoundOrgName]   = useState('');
  const [foundOrgError,  setFoundOrgError]  = useState(null);

  const handleFoundOrganization = async (e) => {
    e.preventDefault();
    const trimmed = foundOrgName.trim();
    if (!trimmed) return;
    setFoundOrgError(null);
    try {
      await createOrganization(trimmed);
      setFoundOrgName('');
      onOrganizationFounded?.();
    } catch (err) {
      setFoundOrgError(err.message);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    const trimmed = newTeamName.trim();
    if (!trimmed) return;
    try {
      await createTeam(trimmed, newTeamOrgId || undefined);
      setNewTeamName('');
      setNewTeamOrgId('');
    } catch { /* error via hook */ }
  };

  const handleToggleTeam = async (teamId) => {
    if (expandedTeamId === teamId) { setExpandedTeamId(null); return; }
    setExpandedTeamId(teamId);
    if (!membersByTeam[teamId]) {
      try {
        const members = await fetchMembers(teamId);
        setMembersByTeam((prev) => ({ ...prev, [teamId]: members }));
      } catch { /* error via hook */ }
    }
  };

  const handleInvite = async (e, teamId) => {
    e.preventDefault();
    const trimmed = inviteForm.email.trim();
    if (!trimmed) return;
    try {
      const member = await inviteMember(teamId, { email: trimmed, role: inviteForm.role });
      setMembersByTeam((prev) => ({ ...prev, [teamId]: [...(prev[teamId] ?? []), member] }));
      setInviteForm({ email: '', role: 'coach' });
    } catch { /* error via hook */ }
  };

  const handleRoleChange = async (teamId, memberId, role) => {
    try {
      const updated = await updateMemberRole(teamId, memberId, role);
      setMembersByTeam((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).map((m) => m._id === memberId ? updated : m),
      }));
    } catch { /* error via hook */ }
  };

  const handleRemoveMember = async (teamId, memberId) => {
    try {
      await removeMember(teamId, memberId);
      setMembersByTeam((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] ?? []).filter((m) => m._id !== memberId),
      }));
    } catch { /* error via hook */ }
  };

  const handleDeleteTeam = async (teamId) => {
    try {
      await deleteTeam(teamId);
      setExpandedTeamId((prev) => prev === teamId ? null : prev);
    } catch { /* error via hook */ }
  };

  const handleLeaveTeam = async (teamId) => {
    const myMembership = (membersByTeam[teamId] ?? []).find((m) => m.userId === user.id);
    if (!myMembership) return;
    try {
      await removeMember(teamId, myMembership._id);
      await fetchTeams();
      setExpandedTeamId((prev) => prev === teamId ? null : prev);
    } catch { /* error via hook */ }
  };

  return (
    <section className={styles.section}>
      <h2>{t('settings.nav.teams')}</h2>
      <p className={styles.hint}>{t('settings.teams.intro')}</p>

      {teamsError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {teamsError}</p>}

      <form className={styles.subForm} onSubmit={handleCreateTeam}>
        <h3 className={styles.subTitle}>{t('settings.teams.createTitle')}</h3>
        <input
          className={styles.textInput}
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          placeholder={t('settings.teams.namePlaceholder')}
          maxLength={80}
          aria-label={t('settings.teams.namePlaceholder')}
        />
        {adminOrgs.length > 0 && (
          <select
            className={styles.select}
            value={newTeamOrgId}
            onChange={(e) => setNewTeamOrgId(e.target.value)}
            aria-label={t('settings.teams.organizationAriaLabel')}
          >
            <option value="">{t('settings.teams.noOrganization')}</option>
            {adminOrgs.map((o) => (
              <option key={o._id} value={o._id}>{o.name}</option>
            ))}
          </select>
        )}
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!newTeamName.trim()}>
          {t('settings.teams.createBtn')}
        </Button>
      </form>

      {teams.length === 0 ? (
        <p className={styles.hint}>{t('settings.teams.noTeams')}</p>
      ) : (
        <ul className={styles.teamList} role="list">
          {teams.map((team) => (
            <li key={team._id} className={styles.teamRow}>
              <Button
                type="button"
                variant="ghost"
                size="md"
                className={styles.teamHeader}
                onClick={() => handleToggleTeam(team._id)}
                aria-expanded={expandedTeamId === team._id}
              >
                <span>{team.name}</span>
                <span className={styles.roleBadge}>{t(`settings.teams.role.${team.role}`)}</span>
              </Button>

              {expandedTeamId === team._id && (
                <div className={styles.teamDetail}>
                  {team.role === 'owner' && (
                    <form className={styles.subForm} onSubmit={(e) => handleInvite(e, team._id)}>
                      <h3 className={styles.subTitle}>{t('settings.teams.inviteTitle')}</h3>
                      <input
                        type="email"
                        className={styles.textInput}
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder={t('settings.teams.inviteEmailPlaceholder')}
                        aria-label={t('settings.teams.inviteEmailPlaceholder')}
                      />
                      <select
                        className={styles.select}
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                        aria-label={t('settings.teams.inviteRoleAriaLabel')}
                      >
                        <option value="coach">{t('settings.teams.role.coach')}</option>
                        <option value="member">{t('settings.teams.role.member')}</option>
                      </select>
                      <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!inviteForm.email.trim()}>
                        {t('settings.teams.inviteBtn')}
                      </Button>
                    </form>
                  )}

                  {team.role === 'owner' && <TeamSaisonmanagerSettings teamId={team._id} />}

                  <ul className={styles.memberList} role="list">
                    {(membersByTeam[team._id] ?? []).map((m) => (
                      <li key={m._id} className={styles.memberRow}>
                        <span className={styles.memberEmail}>{m.email}</span>
                        {team.role === 'owner' ? (
                          <>
                            <select
                              className={styles.select}
                              value={m.role}
                              onChange={(e) => handleRoleChange(team._id, m._id, e.target.value)}
                              aria-label={t('settings.teams.rowRoleAriaLabel', { email: m.email })}
                            >
                              <option value="owner">{t('settings.teams.role.owner')}</option>
                              <option value="coach">{t('settings.teams.role.coach')}</option>
                              <option value="member">{t('settings.teams.role.member')}</option>
                            </select>
                            <Button
                              variant="danger"
                              size="sm"
                              iconOnly
                              className={styles.smallBtnDanger}
                              onClick={() => handleRemoveMember(team._id, m._id)}
                              aria-label={t('settings.teams.removeMemberAriaLabel', { email: m.email })}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </Button>
                          </>
                        ) : (
                          <span className={styles.roleBadge}>{t(`settings.teams.role.${m.role}`)}</span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className={styles.teamActions}>
                    {team.role === 'owner' ? (
                      <Button variant="danger" size="sm" className={styles.smallBtnDanger} onClick={() => handleDeleteTeam(team._id)}>
                        {t('settings.teams.deleteBtn')}
                      </Button>
                    ) : (
                      <Button variant="danger" size="sm" className={styles.smallBtnDanger} onClick={() => handleLeaveTeam(team._id)}>
                        {t('settings.teams.leaveBtn')}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {organizations.length === 0 && (
        <form className={styles.subForm} onSubmit={handleFoundOrganization}>
          <h3 className={styles.subTitle}>{t('settings.teams.foundOrganizationTitle')}</h3>
          <p className={styles.hint}>{t('settings.teams.foundOrganizationHint')}</p>
          <input
            className={styles.textInput}
            value={foundOrgName}
            onChange={(e) => setFoundOrgName(e.target.value)}
            placeholder={t('settings.organizations.namePlaceholder')}
            maxLength={80}
            aria-label={t('settings.organizations.namePlaceholder')}
          />
          <Button type="submit" variant="secondary" size="md" className={styles.submitBtn} disabled={!foundOrgName.trim()}>
            {t('settings.organizations.createBtn')}
          </Button>
          {foundOrgError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {foundOrgError}</p>}
        </form>
      )}
    </section>
  );
}
