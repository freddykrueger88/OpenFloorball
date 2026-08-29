/**
 * SettingsTabs – Tab-Leiste für die Einstellungsseite (UI/UX-Audit,
 * Stufe 3): ersetzt die vorherige "alle Bereiche untereinander +
 * Anker-Sidebar zum Hinscrollen"-Seite durch echte Tabs – immer nur EIN
 * Bereich sichtbar statt einer langen Wand aus Formularen
 * (Progressive Disclosure). Bewusst eine eigene, einfachere Komponente
 * statt Wiederverwendung von board/BoardSidePanelTabs.jsx – die ist auf
 * die einklappbare Board-Editor-Situation zugeschnitten (Fokus soll auf
 * dem Feld bleiben), hier ist die Tab-Leiste dagegen die ganze Seite.
 *
 * `activeId`/`onActiveIdChange` sind optional (Vereine-Ausbau): ohne sie
 * verwaltet die Komponente ihren aktiven Tab weiterhin selbst (bisheriges
 * Verhalten, unverändert für alle bestehenden Aufrufer). Übergibt der
 * Aufrufer beide Props, wird die Auswahl von außen gesteuert – nötig,
 * damit SettingsPage.jsx nach dem Gründen eines Vereins direkt zum neu
 * erschienenen "Vereine"-Tab wechseln kann.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './SettingsTabs.module.css';

export default function SettingsTabs({ tabs, activeId: controlledActiveId, onActiveIdChange }) {
  const { t } = useTranslation();
  const [internalActiveId, setInternalActiveId] = useState(tabs[0]?.id);
  const activeId = controlledActiveId ?? internalActiveId;
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const selectTab = (id) => (onActiveIdChange ? onActiveIdChange(id) : setInternalActiveId(id));

  if (tabs.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <div className={styles.tabBarEdge}>
        <div className={styles.tabBar} role="tablist" aria-label={t('settings.nav.categories')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`settings-tab-${tab.id}`}
              aria-selected={tab.id === active?.id}
              aria-controls={`settings-tabpanel-${tab.id}`}
              className={`${styles.tabBtn} ${tab.id === active?.id ? styles.active : ''}`}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div
        className={styles.tabContent}
        role="tabpanel"
        id={`settings-tabpanel-${active?.id}`}
        aria-labelledby={`settings-tab-${active?.id}`}
      >
        {active?.content}
      </div>
    </div>
  );
}
