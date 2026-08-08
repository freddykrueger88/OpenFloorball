/**
 * ResetPasswordPage – neues Passwort mit dem per Mail erhaltenen Token
 * setzen (Backlog: Passwort-Reset-Flow). Token kommt aus der URL
 * (/reset-password/:token), wird nie im UI angezeigt/geloggt.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import api from '../utils/api.js';
import logo from '../assets/openfloorball_logo_cropped.png';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { token } = useParams();

  const [newPassword,     setNewPassword    ] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err,     setErr    ] = useState(null);
  const [done,    setDone   ] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErr(t('auth.resetPasswordMismatch'));
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setDone(true);
    } catch (e) {
      const details = e.response?.data?.details;
      const detailMsg = Array.isArray(details) ? details.map((d) => d.message).join(' ') : null;
      setErr(detailMsg || e.response?.data?.message || t('auth.resetPasswordError'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page" role="main">
      <div className="auth-card" id="main-content">
        <img src={logo} alt="OpenFloorball" className="auth-logo" />
        <h1 className="auth-title">{t('auth.resetPasswordTitle')}</h1>

        {!done && (
          <>
            {err && (
              <div role="alert" className="auth-error">
                <span>{err}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="newPassword">{t('auth.resetPasswordNewLabel')}</label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  aria-describedby={err ? 'auth-error' : undefined}
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">{t('auth.resetPasswordConfirmLabel')}</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? t('auth.resetPasswordSaving') : t('auth.resetPasswordSubmit')}
              </button>
            </form>
          </>
        )}

        {done && (
          <>
            <p className="auth-hint" role="status">{t('auth.resetPasswordSuccess')}</p>
            <Link to="/login" className="btn btn-primary btn-full">{t('auth.loginBtn')}</Link>
          </>
        )}

        {!done && (
          <p className="auth-switch">
            <Link to="/login">{t('auth.backToLogin')}</Link>
          </p>
        )}
      </div>
    </main>
  );
}
