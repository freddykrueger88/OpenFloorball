/**
 * ForgotPasswordPage – Passwort-Reset anfordern (Backlog: Passwort-
 * Reset-Flow). Zeigt nach dem Absenden immer dieselbe generische
 * Erfolgsmeldung an, unabhängig davon, ob die E-Mail-Adresse
 * tatsächlich existiert – der Backend-Endpunkt garantiert das bereits
 * (siehe routes/auth.js). Der Erfolgstext kommt bewusst aus dem
 * Frontend-i18n statt aus der (nur deutschen) Backend-Antwort – der
 * Endpunkt ist absichtlich anonym/ohne Nutzerbezug, es gibt also keine
 * Sprachpräferenz, die das Backend hier auswerten könnte.
 */
import { useState } from 'react';
import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.js';
import logo from '../assets/openfloorball_logo_cropped.png';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();

  const [email,   setEmail  ] = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr    ] = useState(null);
  const [sent,    setSent   ] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (e) {
      const details = e.response?.data?.details;
      const detailMsg = Array.isArray(details) ? details.map((d) => d.message).join(' ') : null;
      setErr(detailMsg || e.response?.data?.message || t('auth.forgotPasswordError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page" role="main">
      <div className="auth-card" id="main-content">
        <img src={logo} alt="OpenFloorball" className="auth-logo" />
        <h1 className="auth-title">{t('auth.forgotPasswordTitle')}</h1>

        {!sent && (
          <>
            <p className="auth-hint">{t('auth.forgotPasswordDesc')}</p>

            {err && (
              <div role="alert" className="auth-error">
                <span>{err}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="email">{t('auth.email')}</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="coach@example.com"
                  aria-describedby={err ? 'auth-error' : undefined}
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? t('auth.forgotPasswordSending') : t('auth.forgotPasswordSubmit')}
              </button>
            </form>
          </>
        )}

        {sent && (
          <p className="auth-hint" role="status">{t('auth.forgotPasswordSuccess')}</p>
        )}

        <p className="auth-switch">
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
