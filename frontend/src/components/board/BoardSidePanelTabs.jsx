/**
 * BoardSidePanelTabs – Zeichnen/Lines/Formationen/Export/Notizen/Einstellungen
 * als Tab-Leiste unter der Frame-Timeline statt als lange Scroll-Liste
 * seitlich neben dem Feld.
 *
 * Standardmäßig eingeklappt (nur die schmale Tab-Leiste sichtbar) – der
 * Fokus soll auf dem Spielfeld bleiben, nicht auf dem Menü darunter.
 */
import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '../common/Button.jsx';
import styles from './BoardSidePanelTabs.module.css';

// forceActivate (Layer-System, CLAUDE.md §10.2): { tabId, token } von
// außen erzwingt einen Tab-Wechsel + Aufklappen, z.B. wenn
// BoardEditorPage.jsx auf einen Kommentar-Pin-Klick reagiert. `token`
// muss sich bei jedem Aufruf ändern (z.B. ein Zähler), sonst würde ein
// zweiter Klick auf einen ANDEREN Pin bei bereits offenem Comments-Tab
// keinen neuen Effekt auslösen.
export default function BoardSidePanelTabs({ tabs, forceActivate }) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const [expanded, setExpanded] = useState(false);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  useEffect(() => {
    if (!forceActivate?.tabId) return;
    setActiveId(forceActivate.tabId);
    setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceActivate?.token]);

  if (tabs.length === 0) return null;

  const handleTabClick = (id) => {
    if (expanded && id === activeId) {
      setExpanded(false);
    } else {
      setActiveId(id);
      setExpanded(true);
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBar} role="tablist" aria-label={t('boardEditor.tabsAriaLabel')}>
        {tabs.map((tab) => (
          <Fragment key={tab.id}>
            <button
              type="button"
              role="tab"
              id={`board-tab-${tab.id}`}
              data-tour={tab.tourId}
              aria-selected={expanded && tab.id === active?.id}
              aria-controls={`board-tabpanel-${tab.id}`}
              className={`${styles.tabBtn} ${expanded && tab.id === active?.id ? styles.active : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
            {/* UI/UX-Audit: thematische Gruppierung statt 9 gleichrangiger
                Tabs – ein dezenter Trenner markiert Gruppengrenzen
                (Bearbeiten / Info / Sonstiges), von BoardEditorPage.jsx
                per tab.groupEnd markiert. */}
            {tab.groupEnd && <span className={styles.groupDivider} aria-hidden="true" />}
          </Fragment>
        ))}
        <Button
          variant="secondary"
          size="md"
          iconOnly
          className={styles.collapseBtn}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? t('boardEditor.collapsePanel') : t('boardEditor.expandPanel')}
          title={expanded ? t('boardEditor.collapsePanel') : t('boardEditor.expandPanel')}
        >
          <span aria-hidden="true">{expanded ? '▾' : '▴'}</span>
        </Button>
      </div>
      {expanded && (
        <div
          className={styles.tabContent}
          role="tabpanel"
          id={`board-tabpanel-${active?.id}`}
          aria-labelledby={`board-tab-${active?.id}`}
        >
          {active?.content}
        </div>
      )}
    </div>
  );
}
