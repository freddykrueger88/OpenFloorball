/**
 * PlaybookFilterBar – Filter-Leiste für Playbooks/Board-Sammlungen (Issue #52)
 * "Alle" / "Ohne Playbook" / je Playbook als Chip, plus Inline-Anlegen.
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users } from 'lucide-react';
import styles from './PlaybookFilterBar.module.css';

export default function PlaybookFilterBar({
  playbooks, boards, activeFilter, onFilterChange,
  onCreatePlaybook, onRenamePlaybook, onDeletePlaybook, canAddPlaybook,
  teams = [],
}) {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [name,     setName    ] = useState('');
  const [teamId,   setTeamId  ] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName ] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { if (creating) inputRef.current?.focus(); }, [creating]);

  const unassignedCount = boards.filter((b) => !b.playbookId).length;

  const startEditing = (pb) => {
    setEditingId(pb._id);
    setEditName(pb.name);
  };

  const commitRename = (pb) => {
    setEditingId(null);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === pb.name) return;
    onRenamePlaybook?.(pb, trimmed);
  };

  const commitCreate = async () => {
    const trimmed = name.trim();
    if (trimmed) {
      try {
        const newPlaybook = await onCreatePlaybook(trimmed, teamId === '' ? null : teamId);
        onFilterChange(newPlaybook._id);
      } catch { /* Fehler bereits im Hook gesetzt */ }
    }
    setName('');
    setTeamId('');
    setCreating(false);
  };

  return (
    <div className={styles.bar} role="group" aria-label={t('playbooks.filterAriaLabel')}>
      <button
        className={`${styles.chip} ${activeFilter === 'all' ? styles.chipActive : ''}`}
        onClick={() => onFilterChange('all')}
        aria-pressed={activeFilter === 'all'}
      >
        {t('playbooks.all')} · {boards.length}
      </button>

      <button
        className={`${styles.chip} ${activeFilter === 'none' ? styles.chipActive : ''}`}
        onClick={() => onFilterChange('none')}
        aria-pressed={activeFilter === 'none'}
      >
        {t('playbooks.unassigned')} · {unassignedCount}
      </button>

      {playbooks.map((pb) => (
        <span
          key={pb._id}
          className={`${styles.chip} ${activeFilter === pb._id ? styles.chipActive : ''}`}
        >
          {editingId === pb._id ? (
            <input
              autoFocus
              className={styles.renameInput}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => commitRename(pb)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  commitRename(pb);
                if (e.key === 'Escape') setEditingId(null);
              }}
              maxLength={40}
              aria-label={t('playbooks.renameAriaLabel')}
            />
          ) : (
            <button
              className={styles.chipLabel}
              onClick={() => onFilterChange(pb._id)}
              onDoubleClick={() => startEditing(pb)}
              aria-pressed={activeFilter === pb._id}
              title={t('playbooks.renameTitle')}
            >
              {pb.name} · {boards.filter((b) => b.playbookId === pb._id).length}
              {pb.teamId && (
                <span className={styles.teamBadge} title={teams.find((tm) => tm._id === pb.teamId)?.name ?? t('playbooks.teamBadgeFallback')}>
                  <Users size={14} aria-hidden="true" />
                </span>
              )}
            </button>
          )}
          <button
            className={styles.chipDelete}
            onClick={() => onDeletePlaybook(pb._id)}
            aria-label={t('playbooks.deleteAriaLabel', { name: pb.name })}
            title={t('playbooks.deleteTitle')}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </span>
      ))}

      {creating ? (
        <div
          className={styles.newGroup}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) commitCreate();
          }}
        >
          <input
            ref={inputRef}
            className={styles.newInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter')  commitCreate();
              if (e.key === 'Escape') { setName(''); setCreating(false); }
            }}
            maxLength={40}
            placeholder={t('playbooks.newNamePlaceholder')}
            aria-label={t('playbooks.newNameAriaLabel')}
          />
          {teams.length > 0 && (
            <select
              className={styles.newTeamSelect}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              aria-label={t('playbooks.teamAriaLabel')}
            >
              <option value="">{t('playbooks.personalOption')}</option>
              {teams.map((tm) => (
                <option key={tm._id} value={tm._id}>{tm.name}</option>
              ))}
            </select>
          )}
        </div>
      ) : canAddPlaybook ? (
        <button className={styles.newChip} onClick={() => setCreating(true)}>
          + {t('playbooks.newChip')}
        </button>
      ) : (
        <span className={styles.limitHint}>{t('playbooks.limitHint')}</span>
      )}
    </div>
  );
}
