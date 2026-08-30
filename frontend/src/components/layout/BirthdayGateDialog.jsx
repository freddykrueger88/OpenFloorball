/**
 * BirthdayGateDialog – erzwingt einmalig das Nachtragen des Geburtsdatums
 * für Bestandsnutzer, die vor Einführung des Pflichtfelds registriert
 * wurden (users.birthday ist NULL). Anders als ConflictReviewDialog/
 * TourOverlay bewusst NICHT schließbar (kein Escape, kein Backdrop-Klick,
 * kein X) – wird in App.jsx gerendert solange `user.birthday` fehlt und
 * verschwindet automatisch, sobald die PUT-Antwort ein gesetztes
 * Geburtsdatum in den authStore schreibt.
 */
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';
import api from '../../utils/api.js';
import useAuthStore from '../../store/authStore.js';
import Button from '../common/Button.jsx';
import styles from './BirthdayGateDialog.module.css';

export default function BirthdayGateDialog() {
  const { t } = useTranslation();
  const containerRef = useRef(null);
  useFocusTrap(containerRef, {});

  const [birthday, setBirthday] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await api.put('/auth/birthday', { birthday });
      useAuthStore.getState().setUser(res.data.data.user);
    } catch (e) {
      const details = e.response?.data?.details;
      const detailMsg = Array.isArray(details) ? details.map((d) => d.message).join(' ') : null;
      setErr(detailMsg || e.response?.data?.message || t('dialogs.birthdayGate.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      ref={containerRef}
      className={styles.backdrop}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="birthday-gate-title"
    >
      <div className={styles.dialog}>
        <h2 id="birthday-gate-title" className={styles.title}>{t('dialogs.birthdayGate.title')}</h2>
        <p className={styles.hint}>{t('dialogs.birthdayGate.hint')}</p>

        {err && <div role="alert" className={styles.error}>{err}</div>}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <label htmlFor="birthday-gate-input" className={styles.label}>
            {t('auth.birthday')}
          </label>
          <input
            id="birthday-gate-input"
            type="date"
            autoComplete="bday"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className={styles.input}
          />

          <Button type="submit" variant="primary" size="md" disabled={loading} className={styles.submitBtn}>
            {loading ? t('dialogs.birthdayGate.saving') : t('dialogs.birthdayGate.confirm')}
          </Button>
        </form>
      </div>
    </div>
  );
}
