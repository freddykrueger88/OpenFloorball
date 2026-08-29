/**
 * GlossaryPage – Floorball-Lexikon (Onboarding-Ausbau). Struktur analog
 * LibraryPage.jsx (Suche + Kategorie-Filter + Grid), aber komplett
 * clientseitig gefiltert (statische, kleine Content-Datei statt Backend-
 * Roundtrip, siehe content/glossaryEntries.js) und mit aufklappbaren
 * Detailansichten statt eigener Detail-Route (einfacher für Mobile, kein
 * Deep-Link-Aufwand für eine überschaubare Begriffsliste).
 *
 * Bewusst öffentlich erreichbar (kein PrivateRoute-Wrapper in App.jsx) wie
 * /rules und /privacy – Lexikon-Inhalt ist nicht personenbezogen.
 */
import { useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchX, ChevronDown } from 'lucide-react';
import { getGlossaryEntries } from '../content/glossaryEntries.js';
import styles from './GlossaryPage.module.css';

const CATEGORIES = ['positionen', 'grundbegriffe', 'regeln', 'taktik', 'training', 'spielorganisation'];

export default function GlossaryPage() {
  const { t, i18n } = useTranslation();
  const entries = useMemo(() => getGlossaryEntries(i18n.language), [i18n.language]);
  const entryBySlug = useMemo(() => new Map(entries.map((e) => [e.slug, e])), [entries]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expanded, setExpanded] = useState(() => new Set());
  const cardRefs = useRef({});

  const filteredEntries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return entries.filter((entry) => {
      if (categoryFilter !== 'all' && entry.category !== categoryFilter) return false;
      if (!query) return true;
      const haystack = [entry.term, entry.summary, ...(entry.synonyms ?? [])].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, searchQuery, categoryFilter]);

  const toggleExpanded = (slug) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  };

  const jumpToRelated = (slug) => {
    setExpanded((prev) => new Set(prev).add(slug));
    // Zielkarte könnte durch Suche/Filter aktuell ausgeblendet sein – dann
    // Filter zurücksetzen, statt einen scheinbar toten Link anzubieten.
    const related = entryBySlug.get(slug);
    if (related && categoryFilter !== 'all' && related.category !== categoryFilter) {
      setCategoryFilter('all');
    }
    if (related && searchQuery.trim()) setSearchQuery('');
    requestAnimationFrame(() => {
      cardRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <h1 className={styles.title}>{t('glossary.title')}</h1>
        <p className={styles.subtitle}>{t('glossary.subtitle')}</p>
      </header>

      <div className={styles.actionsBar}>
        <input
          type="search"
          className={styles.searchInput}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('glossary.searchPlaceholder')}
          aria-label={t('glossary.searchAriaLabel')}
        />
      </div>

      <div className={styles.categoryRow} role="group" aria-label={t('glossary.categoryFilterAll')}>
        <button
          type="button"
          className={`${styles.categoryBtn} ${categoryFilter === 'all' ? styles.categoryBtnActive : ''}`}
          aria-pressed={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        >
          {t('glossary.categoryFilterAll')}
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.categoryBtn} ${categoryFilter === c ? styles.categoryBtnActive : ''}`}
            aria-pressed={categoryFilter === c}
            onClick={() => setCategoryFilter(c)}
          >
            {t(`glossary.categories.${c}`)}
          </button>
        ))}
      </div>

      {filteredEntries.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon} aria-hidden="true"><SearchX size={40} aria-hidden="true" /></div>
          <p>{t('glossary.noResults')}</p>
        </div>
      ) : (
        <ul className={styles.grid} role="list" aria-label={t('glossary.title')}>
          {filteredEntries.map((entry) => {
            const isOpen = expanded.has(entry.slug);
            return (
              <li
                key={entry.slug}
                ref={(el) => { cardRefs.current[entry.slug] = el; }}
                className={styles.card}
              >
                <button
                  type="button"
                  className={styles.cardHeader}
                  aria-expanded={isOpen}
                  aria-controls={`glossary-body-${entry.slug}`}
                  onClick={() => toggleExpanded(entry.slug)}
                >
                  <span>
                    <span className={styles.cardTerm}>{entry.term}</span>
                    <span className={styles.cardCategory}>{t(`glossary.categories.${entry.category}`)}</span>
                  </span>
                  <ChevronDown size={18} aria-hidden="true" className={isOpen ? styles.chevronOpen : ''} />
                </button>
                <p className={styles.cardSummary}>{entry.summary}</p>

                {isOpen && (
                  <div id={`glossary-body-${entry.slug}`} className={styles.cardBody}>
                    {entry.synonyms?.length > 0 && (
                      <p className={styles.synonyms}>
                        <strong>{t('glossary.synonymsLabel')}:</strong> {entry.synonyms.join(', ')}
                      </p>
                    )}
                    {entry.body.map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                    {entry.related?.length > 0 && (
                      <div className={styles.relatedRow}>
                        <span className={styles.relatedLabel}>{t('glossary.relatedLabel')}:</span>
                        {entry.related.map((slug) => {
                          const target = entryBySlug.get(slug);
                          if (!target) return null;
                          return (
                            <button key={slug} type="button" className={styles.relatedChip} onClick={() => jumpToRelated(slug)}>
                              {target.term}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
