/**
 * LinesPage – Lines: taktische Zusammenstellungen echter Kader-Spieler
 * (fachlicher Umbau, siehe linesController.js). Ein Kader-Spieler darf in
 * beliebig vielen Lines vorkommen – das Hinzufügen eines Spielers zu einer
 * Line entfernt ihn NICHT aus einer anderen.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Layers, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { useLines } from '../hooks/useLines.js';
import { useRoster } from '../hooks/useRoster.js';
import { useTeams } from '../hooks/useTeams.js';
import Button from '../components/common/Button.jsx';
import SeasonLineChemieSection from '../components/lineStats/SeasonLineChemieSection.jsx';
import styles from './LinesPage.module.css';

const TYPE_OPTIONS = ['offense', 'defense', 'special'];

export default function LinesPage() {
  const { t } = useTranslation();
  const {
    lines, loading, error,
    fetchLines, createLine, updateLine, deleteLine, addPlayer, removePlayer, setActive, canAddLine,
  } = useLines();
  const { rosterPlayers, fetchRoster } = useRoster();
  const { teams, fetchTeams } = useTeams();

  const [creating,  setCreating ] = useState(false);
  const [newName,   setNewName  ] = useState('');
  const [newColor,  setNewColor ] = useState('#3B82F6');
  const [newType,   setNewType  ] = useState('offense');
  const [newTeamId, setNewTeamId] = useState('');
  const [pickerOpenFor, setPickerOpenFor] = useState(null);
  const [editingId,  setEditingId ] = useState(null);
  const [editName,   setEditName  ] = useState('');

  const load = useCallback(async () => {
    try { await fetchLines(); } catch { /* error via hook */ }
  }, [fetchLines]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchRoster().catch(() => {}); }, [fetchRoster]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const teamsICanShareWith = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await createLine(trimmed, newColor, newType, newTeamId === '' ? null : newTeamId);
      setCreating(false);
      setNewName('');
      setNewColor('#3B82F6');
      setNewType('offense');
      setNewTeamId('');
    } catch { /* error via hook */ }
  };

  const handleDelete = async (line) => {
    try {
      await deleteLine(line._id, { baselineUpdatedAt: line.updatedAt, label: line.name });
    } catch { /* error via hook */ }
  };

  const handleToggleActive = async (line) => {
    try {
      await setActive(line._id, !line.isActive);
    } catch { /* error via hook */ }
  };

  const startEditing = (line) => {
    setEditingId(line._id);
    setEditName(line.name);
  };

  const commitRename = async (line) => {
    setEditingId(null);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === line.name) return;
    try {
      await updateLine(line._id, { name: trimmed }, { baselineUpdatedAt: line.updatedAt, label: line.name });
    } catch { /* error via hook */ }
  };

  // Kader derselben Sichtbarkeits-Gruppe wie die Line (team-geteilt oder
  // persönlich) – bewusst OHNE Filterung nach "schon in einer anderen Line",
  // ein Spieler darf in beliebig vielen Lines stehen (Kernpunkt des Umbaus).
  const squadForLine = (line) => rosterPlayers.filter((p) => (line.teamId ? p.teamId === line.teamId : !p.teamId));

  const handleAddPlayer = async (line, playerId) => {
    try {
      await addPlayer(line._id, playerId);
    } catch { /* error via hook */ }
  };

  const handleRemovePlayer = async (line, playerId) => {
    try {
      await removePlayer(line._id, playerId);
    } catch { /* error via hook */ }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('lines.title')}</h1>
          <p className={styles.subtitle}>
            {lines.length > 0 ? t('lines.count', { count: lines.length }) : t('lines.noLinesYet')}
          </p>
        </div>
      </header>

      <SeasonLineChemieSection />

      <div className={styles.actionsBar}>
        {creating ? (
          <form className={styles.createForm} onSubmit={handleCreate}>
            <input
              autoFocus
              className={styles.createInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape') setCreating(false); }}
              placeholder={t('lines.namePlaceholder')}
              maxLength={40}
              aria-label={t('lines.nameAriaLabel')}
            />
            <input
              type="color"
              className={styles.colorInput}
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              aria-label={t('lines.colorAriaLabel')}
            />
            <select
              className={styles.createInput}
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              aria-label={t('lines.typeAriaLabel')}
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>{t(`lines.type${type.charAt(0).toUpperCase()}${type.slice(1)}`)}</option>
              ))}
            </select>
            {teamsICanShareWith.length > 0 && (
              <select
                className={styles.createInput}
                value={newTeamId}
                onChange={(e) => setNewTeamId(e.target.value)}
                aria-label={t('lines.teamAriaLabel')}
              >
                <option value="">{t('lines.personalOption')}</option>
                {teamsICanShareWith.map((tm) => (
                  <option key={tm._id} value={tm._id}>{tm.name}</option>
                ))}
              </select>
            )}
            <Button type="submit" variant="primary" size="md" disabled={loading}>{t('lines.confirmCreate')}</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => setCreating(false)}>{t('lines.cancelCreate')}</Button>
          </form>
        ) : (
          <Button variant="primary" size="md" onClick={() => setCreating(true)} disabled={!canAddLine} aria-label={t('lines.newLineAriaLabel')}>
            <Plus size={16} aria-hidden="true" /> {t('lines.newLine')}
          </Button>
        )}
      </div>

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {loading && lines.length === 0 ? (
        <p className={styles.hint}>{t('lines.loadingLines')}</p>
      ) : lines.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon}><Layers size={16} aria-hidden="true" /></div>
          <h2>{t('lines.noLinesYet')}</h2>
          <p>{t('lines.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.list} role="list" aria-label={t('lines.title')}>
          {lines.map((line) => {
            const squad = squadForLine(line);
            const availablePlayers = squad.filter((p) => !line.players.some((lp) => lp._id === p._id));
            return (
              <li key={line._id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.colorDot} style={{ background: line.color }} aria-hidden="true" />
                  {editingId === line._id ? (
                    <input
                      autoFocus
                      className={styles.lineNameInput}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => commitRename(line)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')  commitRename(line);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={40}
                      aria-label={t('lines.renameAriaLabel')}
                    />
                  ) : (
                    <button
                      type="button"
                      className={styles.lineName}
                      onDoubleClick={() => startEditing(line)}
                      title={t('lines.renameTitle')}
                    >
                      {line.name}
                    </button>
                  )}
                  <span className={styles.typeBadge}>{t(`lines.type${line.type.charAt(0).toUpperCase()}${line.type.slice(1)}`)}</span>
                  <Button
                    variant={line.isActive ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => handleToggleActive(line)}
                    aria-label={line.isActive ? t('lines.deactivateAriaLabel', { name: line.name }) : t('lines.activateAriaLabel', { name: line.name })}
                  >
                    {line.isActive ? t('lines.active') : t('lines.activate')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    onClick={() => handleDelete(line)}
                    aria-label={t('lines.deleteAriaLabel', { name: line.name })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </div>

                <div className={styles.playerChips}>
                  {line.players.map((p) => (
                    <span key={p._id} className={styles.playerChip}>
                      {p.role && <span className={styles.playerRole}>{p.role}</span>}
                      {p.jerseyNumber != null && `#${p.jerseyNumber} `}{p.name}
                      <button
                        type="button"
                        className={styles.chipRemoveBtn}
                        onClick={() => handleRemovePlayer(line, p._id)}
                        aria-label={t('lines.removePlayerAriaLabel', { name: p.name })}
                      >
                        <X size={12} aria-hidden="true" />
                      </button>
                    </span>
                  ))}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPickerOpenFor((cur) => (cur === line._id ? null : line._id))}
                    aria-expanded={pickerOpenFor === line._id}
                  >
                    <UserPlus size={14} aria-hidden="true" /> {t('lines.addPlayer')}
                  </Button>
                </div>

                {pickerOpenFor === line._id && (
                  <div className={styles.picker} role="group" aria-label={t('lines.pickerAriaLabel', { name: line.name })}>
                    {availablePlayers.length === 0 ? (
                      <p className={styles.hint}>{t('lines.noMorePlayers')}</p>
                    ) : (
                      availablePlayers.map((p) => (
                        <Button
                          key={p._id}
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAddPlayer(line, p._id)}
                        >
                          {p.role && <span className={styles.playerRole}>{p.role}</span>}
                          {p.jerseyNumber != null && `#${p.jerseyNumber} `}{p.name}
                        </Button>
                      ))
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
