import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.js';
import useAuthStore from '../store/authStore.js';
import logo from '../assets/openfloorball_logo_cropped.png';

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);
  const [searchParams] = useSearchParams();

  // Vorbefüllung, wenn über einen Einladungs-Link gekommen (siehe
  // InvitePage.jsx) – die eigentliche Zuordnung passiert serverseitig
  // rein über den E-Mail-Abgleich bei der Registrierung.
  const [form, setForm] = useState({ email: searchParams.get('email') ?? '', password: '', name: '' });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const res = await api.post('/auth/register', form);
      setUser(res.data.data.user);
      // Onboarding-Ausbau: Demo-Testumgebung direkt nach der Registrierung
      // anlegen (idempotent, siehe useDemoData.js/backend demoData-Service).
      // Bewusst frontend-seitig statt im Register-Endpunkt selbst, damit ein
      // Fehler hier niemals die Registrierung scheitern lässt und bestehende
      // Backend-Tests, die einen frisch registrierten Account mit leeren
      // Listen erwarten, unverändert bleiben – schlägt es fehl, sieht der
      // Nutzer stattdessen den Empty-State-Hinweis auf BoardsPage.jsx.
      try { await api.post('/demo-data'); } catch { /* siehe Kommentar oben */ }
      navigate('/boards', { replace: true });
    } catch (e) {
      const details = e.response?.data?.details;
      const detailMsg = Array.isArray(details) ? details.map((d) => d.message).join(' ') : null;
      setErr(detailMsg || e.response?.data?.message || t('auth.registerError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page" role="main">

      <div className="auth-card" id="main-content">
        <img src={logo} alt="OpenFloorball" className="auth-logo" />
        <p className="auth-slogan">{t('auth.slogan')}</p>

        <h1 className="auth-title">{t('auth.registerTitle')}</h1>
        <p className="auth-hint">{t('auth.firstUserAdmin')}</p>

        {err && (
          <div role="alert" className="auth-error">
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="name">{t('auth.name')}</label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('auth.namePlaceholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="coach@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
            <span className="form-hint">{t('auth.passwordHint')}</span>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? t('auth.registering') : t('auth.registerBtn')}
          </button>
        </form>

        <p className="auth-switch">
          {t('auth.hasAccount')}{' '}
          <Link to="/login">{t('auth.loginLink')}</Link>
        </p>
      </div>
    </main>
  );
}
