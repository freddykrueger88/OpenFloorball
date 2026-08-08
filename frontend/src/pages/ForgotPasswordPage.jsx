/**
 * ForgotPasswordPage – Passwort-Reset anfordern (Backlog: Passwort-
 * Reset-Flow). Zeigt nach dem Absenden immer dieselbe generische
 * Erfolgsmeldung an, unabhängig davon, ob die E-Mail-Adresse
 * tatsächlich existiert – der Backend-Endpunkt garantiert das bereits
 * (siehe routes/auth.js), hier wird nur die Antwort unverändert
 * angezeigt statt eine eigene Formulierung zu erfinden.
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
  const [message, setMessage] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMessage(res.data.data.message);
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

        {!message && (
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

        {message && (
          <p className="auth-hint" role="status">{message}</p>
        )}

        <p className="auth-switch">
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </p>
      </div>
    </main>
  );
}
