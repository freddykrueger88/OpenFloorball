/**
 * ShotEntryPanel – Schuss erfassen (Statistik-Architektur Phase 3).
 * Zuordnung (Kader-Spieler/Gegner/Ohne Angabe) folgt demselben Muster
 * wie die bestehende Attribution-Auswahl in GamePage.jsx
 * (handleSelectAttribution). Bei Gegner-Zuordnung zusätzlich optional
 * "unser Torhüter" (secondaryRosterPlayerId, siehe ADR-0003).
 *
 * `addEvent` wird von GamePage.jsx durchgereicht (nicht selbst über
 * useGameEvents geladen), damit das neu erstellte Schuss-Ereignis in
 * derselben `events`-Liste landet, die auch die Timeline/den
 * Live-Spielstand speist – keine zweite, potenziell abweichende
 * Events-Quelle.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOT_TYPES, SHOT_OUTCOMES } from '../../constants/shotOptions.js';
import { deriveZone } from '../../constants/shotZones.js';
import ShotZoneDiagram from './ShotZoneDiagram.jsx';
import Button from '../common/Button.jsx';
import styles from './ShotEntryPanel.module.css';

export default function ShotEntryPanel({ squadForGame, addEvent, onSubmitted }) {
  const { t, i18n } = useTranslation();
  const [attribution, setAttribution] = useState(null); // player object | 'opponent' | null (Ohne Angabe)
  const [goalkeeperId, setGoalkeeperId] = useState(null);
  const [point, setPoint] = useState(null);
  const [shotType, setShotType] = useState(SHOT_TYPES[0].key);
  const [outcome, setOutcome] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const isOpponentShot = attribution === 'opponent';
  const goalkeepers = squadForGame.filter((p) => p.role === 'TW');
  const canSubmit = point && outcome && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await addEvent({
        eventType: 'shot',
        rosterPlayerId: attribution && attribution !== 'opponent' ? attribution._id : null,
        isOpponent: isOpponentShot,
        secondaryRosterPlayerId: isOpponentShot ? goalkeeperId : null,
        x: point.x,
        y: point.y,
        shotType,
        outcome,
      });
      setAttribution(null);
      setGoalkeeperId(null);
      setPoint(null);
      setOutcome(null);
      onSubmitted?.();
    } catch {
      // Fehler läuft über die bestehende eventsError-Anzeige in GamePage.jsx
    } finally {
      setSubmitting(false);
    }
  };

  const optionLabel = (opt) => (i18n.language === 'en' ? opt.labelEn : opt.labelDe);

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t('games.shotAttributionLabel')}</span>
        <div className={styles.buttonRow} role="group" aria-label={t('games.shotAttributionLabel')}>
          {squadForGame.map((player) => (
            <Button
              key={player._id}
              type="button"
              variant={attribution === player ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setAttribution(player)}
            >
              {player.jerseyNumber != null && `#${player.jerseyNumber} `}{player.name}
            </Button>
          ))}
          <Button type="button" variant={isOpponentShot ? 'primary' : 'secondary'} size="sm" onClick={() => setAttribution('opponent')}>
            {t('games.attributionOpponent')}
          </Button>
          <Button type="button" variant={attribution === null ? 'primary' : 'secondary'} size="sm" onClick={() => setAttribution(null)}>
            {t('games.attributionNone')}
          </Button>
        </div>
      </div>

      {isOpponentShot && goalkeepers.length > 0 && (
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t('games.shotAttributionGoalkeeperLabel')}</span>
          <div className={styles.buttonRow} role="group" aria-label={t('games.shotAttributionGoalkeeperLabel')}>
            {goalkeepers.map((gk) => (
              <Button
                key={gk._id}
                type="button"
                variant={goalkeeperId === gk._id ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setGoalkeeperId(gk._id)}
              >
                {gk.name}
              </Button>
            ))}
            <Button type="button" variant={goalkeeperId === null ? 'primary' : 'secondary'} size="sm" onClick={() => setGoalkeeperId(null)}>
              {t('games.shotAttributionGoalkeeperNone')}
            </Button>
          </div>
        </div>
      )}

      <div className={styles.section}>
        <span className={styles.sectionLabel}>
          {t('games.shotPositionLabel')}
          {point && ` – ${t(`shotZones.${deriveZone(point.x, point.y)}`)}`}
        </span>
        <ShotZoneDiagram interactive selectedPoint={point} onSelect={(x, y) => setPoint({ x, y })} />
      </div>

      <div className={styles.section}>
        <label className={styles.sectionLabel} htmlFor="shot-type-select">{t('games.shotTypeLabel')}</label>
        <select id="shot-type-select" className={styles.select} value={shotType} onChange={(e) => setShotType(e.target.value)}>
          {SHOT_TYPES.map((opt) => <option key={opt.key} value={opt.key}>{optionLabel(opt)}</option>)}
        </select>
      </div>

      <div className={styles.section}>
        <span className={styles.sectionLabel}>{t('games.shotOutcomeLabel')}</span>
        <div className={styles.buttonRow} role="group" aria-label={t('games.shotOutcomeLabel')}>
          {SHOT_OUTCOMES.map((opt) => (
            <Button
              key={opt.key}
              type="button"
              variant={outcome === opt.key ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setOutcome(opt.key)}
            >
              {optionLabel(opt)}
            </Button>
          ))}
        </div>
      </div>

      <Button type="button" variant="primary" size="md" disabled={!canSubmit} onClick={handleSubmit}>
        {t('games.shotSubmit')}
      </Button>
    </div>
  );
}
