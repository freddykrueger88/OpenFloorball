/**
 * NewsPage – News/Ankündigungen (Roadmap-Audit, Phase D "Kommunikation
 * – minimal"). Bewusst kein Vollchat: ein Coach/Owner postet kurze
 * Mitteilungen an sein Team, alle Mitglieder lesen sie in einer
 * chronologischen Liste, kein Kommentieren/Antworten.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Megaphone, Trash2, Send } from 'lucide-react';
import { useTeams } from '../hooks/useTeams.js';
import { useAnnouncements } from '../hooks/useAnnouncements.js';
import { formatDate } from '../utils/formatDate.js';
import Button from '../components/common/Button.jsx';
import styles from './NewsPage.module.css';

export default function NewsPage() {
  const { t } = useTranslation();
  const { teams, fetchTeams } = useTeams();
  const { announcements, loading, error, fetchAnnouncements, createAnnouncement, deleteAnnouncement } = useAnnouncements();

  const [teamId, setTeamId] = useState('');
  const [text,   setText  ] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try { await fetchAnnouncements(); } catch { /* error via hook */ }
  }, [fetchAnnouncements]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const teamsICanPostTo = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  useEffect(() => {
    if (!teamId && teamsICanPostTo.length > 0) setTeamId(teamsICanPostTo[0]._id);
  }, [teamId, teamsICanPostTo]);

  const teamName = (id) => teams.find((tm) => tm._id === id)?.name ?? '';
  const canDelete = (id) => ['owner', 'coach'].includes(teams.find((tm) => tm._id === id)?.role);

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !teamId) return;
    setSending(true);
    try {
      await createAnnouncement(teamId, trimmed);
      setText('');
    } catch {
      // Fehler über error – Text bleibt im Feld stehen
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    try { await deleteAnnouncement(id); } catch { /* error via hook */ }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('news.title')}</h1>
        <p className={styles.subtitle}>
          {announcements.length > 0 ? t('news.count', { count: announcements.length }) : t('news.noAnnouncementsYet')}
        </p>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {teams.length === 0 ? (
        <p className={styles.hint}>{t('news.noTeamHint')}</p>
      ) : teamsICanPostTo.length > 0 && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <select
            className={styles.teamSelect}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            aria-label={t('news.teamAriaLabel')}
          >
            {teamsICanPostTo.map((tm) => (
              <option key={tm._id} value={tm._id}>{tm.name}</option>
            ))}
          </select>
          <textarea
            className={styles.textInput}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('news.textPlaceholder')}
            maxLength={2000}
            rows={2}
            aria-label={t('news.textAriaLabel')}
          />
          <Button type="submit" variant="primary" size="md" disabled={sending || !text.trim()}>
            <Send size={16} aria-hidden="true" /> {t('news.submit')}
          </Button>
        </form>
      )}

      {loading && announcements.length === 0 ? (
        <p className={styles.hint}>{t('news.loading')}</p>
      ) : announcements.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <Megaphone size={32} aria-hidden="true" />
          <p>{t('news.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.feed} role="list">
          {announcements.map((item) => (
            <li key={item._id} className={styles.feedItem}>
              <div className={styles.feedItemHead}>
                <span className={styles.teamBadge}>{teamName(item.teamId)}</span>
                <span className={styles.time}>{formatDate(item.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className={styles.text}>{item.text}</p>
              <div className={styles.feedItemFoot}>
                <span className={styles.author}>{item.email}</span>
                {canDelete(item.teamId) && (
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    onClick={() => handleDelete(item._id)}
                    aria-label={t('news.deleteAriaLabel')}
                    title={t('news.deleteTitle')}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
