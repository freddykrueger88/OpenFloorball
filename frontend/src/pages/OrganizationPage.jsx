/**
 * OrganizationPage – Verein-Dashboard (Roadmap-Audit: "Vereinsebene
 * ausbauen"). Bisher war ein Verein nur ein aufklappbares Listenelement
 * in den Einstellungen (siehe OrganizationsSection.jsx, jetzt auf
 * Anlegen-Formular + Liste reduziert). Diese Seite übernimmt die
 * Mitgliederverwaltung 1:1 von dort (nicht dupliziert) und ergänzt neu
 * sichtbare Teams dieses Vereins – bisher komplett unsichtbar, obwohl
 * das Backend `teams.organization_id` längst kennt.
 *
 * Team-Liste bewusst per Client-Filter auf die bereits vorhandene,
 * korrekt scope-geprüfte `GET /api/teams`-Antwort (kein neuer
 * Endpunkt nötig) – ein Vereins-Admin sieht dort per bestehender
 * UNION-Query in teamsController.js bereits ALLE Teams des Vereins
 * (role: 'org_admin'), ein einfaches Vereinsmitglied dagegen nur
 * Teams, in denen es selbst Mitglied ist (bewusstes, unverändertes
 * Datensparsamkeits-Verhalten).
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import useAuthStore from '../store/authStore.js';
import { useOrganizations } from '../hooks/useOrganizations.js';
import { useTeams } from '../hooks/useTeams.js';
import Button from '../components/common/Button.jsx';
import styles from './SettingsPage.module.css';
import pageStyles from './OrganizationPage.module.css';

export default function OrganizationPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { user } = useAuthStore();
  const {
    error: orgError,
    fetchOrganization, renameOrganization, deleteOrganization,
    fetchMembers, inviteMember, updateMemberRole, removeMember, fetchSchedule, fetchCoaches,
  } = useOrganizations();
  const { teams, fetchTeams, createTeam } = useTeams();

  const [org,            setOrg           ] = useState(null);
  const [loading,        setLoading       ] = useState(true);
  const [loadError,      setLoadError     ] = useState(null);
  const [editingName,    setEditingName   ] = useState(false);
  const [name,           setName          ] = useState('');
  const [members,        setMembers       ] = useState([]);
  const [inviteForm,     setInviteForm    ] = useState({ email: '', role: 'member' });
  const [newTeamName,    setNewTeamName   ] = useState('');
  const [schedule,       setSchedule      ] = useState([]);
  const [coaches,        setCoaches       ] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedOrg, loadedMembers] = await Promise.all([fetchOrganization(id), fetchMembers(id)]);
      setOrg(loadedOrg);
      setName(loadedOrg.name);
      setMembers(loadedMembers);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchOrganization, fetchMembers, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const orgTeams = teams.filter((tm) => tm.organizationId === id);
  const isAdmin = org?.role === 'admin';

  useEffect(() => {
    if (isAdmin) fetchSchedule(id).then(setSchedule).catch(() => {});
  }, [isAdmin, fetchSchedule, id]);

  useEffect(() => {
    if (isAdmin) fetchCoaches(id).then(setCoaches).catch(() => {});
  }, [isAdmin, fetchCoaches, id]);

  const commitName = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (!trimmed || trimmed === org.name) { setName(org.name); return; }
    try {
      const updated = await renameOrganization(id, trimmed);
      setOrg((prev) => ({ ...prev, ...updated }));
    } catch {
      setName(org.name);
    }
  };

  const handleDelete = async () => {
    try { await deleteOrganization(id); } catch { /* error via hook */ }
  };

  const handleLeave = async () => {
    const myMembership = members.find((m) => m.userId === user.id);
    if (!myMembership) return;
    try { await removeMember(id, myMembership._id); } catch { /* error via hook */ }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    const trimmed = inviteForm.email.trim();
    if (!trimmed) return;
    try {
      const member = await inviteMember(id, { email: trimmed, role: inviteForm.role });
      setMembers((prev) => [...prev, member]);
      setInviteForm({ email: '', role: 'member' });
    } catch { /* error via hook */ }
  };

  const handleRoleChange = async (memberId, role) => {
    try {
      const updated = await updateMemberRole(id, memberId, role);
      setMembers((prev) => prev.map((m) => m._id === memberId ? updated : m));
    } catch { /* error via hook */ }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      await removeMember(id, memberId);
      setMembers((prev) => prev.filter((m) => m._id !== memberId));
    } catch { /* error via hook */ }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    const trimmed = newTeamName.trim();
    if (!trimmed) return;
    try {
      await createTeam(trimmed, id);
      setNewTeamName('');
    } catch { /* error via hook */ }
  };

  if (loading && !org) {
    return <main className={styles.page} id="main-content"><p className={styles.loadingMsg}>{t('organization.loading')}</p></main>;
  }
  if (!org) {
    return (
      <main className={styles.page} id="main-content">
        {loadError && <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {loadError}</p>}
      </main>
    );
  }

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <Link to="/settings" className={styles.backLink} aria-label={t('organization.backToSettings')}>←</Link>
        {editingName ? (
          <input
            className={styles.textInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') { setName(org.name); setEditingName(false); }
            }}
            maxLength={80}
            aria-label={t('organization.renameAriaLabel')}
            autoFocus
          />
        ) : (
          <h1
            className={styles.title}
            onDoubleClick={() => isAdmin && setEditingName(true)}
            title={isAdmin ? t('organization.renameTitle') : undefined}
          >
            {org.name}
          </h1>
        )}
      </header>

      <div className={pageStyles.wrap}>
        {(orgError || loadError) && (
          <p className={styles.msgError}><AlertTriangle size={16} aria-hidden="true" /> {orgError ?? loadError}</p>
        )}

        <section className={styles.section}>
          <h2>{t('settings.nav.organizations')}</h2>

          {isAdmin && (
            <form className={styles.subForm} onSubmit={handleInvite}>
              <h3 className={styles.subTitle}>{t('settings.organizations.inviteTitle')}</h3>
              <input
                type="email"
                className={styles.textInput}
                value={inviteForm.email}
                onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                placeholder={t('settings.organizations.inviteEmailPlaceholder')}
                aria-label={t('settings.organizations.inviteEmailPlaceholder')}
              />
              <select
                className={styles.select}
                value={inviteForm.role}
                onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                aria-label={t('settings.organizations.inviteRoleAriaLabel')}
              >
                <option value="admin">{t('settings.organizations.role.admin')}</option>
                <option value="member">{t('settings.organizations.role.member')}</option>
              </select>
              <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!inviteForm.email.trim()}>
                {t('settings.organizations.inviteBtn')}
              </Button>
            </form>
          )}

          <ul className={styles.memberList} role="list">
            {members.map((m) => (
              <li key={m._id} className={styles.memberRow}>
                <span className={styles.memberEmail}>{m.email}</span>
                {isAdmin ? (
                  <>
                    <select
                      className={styles.select}
                      value={m.role}
                      onChange={(e) => handleRoleChange(m._id, e.target.value)}
                      aria-label={t('settings.organizations.rowRoleAriaLabel', { email: m.email })}
                    >
                      <option value="admin">{t('settings.organizations.role.admin')}</option>
                      <option value="member">{t('settings.organizations.role.member')}</option>
                    </select>
                    <Button
                      variant="danger"
                      size="sm"
                      iconOnly
                      className={styles.smallBtnDanger}
                      onClick={() => handleRemoveMember(m._id)}
                      aria-label={t('settings.organizations.removeMemberAriaLabel', { email: m.email })}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <span className={styles.roleBadge}>{t(`settings.organizations.role.${m.role}`)}</span>
                )}
              </li>
            ))}
          </ul>

          <div className={styles.teamActions}>
            {isAdmin ? (
              <Button variant="danger" size="sm" className={styles.smallBtnDanger} onClick={handleDelete}>
                {t('settings.organizations.deleteBtn')}
              </Button>
            ) : (
              <Button variant="danger" size="sm" className={styles.smallBtnDanger} onClick={handleLeave}>
                {t('settings.organizations.leaveBtn')}
              </Button>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <h2>{t('organization.teamsHeading')}</h2>
          <p className={styles.hint}>{t('organization.teamsHint')}</p>

          {orgTeams.length === 0 ? (
            <p className={styles.hint}>{t('organization.noTeamsYet')}</p>
          ) : (
            <ul className={styles.teamList} role="list">
              {orgTeams.map((tm) => (
                <li key={tm._id} className={styles.teamRow}>
                  <div className={pageStyles.teamRowContent}>
                    <span>{tm.name}</span>
                    <span className={styles.roleBadge}>{t(`settings.teams.role.${tm.role}`)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isAdmin && (
            <form className={styles.subForm} onSubmit={handleCreateTeam}>
              <h3 className={styles.subTitle}>{t('organization.createTeamTitle')}</h3>
              <input
                className={styles.textInput}
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder={t('organization.createTeamPlaceholder')}
                maxLength={80}
                aria-label={t('organization.createTeamPlaceholder')}
              />
              <Button type="submit" variant="primary" size="md" className={styles.submitBtn} disabled={!newTeamName.trim()}>
                {t('organization.createTeamBtn')}
              </Button>
            </form>
          )}
        </section>

        {isAdmin && (
          <section className={styles.section}>
            <h2>{t('organization.scheduleHeading')}</h2>
            <p className={styles.hint}>{t('organization.scheduleHint')}</p>

            {schedule.length === 0 ? (
              <p className={styles.hint}>{t('organization.scheduleEmpty')}</p>
            ) : (
              <ul className={styles.teamList} role="list">
                {schedule.map((item) => (
                  <li key={`${item.type}-${item._id}`} className={styles.teamRow}>
                    <div className={pageStyles.teamRowContent}>
                      <span>{item.date} · {item.teamName} · {item.title}</span>
                      <span className={styles.roleBadge}>{t(`organization.scheduleType.${item.type}`)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {isAdmin && (
          <section className={styles.section}>
            <h2>{t('organization.coachesHeading')}</h2>
            <p className={styles.hint}>{t('organization.coachesHint')}</p>

            {coaches.length === 0 ? (
              <p className={styles.hint}>{t('organization.coachesEmpty')}</p>
            ) : (
              <ul className={styles.teamList} role="list">
                {coaches.map((c) => (
                  <li key={`${c.teamId}-${c.userId}`} className={styles.teamRow}>
                    <div className={pageStyles.teamRowContent}>
                      <span>{c.teamName} · {c.email}</span>
                      <span className={styles.roleBadge}>{t(`settings.teams.role.${c.role}`)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
