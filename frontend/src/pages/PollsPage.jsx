/**
 * PollsPage – Umfragen/Polls (Roadmap-Audit, Phase D "Kommunikation –
 * minimal", schließt die Phase neben News ab). Ein Coach/Owner stellt
 * eine Frage mit mehreren Optionen, Team-Mitglieder stimmen ab,
 * Ergebnisse sind immer für alle sichtbar. Kein Kommentieren.
 */
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ListChecks, Plus, X, Lock, Trash2 } from 'lucide-react';
import { useTeams } from '../hooks/useTeams.js';
import { usePolls } from '../hooks/usePolls.js';
import { formatDate } from '../utils/formatDate.js';
import Button from '../components/common/Button.jsx';
import styles from './PollsPage.module.css';

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

export default function PollsPage() {
  const { t } = useTranslation();
  const { teams, fetchTeams } = useTeams();
  const { polls, loading, error, fetchPolls, createPoll, vote, closePoll, deletePoll } = usePolls();

  const [teamId,         setTeamId        ] = useState('');
  const [question,       setQuestion      ] = useState('');
  const [multipleChoice, setMultipleChoice] = useState(false);
  const [options,        setOptions       ] = useState(['', '']);
  const [sending,        setSending       ] = useState(false);

  const load = useCallback(async () => {
    try { await fetchPolls(); } catch { /* error via hook */ }
  }, [fetchPolls]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);

  const teamsICanPostTo = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');

  useEffect(() => {
    if (!teamId && teamsICanPostTo.length > 0) setTeamId(teamsICanPostTo[0]._id);
  }, [teamId, teamsICanPostTo]);

  const teamName = (id) => teams.find((tm) => tm._id === id)?.name ?? '';
  const canManage = (id) => ['owner', 'coach'].includes(teams.find((tm) => tm._id === id)?.role);

  const setOptionAt = (index, value) => setOptions((prev) => prev.map((o, i) => i === index ? value : o));
  const addOption    = () => setOptions((prev) => prev.length < MAX_OPTIONS ? [...prev, ''] : prev);
  const removeOption  = (index) => setOptions((prev) => prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev);

  const validOptions = options.map((o) => o.trim()).filter(Boolean);
  const canSubmit = teamId && question.trim() && validOptions.length >= MIN_OPTIONS;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    try {
      await createPoll(teamId, question.trim(), multipleChoice, validOptions);
      setQuestion('');
      setMultipleChoice(false);
      setOptions(['', '']);
    } catch {
      // Fehler über error
    } finally {
      setSending(false);
    }
  };

  const handleVote = (pollId, optionId) => vote(pollId, optionId).catch(() => {});
  const handleClose = (pollId) => closePoll(pollId).catch(() => {});
  const handleDelete = (pollId) => deletePoll(pollId).catch(() => {});

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('polls.title')}</h1>
        <p className={styles.subtitle}>
          {polls.length > 0 ? t('polls.count', { count: polls.length }) : t('polls.noPollsYet')}
        </p>
      </header>

      {error && (
        <div className={styles.errorBanner} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</div>
      )}

      {teams.length === 0 ? (
        <p className={styles.hint}>{t('polls.noTeamHint')}</p>
      ) : teamsICanPostTo.length > 0 && (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <select
            className={styles.teamSelect}
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            aria-label={t('polls.teamAriaLabel')}
          >
            {teamsICanPostTo.map((tm) => (
              <option key={tm._id} value={tm._id}>{tm.name}</option>
            ))}
          </select>
          <input
            type="text"
            className={styles.questionInput}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('polls.questionPlaceholder')}
            maxLength={300}
            aria-label={t('polls.questionAriaLabel')}
          />
          <div className={styles.optionsList}>
            {options.map((opt, i) => (
              <div key={i} className={styles.optionRow}>
                <input
                  type="text"
                  className={styles.optionInput}
                  value={opt}
                  onChange={(e) => setOptionAt(i, e.target.value)}
                  placeholder={t('polls.optionPlaceholder', { number: i + 1 })}
                  maxLength={100}
                  aria-label={t('polls.optionAriaLabel', { number: i + 1 })}
                />
                {options.length > MIN_OPTIONS && (
                  <Button variant="secondary" size="sm" iconOnly onClick={() => removeOption(i)} aria-label={t('polls.removeOptionAriaLabel')}>
                    <X size={14} aria-hidden="true" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button type="button" variant="secondary" size="sm" onClick={addOption}>
                <Plus size={14} aria-hidden="true" /> {t('polls.addOption')}
              </Button>
            )}
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={multipleChoice} onChange={(e) => setMultipleChoice(e.target.checked)} />
            {t('polls.multipleChoiceLabel')}
          </label>
          <Button type="submit" variant="primary" size="md" disabled={sending || !canSubmit}>
            {t('polls.submit')}
          </Button>
        </form>
      )}

      {loading && polls.length === 0 ? (
        <p className={styles.hint}>{t('polls.loading')}</p>
      ) : polls.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <ListChecks size={32} aria-hidden="true" />
          <p>{t('polls.emptyStateDesc')}</p>
        </div>
      ) : (
        <ul className={styles.feed} role="list">
          {polls.map((poll) => {
            const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);
            return (
              <li key={poll._id} className={styles.pollCard}>
                <div className={styles.pollHead}>
                  <span className={styles.teamBadge}>{teamName(poll.teamId)}</span>
                  {poll.closedAt && (
                    <span className={styles.closedBadge}><Lock size={12} aria-hidden="true" /> {t('polls.closedBadge')}</span>
                  )}
                  <span className={styles.time}>{formatDate(poll.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                </div>
                <p className={styles.question}>{poll.question}</p>
                <div className={styles.optionsResults}>
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;
                    return (
                      <button
                        key={opt._id}
                        type="button"
                        className={`${styles.optionResult} ${opt.votedByMe ? styles.optionResultVoted : ''}`}
                        onClick={() => handleVote(poll._id, opt._id)}
                        disabled={!!poll.closedAt}
                        aria-pressed={opt.votedByMe}
                      >
                        <span className={styles.optionResultLabel}>
                          <span>{opt.text}</span>
                          <span className={styles.voteCount}>{t('polls.voteCount', { count: opt.voteCount })}</span>
                        </span>
                        <span className={styles.progressBar}>
                          <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className={styles.pollFoot}>
                  <span className={styles.author}>{poll.email}</span>
                  {canManage(poll.teamId) && (
                    <div className={styles.pollActions}>
                      {!poll.closedAt && (
                        <Button variant="secondary" size="sm" onClick={() => handleClose(poll._id)}>
                          {t('polls.closeAction')}
                        </Button>
                      )}
                      <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(poll._id)} aria-label={t('polls.deleteAriaLabel')} title={t('polls.deleteTitle')}>
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
