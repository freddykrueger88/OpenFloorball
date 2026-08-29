/**
 * RosterPage – Verwaltung des zentralen Team-Kaders (Issue #53)
 * Name + Rückennummer + Position, wiederverwendbar über alle Boards
 * hinweg. Rein optional – Board-Spieler bleiben frei editierbar.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2, Users } from 'lucide-react';
import { useRoster } from '../hooks/useRoster.js';
import { useTeams } from '../hooks/useTeams.js';
import Button from '../components/common/Button.jsx';
import styles from './RosterPage.module.css';

const ROLES = ['TW', 'V', 'C', 'S'];

export default function RosterPage() {
  const { t } = useTranslation();
  const {
    rosterPlayers, loading, error,
    fetchRoster, addRosterPlayer, updateRosterPlayer, deleteRosterPlayer, canAddRosterPlayer,
  } = useRoster();
  // ROADMAP Phase 2: eigene Teams laden, um Kader-Einträge optional
  // team-geteilt statt rein persönlich anzulegen.
  const { teams, fetchTeams, fetchMembers } = useTeams();

  const [name,   setName  ] = useState('');
  const [number, setNumber] = useState('');
  const [role,   setRole  ] = useState('');
  const [teamId, setTeamId] = useState('');
  // Spieler-Dashboard-Ausbau: Login-Account je team-geteiltem Kader-Eintrag
  // verknüpfbar machen, damit der verknüpfte Account "seine" Statistiken/
  // sein "nächstes Spiel" auf /dashboard sehen kann. Mitgliederliste je
  // benötigtem Team wird lazy nachgeladen (kleine Vereine haben meist
  // ohnehin nur ein Team).
  const [membersByTeam, setMembersByTeam] = useState({});

  const load = useCallback(async () => {
    try { await fetchRoster(); } catch { /* error via hook */ }
  }, [fetchRoster]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  useEffect(() => {
    const teamIds = [...new Set(rosterPlayers.map((p) => p.teamId).filter(Boolean))];
    teamIds.forEach((id) => {
      if (membersByTeam[id]) return;
      fetchMembers(id).then((members) => {
        setMembersByTeam((prev) => ({ ...prev, [id]: members }));
      }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rosterPlayers, fetchMembers]);

  const teamsICanShareWith = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await addRosterPlayer({
        name: trimmed,
        jerseyNumber: number === '' ? null : Number(number),
        role: role === '' ? null : role,
        teamId: teamId === '' ? null : teamId,
      });
      setName(''); setNumber(''); setRole('');
    } catch { /* error via hook */ }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('roster.title')}</h1>
          <p className={styles.subtitle}>
            {rosterPlayers.length > 0
              ? t('roster.count', { count: rosterPlayers.length })
              : t('roster.noPlayersYet')}
          </p>
        </div>
      </header>

      <form className={styles.addForm} onSubmit={handleAdd}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('roster.namePlaceholder')}
          maxLength={40}
          aria-label={t('roster.nameAriaLabel')}
        />
        <input
          type="number"
          className={styles.numberInput}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={t('roster.numberPlaceholder')}
          min={0}
          max={99}
          aria-label={t('roster.numberAriaLabel')}
        />
        <select
          className={styles.roleSelect}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label={t('roster.roleAriaLabel')}
        >
          <option value="">{t('roster.roleNone')}</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        {teamsICanShareWith.length > 0 && (
          <select
            className={styles.roleSelect}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            aria-label={t('roster.teamAriaLabel')}
          >
            <option value="">{t('roster.personalOption')}</option>
            {teamsICanShareWith.map((tm) => (
              <option key={tm._id} value={tm._id}>{tm.name}</option>
            ))}
          </select>
        )}
        <Button type="submit" variant="primary" size="md" disabled={loading || !name.trim() || !canAddRosterPlayer}>
          {t('roster.add')}
        </Button>
      </form>
      {!canAddRosterPlayer && <p className={styles.limitHint}>{t('roster.limitHint')}</p>}

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {rosterPlayers.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon} aria-hidden="true"><Users size={40} aria-hidden="true" /></div>
          <p>{t('roster.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.list} role="list" aria-label={t('roster.title')}>
          {rosterPlayers.map((player) => (
            <li key={player._id} className={styles.row}>
              <input
                className={styles.rowNameInput}
                defaultValue={player.name}
                onBlur={(e) => {
                  const trimmed = e.target.value.trim();
                  if (trimmed && trimmed !== player.name) {
                    updateRosterPlayer(player._id, { name: trimmed }, {
                      baselineUpdatedAt: player.updatedAt, label: player.name,
                    });
                  } else e.target.value = player.name;
                }}
                maxLength={40}
                aria-label={t('roster.rowNameAriaLabel', { name: player.name })}
              />
              <input
                type="number"
                className={styles.rowNumberInput}
                defaultValue={player.jerseyNumber ?? ''}
                onBlur={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  if (val !== player.jerseyNumber) {
                    updateRosterPlayer(player._id, { jerseyNumber: val }, {
                      baselineUpdatedAt: player.updatedAt, label: player.name,
                    });
                  }
                }}
                min={0}
                max={99}
                aria-label={t('roster.rowNumberAriaLabel', { name: player.name })}
              />
              <select
                className={styles.rowRoleSelect}
                value={player.role ?? ''}
                onChange={(e) => updateRosterPlayer(player._id, { role: e.target.value === '' ? null : e.target.value }, {
                  baselineUpdatedAt: player.updatedAt, label: player.name,
                })}
                aria-label={t('roster.rowRoleAriaLabel', { name: player.name })}
              >
                <option value="">{t('roster.roleNone')}</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {player.teamId && (
                <span className={styles.teamBadge}>
                  {teams.find((tm) => tm._id === player.teamId)?.name ?? t('roster.teamBadgeFallback')}
                </span>
              )}
              {player.teamId && membersByTeam[player.teamId] && (
                <select
                  className={styles.rowRoleSelect}
                  value={player.linkedUserId ?? ''}
                  onChange={(e) => updateRosterPlayer(player._id, { linkedUserId: e.target.value === '' ? null : e.target.value }, {
                    baselineUpdatedAt: player.updatedAt, label: player.name,
                  })}
                  aria-label={t('roster.linkedUserAriaLabel', { name: player.name })}
                  title={t('roster.linkedUserHint')}
                >
                  <option value="">{t('roster.linkedUserNone')}</option>
                  {membersByTeam[player.teamId].map((m) => (
                    <option key={m.userId} value={m.userId}>{m.email}</option>
                  ))}
                </select>
              )}
              <Button
                variant="danger"
                size="sm"
                iconOnly
                className={styles.deleteBtn}
                onClick={() => deleteRosterPlayer(player._id, {
                  baselineUpdatedAt: player.updatedAt, label: player.name,
                })}
                aria-label={t('roster.deleteAriaLabel', { name: player.name })}
                title={t('roster.deleteTitle')}
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
