/**
 * PlayerAccessibleList – Tastaturzugänglicher Parallel-Zugang zu den
 * Spielern auf dem Konva-Canvas (Issue #27)
 *
 * Konva rendert auf <canvas>, daher sind einzelne Spieler-Token nicht Teil
 * der nativen Tab-Reihenfolge. Diese unsichtbare (bis auf Fokus) Liste
 * bietet denselben "Spieler auswählen → Info-Panel öffnen"-Vorgang per
 * Tab + Enter, wie er per Maus/Touch schon funktioniert.
 */
import { useTranslation } from 'react-i18next';

export default function PlayerAccessibleList({ players = [], onSelectPlayer, selectedPlayerId }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('field.accessibleListLabel')} style={{ listStyle: 'none' }}>
      {players.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            className="sr-only sr-only-focusable"
            onClick={() => onSelectPlayer?.(p.id)}
            aria-pressed={p.id === selectedPlayerId}
          >
            {p.team === 'ball'
              ? t('field.ballLabel')
              : `${p.role}${p.name ? ` – ${p.name}` : ''} (${p.team === 'home' ? t('teams.home') : t('teams.away')})${p.visible === false ? ` ${t('field.hiddenSuffix')}` : ''}`}
          </button>
        </li>
      ))}
    </ul>
  );
}
