/**
 * FormationsPanel – Formations-Vorlagen speichern/laden (Issue #46)
 * Speichert die aktuelle Spieler-Aufstellung als wiederverwendbare,
 * benannte Vorlage; über alle eigenen Boards hinweg nutzbar. Bei
 * abweichendem Feldtyp übernimmt der Aufrufer (BoardEditorPage) die
 * Skalierung via rescalePlayers().
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Save, Users, FolderOpen } from 'lucide-react';
import { FIELD_TYPE_LABELS } from '../../constants/fieldConfig.js';
import Button from '../common/Button.jsx';
import styles from './FormationsPanel.module.css';

export default function FormationsPanel({
  formations = [],
  onSave,
  onLoad,
  onRename,
  onDelete,
  canAddFormation = true,
  teams = [],
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [newName,   setNewName  ] = useState('');
  const [teamId,    setTeamId   ] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName ] = useState('');

  const startEditing = (formation) => {
    setEditingId(formation._id);
    setEditName(formation.name);
  };

  const commitRename = (formation) => {
    setEditingId(null);
    const trimmed = editName.trim();
    if (!trimmed || trimmed === formation.name) return;
    onRename?.(formation, trimmed);
  };

  const handleSave = () => {
    const name = newName.trim();
    if (!name || !canAddFormation) return;
    onSave?.(name, teamId === '' ? null : teamId);
    setNewName('');
    setTeamId('');
  };

  return (
    <section className={styles.panel} aria-label={t('formations.sectionAriaLabel')}>
      <header className={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          className={styles.collapseBtn}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t('formations.expand') : t('formations.collapse')}
        >
          <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span> {t('formations.title')}
        </Button>
        {!collapsed && <span className={styles.count}>{formations.length}/20</span>}
      </header>

      {!collapsed && (
        <>
          {formations.length === 0 && (
            <p className={styles.emptyHint}>{t('formations.emptyHint')}</p>
          )}

          <ul className={styles.list} role="list">
            {formations.map((formation) => (
              <li key={formation._id} className={styles.item}>
                {editingId === formation._id ? (
                  <input
                    autoFocus
                    className={styles.nameInput}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onBlur={() => commitRename(formation)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  commitRename(formation);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    maxLength={40}
                    aria-label={t('formations.renameAriaLabel')}
                  />
                ) : (
                  <button
                    type="button"
                    className={styles.name}
                    onDoubleClick={() => startEditing(formation)}
                    title={t('formations.renameTitle')}
                  >
                    {formation.name}
                  </button>
                )}
                {formation.teamId && (
                  <span className={styles.teamBadge} title={teams.find((tm) => tm._id === formation.teamId)?.name ?? t('formations.teamBadgeFallback')}>
                    <Users size={14} aria-hidden="true" />
                  </span>
                )}
                <span className={styles.fieldBadge}>{FIELD_TYPE_LABELS[formation.fieldType] ?? formation.fieldType}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  className={styles.loadBtn}
                  onClick={() => onLoad?.(formation)}
                  aria-label={t('formations.loadTitle')}
                  title={t('formations.loadTitle')}
                >
                  <FolderOpen size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  iconOnly
                  className={styles.deleteBtn}
                  onClick={() => onDelete?.(formation._id)}
                  aria-label={t('formations.deleteAriaLabel', { name: formation.name })}
                  title={t('formations.deleteTitle')}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>

          <div className={styles.addRow}>
            <input
              className={styles.newNameInput}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('formations.newNamePlaceholder')}
              maxLength={40}
              disabled={!canAddFormation}
              aria-label={t('formations.newNameAriaLabel')}
            />
            {teams.length > 0 && (
              <select
                className={styles.newTeamSelect}
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                disabled={!canAddFormation}
                aria-label={t('formations.teamAriaLabel')}
              >
                <option value="">{t('formations.personalOption')}</option>
                {teams.map((tm) => (
                  <option key={tm._id} value={tm._id}>{tm.name}</option>
                ))}
              </select>
            )}
            <Button
              variant="primary"
              size="sm"
              iconOnly
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={!canAddFormation || !newName.trim()}
              aria-label={t('formations.saveAriaLabel')}
              title={t('formations.saveTitle')}
            >
              <Save size={16} aria-hidden="true" />
            </Button>
          </div>
          {!canAddFormation && <p className={styles.limitHint}>{t('formations.limitHint')}</p>}
        </>
      )}
    </section>
  );
}
