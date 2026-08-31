/**
 * AccountSection – Konto: Anzeigename, E-Mail, Passwort, Löschen, Logout
 * (UI/UX-Audit, Stufe 3 – aus der vormals 1011-Zeilen-SettingsPage.jsx
 * ausgelagert, reines Verschieben ohne Logik-Änderung)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Trash2, Check } from 'lucide-react';
import useAuthStore from '../../store/authStore.js';
import { useAutoSave } from '../../hooks/useAutoSave.js';
import { apiFetch } from '../../utils/apiFetch.js';
import Button from '../common/Button.jsx';
import DeleteAccountDialog from './DeleteAccountDialog.jsx';
import styles from '../../pages/SettingsPage.module.css';

export default function AccountSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  useEffect(() => { setName(user?.name || ''); }, [user?.name]);
  const saveName = useCallback(async (n) => {
    if (!n.trim()) return;
    const res = await apiFetch('/api/auth/name', { method: 'PUT', body: JSON.stringify({ name: n.trim() }) });
    setUser(res.user);
  }, [setUser]);
  const { status: nameSaveStatus } = useAutoSave(name, saveName, !!user);

  // Bewusst KEIN useAutoSave wie beim Anzeigenamen: ein Geburtsdatum soll
  // nicht bei jedem Öffnen dieses Tabs oder während des Eintippens
  // (unvollständiges Datum) automatisch abgeschickt werden – explizites
  // Speichern per Button, analog E-Mail-/Passwort-Formular.
  const [birthday, setBirthday] = useState(user?.birthday?.slice(0, 10) || '');
  useEffect(() => { setBirthday(user?.birthday?.slice(0, 10) || ''); }, [user?.birthday]);
  const [birthdayMsg, setBirthdayMsg] = useState(null);
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const handleBirthdaySubmit = async (e) => {
    e.preventDefault();
    setBirthdayMsg(null);
    setBirthdaySaving(true);
    try {
      const res = await apiFetch('/api/auth/birthday', { method: 'PUT', body: JSON.stringify({ birthday }) });
      setUser(res.user);
      setBirthdayMsg({ type: 'ok', text: t('settings.birthdayChanged') });
    } catch (err) {
      setBirthdayMsg({ type: 'error', text: err.message });
    } finally {
      setBirthdaySaving(false);
    }
  };

  const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' });
  const [emailMsg, setEmailMsg] = useState(null);
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailMsg(null);
    try {
      const res = await apiFetch('/api/auth/email', { method: 'PUT', body: JSON.stringify(emailForm) });
      setUser(res.user);
      setEmailForm({ newEmail: '', currentPassword: '' });
      setEmailMsg({ type: 'ok', text: t('settings.emailChanged') });
    } catch (err) {
      setEmailMsg({ type: 'error', text: err.message });
    }
  };

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwMsg, setPwMsg] = useState(null);
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwMsg(null);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: 'error', text: t('settings.passwordMismatch') });
      return;
    }
    try {
      await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwMsg({ type: 'ok', text: t('settings.passwordChanged') });
    } catch (err) {
      setPwMsg({ type: 'error', text: err.message });
    }
  };

  const [showDelete, setShowDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const handleDeleteAccount = async (email) => {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await apiFetch('/api/user/account', { method: 'DELETE', body: JSON.stringify({ email }) });
      setUser(null);
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2>{t('settings.nav.account')}</h2>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="display-name">{t('settings.displayName')}</label>
        <input
          id="display-name"
          className={styles.textInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <span className={styles.saveStatus} aria-live="polite">
          {nameSaveStatus === 'saving' && t('settings.saving')}
          {nameSaveStatus === 'saved' && <><Check size={14} aria-hidden="true" /> {t('settings.saved')}</>}
        </span>
      </div>

      <form className={styles.subForm} onSubmit={handleBirthdaySubmit}>
        <h3 className={styles.subTitle}>{t('auth.birthday')}</h3>
        <input
          type="date"
          className={styles.textInput}
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          required
          aria-label={t('auth.birthday')}
        />
        <span className={styles.hint}>{t('auth.birthdayHint')}</span>
        <Button type="submit" variant="secondary" size="md" className={styles.submitBtn} disabled={birthdaySaving}>
          {birthdaySaving ? t('settings.saving') : t('settings.birthdaySaveBtn')}
        </Button>
        {birthdayMsg && (
          <p className={birthdayMsg.type === 'error' ? styles.msgError : styles.msgOk}>{birthdayMsg.text}</p>
        )}
      </form>

      <form className={styles.subForm} onSubmit={handleEmailSubmit}>
        <h3 className={styles.subTitle}>{t('settings.changeEmail')}</h3>
        <p className={styles.currentValue}>{t('settings.currentEmail', { email: user?.email })}</p>
        <input
          type="email"
          className={styles.textInput}
          placeholder={t('settings.newEmailPlaceholder')}
          value={emailForm.newEmail}
          onChange={(e) => setEmailForm((f) => ({ ...f, newEmail: e.target.value }))}
          required
        />
        <input
          type="password"
          className={styles.textInput}
          placeholder={t('settings.currentPasswordPlaceholder')}
          value={emailForm.currentPassword}
          onChange={(e) => setEmailForm((f) => ({ ...f, currentPassword: e.target.value }))}
          required
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn}>{t('settings.changeEmail')}</Button>
        {emailMsg && (
          <p className={emailMsg.type === 'error' ? styles.msgError : styles.msgOk}>{emailMsg.text}</p>
        )}
      </form>

      <form className={styles.subForm} onSubmit={handlePasswordSubmit}>
        <h3 className={styles.subTitle}>{t('settings.changePassword')}</h3>
        <input
          type="password"
          className={styles.textInput}
          placeholder={t('settings.currentPasswordPlaceholder')}
          value={pwForm.currentPassword}
          onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
          required
        />
        <input
          type="password"
          className={styles.textInput}
          placeholder={t('settings.newPasswordPlaceholder')}
          value={pwForm.newPassword}
          onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
          required
        />
        <span className={styles.hint}>{t('auth.passwordHint')}</span>
        <input
          type="password"
          className={styles.textInput}
          placeholder={t('settings.confirmPasswordPlaceholder')}
          value={pwForm.confirmPassword}
          onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
          required
        />
        <Button type="submit" variant="primary" size="md" className={styles.submitBtn}>{t('settings.changePassword')}</Button>
        {pwMsg && (
          <p className={pwMsg.type === 'error' ? styles.msgError : styles.msgOk}>{pwMsg.text}</p>
        )}
      </form>

      <div className={styles.dangerZone}>
        <h3 className={styles.subTitle}>{t('settings.deleteAccountTitle')}</h3>
        <p className={styles.hint}>{t('settings.deleteAccountHint')}</p>
        <Button variant="danger" size="md" onClick={() => setShowDelete(true)}>
          <Trash2 size={16} aria-hidden="true" /> {t('settings.deleteAccountBtn')}
        </Button>
      </div>

      <Button variant="ghost" size="md" className={styles.logoutBtn} onClick={logout}>{t('nav.logout')}</Button>

      {showDelete && (
        <DeleteAccountDialog
          userEmail={user.email}
          onConfirm={handleDeleteAccount}
          onCancel={() => { setShowDelete(false); setDeleteError(null); }}
          loading={deleteLoading}
          error={deleteError}
        />
      )}
    </section>
  );
}
