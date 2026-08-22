/**
 * GamesPage – Übersichtsseite aller Spiele (Live-Spielnotizen,
 * Backlog "Erweiterung: Live-Unterstützung"). Kachel-Ansicht mit
 * Anlegen, Umbenennen, Löschen – analog TrainingsPage.jsx.
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Volleyball, Plus, Download } from 'lucide-react';
import { useGames } from '../hooks/useGames.js';
import { useTeams } from '../hooks/useTeams.js';
import GameCard from '../components/games/GameCard.jsx';
import Button from '../components/common/Button.jsx';
import buttonStyles from '../components/common/Button.module.css';
import styles from './GamesPage.module.css';

export default function GamesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { games, loading, error, fetchGames, createGame, updateGame, deleteGame, canAddGame } = useGames();
  // Analog TrainingsPage.jsx: eigene Teams laden, um Spiele optional
  // team-geteilt statt rein persönlich anzulegen.
  const { teams, fetchTeams } = useTeams();

  const [creating,   setCreating  ] = useState(false);
  const [newOpponent, setNewOpponent] = useState('');
  const [newPlayedAt, setNewPlayedAt] = useState('');
  const [newTeamId,   setNewTeamId  ] = useState('');

  const load = useCallback(async () => {
    try { await fetchGames(); } catch { /* error via hook */ }
  }, [fetchGames]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const teamsICanShareWith = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const game = await createGame(newOpponent.trim(), newPlayedAt || null, newTeamId === '' ? null : newTeamId);
      setCreating(false);
      setNewOpponent('');
      setNewPlayedAt('');
      setNewTeamId('');
      navigate(`/games/${game._id}`);
    } catch { /* error via hook */ }
  };

  const handleRename = async (id, opponent) => {
    try {
      const current = games.find((g) => g._id === id);
      await updateGame(id, { opponent }, {
        baselineUpdatedAt: current?.updatedAt ?? null, label: current?.opponent || t('games.noOpponent'),
      });
    } catch { /* error via hook */ }
  };

  const handleDelete = async (id) => {
    try {
      const current = games.find((g) => g._id === id);
      await deleteGame(id, {
        baselineUpdatedAt: current?.updatedAt ?? null, label: current?.opponent || t('games.noOpponent'),
      });
    } catch { /* error via hook */ }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('nav.games')}</h1>
          <p className={styles.subtitle}>
            {games.length > 0 ? t('games.count', { count: games.length }) : t('games.noGamesYet')}
          </p>
        </div>
      </header>

      <div className={styles.actionsBar}>
        {creating ? (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              autoFocus
              className={styles.createInput}
              value={newOpponent}
              onChange={(e) => setNewOpponent(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }}
              placeholder={t('games.opponentPlaceholder')}
              maxLength={100}
              aria-label={t('games.opponentPlaceholder')}
            />
            <input
              type="date"
              className={styles.createInput}
              value={newPlayedAt}
              onChange={(e) => setNewPlayedAt(e.target.value)}
              aria-label={t('games.dateLabel')}
            />
            {teamsICanShareWith.length > 0 && (
              <select
                className={styles.createInput}
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                aria-label={t('games.teamAriaLabel')}
              >
                <option value="">{t('games.personalOption')}</option>
                {teamsICanShareWith.map((tm) => (
                  <option key={tm._id} value={tm._id}>{tm.name}</option>
                ))}
              </select>
            )}
            <Button type="submit" variant="primary" size="md" className={styles.newBtn} disabled={loading}>
              {t('games.confirmCreate')}
            </Button>
            <Button type="button" variant="secondary" size="md" onClick={() => setCreating(false)}>
              {t('games.cancelCreate')}
            </Button>
          </form>
        ) : (
          <Button
            variant="primary"
            size="md"
            className={styles.newBtn}
            onClick={() => setCreating(true)}
            disabled={!canAddGame}
            aria-label={t('games.newGameAriaLabel')}
          >
            <Plus size={16} aria-hidden="true" /> {t('games.newGame')}
          </Button>
        )}
        {games.length > 0 && (
          // Statistik-Architektur Phase 7: reiner GET-Download, daher ein
          // natives <a> statt eines Button-onClick-Handlers – der Browser
          // übernimmt Content-Disposition/Dateiname direkt, kein
          // JS-Blob-Umweg nötig (anders als der POST-basierte PDF-Export).
          <a href="/api/export/games.csv" className={`${buttonStyles.btn} ${buttonStyles.secondary} ${buttonStyles.md}`}>
            <Download size={16} aria-hidden="true" /> {t('games.exportCsv')}
          </a>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      {loading && games.length === 0 ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label={t('games.loadingGames')}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon}><Volleyball size={16} aria-hidden="true" /></div>
          <h2>{t('games.noGamesYet')}</h2>
          <p>{t('games.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.grid} role="list" aria-label={t('nav.games')}>
          {games.map((game) => (
            <li key={game._id}>
              <GameCard
                game={game}
                teamName={game.teamId ? teams.find((tm) => tm._id === game.teamId)?.name : null}
                onClick={() => navigate(`/games/${game._id}`)}
                onRename={(opponent) => handleRename(game._id, opponent)}
                onDelete={() => handleDelete(game._id)}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
