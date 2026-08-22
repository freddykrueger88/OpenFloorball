/**
 * AiGameInsightsModal – Spiel-Insights (Statistik-Architektur Phase 9,
 * KI/ML-Grundlagen). Anders als die anderen drei KI-Assistenten (EPIC
 * 010) braucht dieser kein Eingabeformular – die Grundlage sind bereits
 * berechnete Statistiken dieses Spiels, keine Nutzereingabe. Deshalb
 * auch kein "Als Board übernehmen": es gibt hier keinen Board-Kontext,
 * und die zugrunde liegenden Zahlen bleiben ohnehin dauerhaft auf der
 * Spielseite selbst sichtbar – der KI-Text ist ein Lese-Ergebnis, kein
 * Entwurf zum Weiterbearbeiten.
 *
 * "Grundlage anzeigen" (Explainable AI, CLAUDE.md §5.10/18.3) zeigt den
 * exakten Statistik-Textblock, der tatsächlich an die KI gesendet
 * wurde – wortgleich mit `statsSummary` aus der API-Antwort.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import { useAiApi } from '../../hooks/useAiApi.js';
import useAnnounceStore from '../../store/announceStore.js';
import Button from '../common/Button.jsx';
import styles from '../boards/AiTacticAssistantModal.module.css';

export default function AiGameInsightsModal({ gameId, onClose }) {
  const { t } = useTranslation();
  const { loading, error, generateGameInsights } = useAiApi();
  const containerRef = useRef(null);
  useFocusTrap(containerRef, { onEscape: onClose });

  const [result, setResult] = useState(null); // { insightsText, statsSummary, model }
  const [showBasis, setShowBasis] = useState(false);

  const handleGenerate = async () => {
    try {
      const data = await generateGameInsights({ gameId });
      setResult(data);
      useAnnounceStore.getState().announce(t('ai.resultDisclaimer'));
    } catch { /* error via hook */ }
  };

  return (
    <div
      ref={containerRef}
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-game-insights-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal}>
        <header className={styles.modalHeader}>
          <h2 id="ai-game-insights-title" className={styles.modalTitle}>
            <Sparkles size={20} aria-hidden="true" /> {t('ai.insightsFormTitle')}
          </h2>
        </header>

        {!result ? (
          <div className={styles.form}>
            <p className={styles.label}>{t('ai.insightsExplainer')}</p>

            {error && (
              <p className={styles.errorMsg} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>
            )}

            <div className={styles.actions}>
              <Button type="button" variant="secondary" size="md" className={styles.cancelBtn} onClick={onClose} disabled={loading}>
                {t('ai.discard')}
              </Button>
              <Button type="button" variant="primary" size="md" className={styles.confirmBtn} onClick={handleGenerate} disabled={loading} aria-live="polite">
                {loading ? t('ai.generating') : t('ai.generate')}
              </Button>
            </div>
          </div>
        ) : (
          <div className={styles.result}>
            <p className={styles.disclaimer}>
              <Sparkles size={16} aria-hidden="true" /> {t('ai.resultDisclaimer')} {t('ai.modelLabel', { model: result.model })}
            </p>
            <textarea className={styles.textarea} value={result.insightsText} readOnly rows={14} />

            <Button type="button" variant="secondary" size="sm" onClick={() => setShowBasis((v) => !v)} aria-expanded={showBasis}>
              {showBasis ? t('ai.hideBasis') : t('ai.showBasis')}
            </Button>
            {showBasis && (
              <textarea className={styles.textarea} value={result.statsSummary} readOnly rows={10} />
            )}

            <div className={styles.actions}>
              <Button type="button" variant="primary" size="md" className={styles.confirmBtn} onClick={onClose}>
                {t('ai.close')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
