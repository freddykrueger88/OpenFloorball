/**
 * BoardsPage – Übersichtsseite aller Spielfelder
 * Kachel-Ansicht mit Anlegen, Umbenennen, Löschen
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Presentation, SearchX, Plus, Grid2x2, Grid3x3, Sparkles } from 'lucide-react';
import { useBoardsApi } from '../hooks/useBoardsApi.js';
import { useSettings } from '../hooks/useSettings.js';
import { usePlaybooks } from '../hooks/usePlaybooks.js';
import { useTeams } from '../hooks/useTeams.js';
import { useOrganizations } from '../hooks/useOrganizations.js';
import { useAiApi } from '../hooks/useAiApi.js';
import { useDemoData } from '../hooks/useDemoData.js';
import BoardCard from '../components/boards/BoardCard.jsx';
import BoardPostcard from '../components/boards/BoardPostcard.jsx';
import NewBoardModal from '../components/boards/NewBoardModal.jsx';
import DeleteConfirmDialog from '../components/boards/DeleteConfirmDialog.jsx';
import PlaybookFilterBar from '../components/boards/PlaybookFilterBar.jsx';
import AiTacticAssistantModal from '../components/boards/AiTacticAssistantModal.jsx';
import AiAnalysisAssistantModal from '../components/boards/AiAnalysisAssistantModal.jsx';
import Button from '../components/common/Button.jsx';
import styles from './BoardsPage.module.css';

const VIEW_STORAGE_KEY = 'openfloorball:boardsView';

export default function BoardsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, error, fetchBoards, createBoard, updateBoard, deleteBoard } = useBoardsApi();
  const { settings } = useSettings();
  const {
    playbooks, fetchPlaybooks, createPlaybook, updatePlaybook, deletePlaybook, canAddPlaybook,
  } = usePlaybooks();
  // ROADMAP Phase 2: eigene Teams laden, um Playbooks optional
  // team-geteilt statt rein persönlich anzulegen (analog Roster/Trainings).
  const { teams, fetchTeams } = useTeams();
  const teamsICanShareWith = teams.filter((tm) => tm.role === 'owner' || tm.role === 'coach');
  // EPIC 011: vereinsweit geteilte Playbooks – nur Vereins-Admins dürfen
  // welche anlegen (analog teamsICanShareWith oben, siehe
  // playbooksController.createPlaybook).
  const { organizations, fetchOrganizations } = useOrganizations();
  // EPIC 010 – KI-Taktik-/Analyseassistent: Buttons nur sichtbar, wenn
  // diese Instanz überhaupt einen KI-Anbieter konfiguriert hat.
  const { fetchStatus: fetchAiStatus } = useAiApi();
  const [aiStatus, setAiStatus] = useState(null);
  // Onboarding-Ausbau: Empty-State-Hinweis für Bestandsnutzer ohne Demo-Daten
  // (neue Accounts bekommen sie bereits direkt nach der Registrierung, siehe
  // RegisterPage.jsx – hier greift nur der manuelle Fallback).
  const { status: demoStatus, createDemoData } = useDemoData();
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [showTacticModal,  setShowTacticModal ] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const [boards,        setBoards       ] = useState([]);
  const [showNewModal,  setShowNewModal  ] = useState(false);
  const [deleteTarget,  setDeleteTarget  ] = useState(null); // { id, name }
  // Playbook-Filter (Issue #52): 'all' | 'none' | playbookId
  const [playbookFilter, setPlaybookFilter] = useState('all');
  // Gegner-Suche (ROADMAP-Backlog): freie Textsuche statt fester Liste,
  // da Gegner ein Freitextfeld ohne feste Werte ist
  const [opponentQuery, setOpponentQuery] = useState('');
  // Übungskategorie-Filter (ROADMAP-Backlog: Übungsbibliothek): 'all' oder
  // einer der festen category-Werte aus dem Datenmodell
  const [categoryFilter, setCategoryFilter] = useState('all');
  const CATEGORIES = ['technik', 'taktik', 'kondition', 'spielverstaendnis', 'nachwuchs'];
  // Ansicht: Postkarten-Galerie ↔ Kompakt-Kachel (Issue #30)
  const [view, setView] = useState(() => localStorage.getItem(VIEW_STORAGE_KEY) || 'postcard');

  const setViewMode = useCallback((mode) => {
    setView(mode);
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  }, []);

  const load = useCallback(async () => {
    try { setBoards(await fetchBoards()); } catch { /* error via hook */ }
  }, [fetchBoards]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetchPlaybooks(); }, [fetchPlaybooks]);
  useEffect(() => { fetchTeams().catch(() => {}); }, [fetchTeams]);
  useEffect(() => { fetchOrganizations().catch(() => {}); }, [fetchOrganizations]);
  useEffect(() => { fetchAiStatus().then(setAiStatus).catch(() => {}); }, [fetchAiStatus]);

  const filteredBoards = useMemo(() => {
    let result = boards;
    if (playbookFilter === 'none') result = result.filter((b) => !b.playbookId);
    else if (playbookFilter !== 'all') result = result.filter((b) => b.playbookId === playbookFilter);

    const query = opponentQuery.trim().toLowerCase();
    if (query) result = result.filter((b) => b.opponent?.toLowerCase().includes(query));

    if (categoryFilter !== 'all') result = result.filter((b) => b.category === categoryFilter);

    return result;
  }, [boards, playbookFilter, opponentQuery, categoryFilter]);

  const handleChangeBoardPlaybook = async (boardId, playbookId) => {
    try {
      const current = boards.find((b) => b._id === boardId);
      const updated = await updateBoard(boardId, { playbookId }, {
        baselineUpdatedAt: current?.updatedAt ?? null,
        label: current?.name ?? null,
      });
      setBoards((prev) => prev.map((b) => b._id === boardId ? updated : b));
    } catch { /* error via hook */ }
  };

  const handleRenamePlaybook = (playbook, newName) => {
    updatePlaybook(playbook._id, { name: newName }, {
      baselineUpdatedAt: playbook.updatedAt, label: playbook.name,
    }).catch(() => {});
  };

  const handleDeletePlaybook = async (id) => {
    await deletePlaybook(id);
    setBoards((prev) => prev.map((b) => b.playbookId === id ? { ...b, playbookId: null } : b));
    setPlaybookFilter((prev) => prev === id ? 'all' : prev);
  };

  const handleCreate = async (data) => {
    try {
      const board = await createBoard({
        homeColor: settings?.defaultHomeColor,
        awayColor: settings?.defaultAwayColor,
        ballColor: settings?.defaultBallColor,
        ...data,
      });
      setShowNewModal(false);
      setShowTacticModal(false);
      setShowAnalysisModal(false);
      navigate(`/board/${board._id}`);
    } catch { /* error via hook */ }
  };

  const handleCreateDemoData = async () => {
    setCreatingDemo(true);
    try {
      await createDemoData();
      fetchTeams().catch(() => {});
    } catch { /* error via hook */ } finally {
      setCreatingDemo(false);
    }
  };

  const handleRename = async (id, name) => {
    try {
      const current = boards.find((b) => b._id === id);
      const updated = await updateBoard(id, { name }, {
        baselineUpdatedAt: current?.updatedAt ?? null,
        label: current?.name ?? null,
      });
      setBoards((prev) => prev.map((b) => b._id === id ? updated : b));
    } catch { /* error via hook */ }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      const current = boards.find((b) => b._id === deleteTarget.id);
      await deleteBoard(deleteTarget.id, {
        baselineUpdatedAt: current?.updatedAt ?? null,
        label: current?.name ?? deleteTarget.name ?? null,
      });
      setBoards((prev) => prev.filter((b) => b._id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* error via hook */ }
  };

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('nav.boards')}</h1>
          <p className={styles.subtitle}>
            {boards.length > 0
              ? t('boardsPage.count', { count: boards.length })
              : t('boardsPage.noBoardsYet')}
          </p>
        </div>
      </header>

      <div className={styles.actionsBar}>
        <Button
          variant="primary"
          size="md"
          className={styles.newBtn}
          onClick={() => setShowNewModal(true)}
          aria-label={t('boardsPage.newBoardAriaLabel')}
        >
          <Plus size={16} aria-hidden="true" /> {t('boardsPage.newBoard')}
        </Button>

        {aiStatus?.configured && (
          <>
            <Button variant="secondary" size="md" onClick={() => setShowTacticModal(true)}>
              <Sparkles size={16} aria-hidden="true" /> {t('ai.tacticAssistant')}
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowAnalysisModal(true)}>
              <Sparkles size={16} aria-hidden="true" /> {t('ai.analysisAssistant')}
            </Button>
          </>
        )}

        {boards.length > 0 && (
          <input
            type="search"
            className={styles.opponentSearch}
            value={opponentQuery}
            onChange={(e) => setOpponentQuery(e.target.value)}
            placeholder={t('boardsPage.opponentSearchPlaceholder')}
            aria-label={t('boardsPage.opponentSearchAriaLabel')}
          />
        )}

        {boards.length > 0 && (
          <select
            className={styles.opponentSearch}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label={t('boardsPage.categoryFilterAriaLabel')}
          >
            <option value="all">{t('boardsPage.categoryFilterAll')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`exerciseCategory.${c}`)}</option>
            ))}
          </select>
        )}

        {/* Postkarten-Galerie ↔ Kompakt-Kachel Toggle (Issue #30) */}
        <div className={styles.viewToggle} role="group" aria-label={t('boardsPage.viewToggleLabel')}>
          <button
            className={`${styles.viewBtn} ${view === 'postcard' ? styles.viewActive : ''}`}
            onClick={() => setViewMode('postcard')}
            aria-pressed={view === 'postcard'}
            aria-label={t('boardsPage.postcardView')}
            title={t('boardsPage.postcardView')}
          >
            <Grid2x2 size={18} aria-hidden="true" />
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'compact' ? styles.viewActive : ''}`}
            onClick={() => setViewMode('compact')}
            aria-pressed={view === 'compact'}
            aria-label={t('boardsPage.compactView')}
            title={t('boardsPage.compactView')}
          >
            <Grid3x3 size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {boards.length > 0 && (
        <PlaybookFilterBar
          playbooks={playbooks}
          boards={boards}
          activeFilter={playbookFilter}
          onFilterChange={setPlaybookFilter}
          onCreatePlaybook={createPlaybook}
          onRenamePlaybook={handleRenamePlaybook}
          onDeletePlaybook={handleDeletePlaybook}
          canAddPlaybook={canAddPlaybook}
          teams={teamsICanShareWith}
          organizations={organizations}
        />
      )}

      {error && (
        <div className={styles.errorBanner} role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
        </div>
      )}

      {loading && boards.length === 0 ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label={t('boardsPage.loadingBoards')}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon} aria-hidden="true"><Presentation size={40} aria-hidden="true" /></div>
          <h2>{t('boardsPage.noBoardsYet')}</h2>
          <p>{t('boardsPage.emptyStateDesc')}</p>
          <Button
            variant="primary"
            size="md"
            className={styles.newBtn}
            onClick={() => setShowNewModal(true)}
          >
            {t('boardsPage.createFirstBoard')}
          </Button>
          {demoStatus && !demoStatus.hasDemoData && (
            <>
              <p className={styles.emptyStateDemoHint}>{t('boardsPage.demoDataHint')}</p>
              <Button variant="secondary" size="md" onClick={handleCreateDemoData} disabled={creatingDemo}>
                <Sparkles size={16} aria-hidden="true" /> {creatingDemo ? t('boardsPage.demoDataCreating') : t('boardsPage.demoDataCreateBtn')}
              </Button>
            </>
          )}
        </div>
      ) : filteredBoards.length === 0 ? (
        <div className={styles.emptyState} role="status">
          <div className={styles.emptyIcon} aria-hidden="true"><SearchX size={40} aria-hidden="true" /></div>
          <p>{t('boardsPage.noBoardsMatchFilter')}</p>
        </div>
      ) : (
        <ul
          className={view === 'postcard' ? styles.postcardGrid : styles.grid}
          role="list"
          aria-label={t('nav.boards')}
        >
          {filteredBoards.map((board) => (
            <li key={board._id}>
              {view === 'postcard' ? (
                <BoardPostcard
                  board={board}
                  onClick={() => navigate(`/board/${board._id}`)}
                  onDelete={() => setDeleteTarget({ id: board._id, name: board.name })}
                  playbooks={playbooks}
                  onChangePlaybook={(playbookId) => handleChangeBoardPlaybook(board._id, playbookId)}
                />
              ) : (
                <BoardCard
                  board={board}
                  onClick={() => navigate(`/board/${board._id}`)}
                  onRename={(name) => handleRename(board._id, name)}
                  onDelete={() => setDeleteTarget({ id: board._id, name: board.name })}
                  playbooks={playbooks}
                  onChangePlaybook={(playbookId) => handleChangeBoardPlaybook(board._id, playbookId)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {showNewModal && (
        <NewBoardModal
          onConfirm={handleCreate}
          onClose={() => setShowNewModal(false)}
          loading={loading}
          defaultFieldType={settings?.defaultFieldType ?? 'large'}
        />
      )}

      {showTacticModal && (
        <AiTacticAssistantModal
          onClose={() => setShowTacticModal(false)}
          onCreate={handleCreate}
          creating={loading}
        />
      )}

      {showAnalysisModal && (
        <AiAnalysisAssistantModal
          onClose={() => setShowAnalysisModal(false)}
          onCreate={handleCreate}
          creating={loading}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmDialog
          boardName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          loading={loading}
        />
      )}
    </main>
  );
}
