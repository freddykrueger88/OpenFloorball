/**
 * OpenFloorball – Datenbankmigrationen
 * Vollständiges Schema: users, boards, frames, lines, exports, settings
 */
import 'dotenv/config';
import pool from './pool.js';
import logger from '../utils/logger.js';

export async function runMigrations() {
  const client = await pool.connect();
  try {
    logger.info('Running database migrations...');
    await client.query('BEGIN');

    // Extensions
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // ── updated_at Trigger Funktion ──────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ LANGUAGE 'plpgsql';
    `);

    // ── users ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email         TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        display_name  TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
      CREATE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

    // ── settings ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id          UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        preferences_json JSONB NOT NULL DEFAULT '{}',
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
      CREATE TRIGGER trg_settings_updated_at
        BEFORE UPDATE ON settings
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);`);

    // ── boards ────────────────────────────────────────────────────────────
    // field_type: 'large' | 'small' | 'street' | '3v3'
    await client.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        field_type  TEXT NOT NULL DEFAULT 'large'
                    CHECK (field_type IN ('large', 'small', 'street', '3v3')),
        description TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_boards_updated_at ON boards;
      CREATE TRIGGER trg_boards_updated_at
        BEFORE UPDATE ON boards
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boards_created_at ON boards(created_at DESC);`);

    // ── playbooks (Issue #52 – Board-Sammlungen) ────────────────────────────
    // Muss vor der boards.playbook_id-Spalte angelegt werden (FK-Ziel).
    await client.query(`
      CREATE TABLE IF NOT EXISTS playbooks (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playbooks_user_id ON playbooks(user_id);`);

    // ── boards: zusätzliche Spalten für Editor-Einstellungen ─────────────
    // (nachträglich ergänzt – ALTER statt neuer CREATE TABLE, damit bestehende
    //  Daten erhalten bleiben; alle Statements sind idempotent)
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS theme TEXT NOT NULL DEFAULT 'dark'
      CHECK (theme IN ('dark', 'light', 'vikings', 'iff'));`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS home_color TEXT NOT NULL DEFAULT '#1d4ed8';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS away_color TEXT NOT NULL DEFAULT '#dc2626';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS ball_color TEXT NOT NULL DEFAULT '#ffffff';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_grid BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS show_names BOOLEAN NOT NULL DEFAULT true;`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS name_position TEXT NOT NULL DEFAULT 'below'
      CHECK (name_position IN ('above', 'below'));`);
    // Basis-Aufstellung (= "Frame 0"), analog zu den Frames unten
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS players_json JSONB NOT NULL DEFAULT '[]';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS elements_json JSONB NOT NULL DEFAULT '[]';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;`);
    // active_line_id gehörte zur alten, board-gescopten Lines-Funktion
    // (siehe unten) und wurde beim fachlichen Umbau auf Kader-basierte
    // Lines entfernt – kein Ersatz auf boards nötig.
    await client.query(`ALTER TABLE boards DROP COLUMN IF EXISTS active_line_id;`);
    // Issue #52 – nullable, ON DELETE SET NULL: löscht man ein Playbook,
    // bleiben die zugeordneten Boards erhalten, nur die Zuordnung entfällt.
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS playbook_id UUID
      REFERENCES playbooks(id) ON DELETE SET NULL;`);
    // ROADMAP-Backlog "Gegner-Tagging": freies Textfeld statt eigener
    // Tabelle – reicht für Filterung/Wiederfinden, kein Bedarf an
    // strukturierten Gegner-Datensätzen.
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS opponent TEXT NOT NULL DEFAULT '';`);
    // ROADMAP-Backlog "Übungsbibliothek": Boards lassen sich zusätzlich als
    // Trainings-Übung einordnen – additive Metadaten, ein Board bleibt
    // gleichzeitig als taktisches Spielzug-Board nutzbar (kein separater
    // "Exercise"-Typ, um das Datenmodell nicht zu verdoppeln).
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT ''
      CHECK (category IN ('', 'technik', 'taktik', 'kondition', 'spielverstaendnis', 'nachwuchs'));`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS age_group TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS goal TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE boards ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '';`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boards_category ON boards(category) WHERE category != '';`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boards_deleted_at ON boards(deleted_at) WHERE deleted_at IS NOT NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_boards_playbook_id ON boards(playbook_id) WHERE playbook_id IS NOT NULL;`);

    // ── frames ────────────────────────────────────────────────────────────
    // data_json: { players: [...], arrows: [...], lines: [...] }
    await client.query(`
      CREATE TABLE IF NOT EXISTS frames (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL DEFAULT 0,
        data_json   JSONB NOT NULL DEFAULT '{}',
        duration_ms INTEGER NOT NULL DEFAULT 1000,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_frames_board_id ON frames(board_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_frames_order ON frames(board_id, order_index);`);

    // Die alte, board-gescopte "lines"-Tabelle (Issue #12, v0.4.0) wird
    // weiter unten (nach roster_players, da line_players darauf referenziert)
    // durch das fachlich korrekte Kader-basierte Modell ersetzt. Der DROP
    // darf nur EINMALIG laufen (Migrationen laufen bei jedem Backend-Start
    // erneut!) – Erkennungsmerkmal: die alte Tabelle hatte eine board_id-
    // Spalte, die es im neuen Modell nicht mehr gibt. Ohne diese Prüfung
    // würde jeder Neustart versuchen, die (dann schon neue) Tabelle erneut
    // zu droppen und an der line_players-FK-Abhängigkeit scheitern.
    const oldLinesShape = await client.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'lines' AND column_name = 'board_id'`
    );
    if (oldLinesShape.rows.length > 0) {
      await client.query('DROP TABLE lines CASCADE;');
    }

    // ── formation_templates (Issue #46 – wiederverwendbare Aufstellungen) ──
    // Nutzer-gebunden statt board-gebunden – über alle eigenen Boards
    // hinweg wiederverwendbar.
    await client.query(`
      CREATE TABLE IF NOT EXISTS formation_templates (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        field_type   TEXT NOT NULL DEFAULT 'large'
                     CHECK (field_type IN ('large', 'small', 'street', '3v3')),
        players_json JSONB NOT NULL DEFAULT '[]',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_formation_templates_user_id ON formation_templates(user_id);`);

    // ── training_sessions + training_session_items (Issue #45 – Trainingsplaner) ──
    // Eine Session referenziert bestehende Boards per FK (kein Snapshot) –
    // Änderungen am Board spiegeln sich live im Plan.
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_sessions (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        notes      TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_training_sessions_updated_at ON training_sessions;
      CREATE TRIGGER trg_training_sessions_updated_at
        BEFORE UPDATE ON training_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_sessions_user_id ON training_sessions(user_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS training_session_items (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id       UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        board_id         UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        order_index      INTEGER NOT NULL DEFAULT 0,
        duration_minutes INTEGER NOT NULL DEFAULT 15,
        note             TEXT NOT NULL DEFAULT '',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_session_items_session_id ON training_session_items(session_id);`);

    // ── roster_players (Issue #53 – zentraler Team-Kader) ───────────────────
    // Nutzer-gebunden, unabhängig von Boards. Rein additiv/optional: Board-
    // Spielerdaten (players_json) bleiben frei editierbar, ein Kader-Eintrag
    // dient nur als Vorlage zum Zuweisen (kein Zwang zur Nutzung).
    await client.query(`
      CREATE TABLE IF NOT EXISTS roster_players (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        jersey_number  INTEGER,
        role           TEXT CHECK (role IN ('TW', 'V', 'C', 'S')),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_roster_players_user_id ON roster_players(user_id);`);

    // ── lines (fachlicher Umbau: Kader-basierte taktische Linien) ──────────
    // Ersetzt die alte, board-gescopte "lines"-Tabelle (Issue #12, v0.4.0,
    // oben per DROP TABLE entfernt), die nur anonyme Platzhalter-Tokens
    // EINES Board-Frames gruppierte – ohne jeden Bezug zum echten Kader.
    // Fachlich korrekt: eine Line ist eine taktische Zusammenstellung
    // echter Kader-Spieler (roster_players), wiederverwendbar über Boards/
    // Spiele hinweg, nutzer-/team-gebunden wie roster_players/games. Nur 2
    // Zeilen der alten Tabelle betroffen (Stand Umbau) – eine automatische
    // Migration wäre ohnehin unmöglich gewesen, da die alten Einträge keine
    // echte Spieler-Identität enthielten.
    await client.query(`
      CREATE TABLE IF NOT EXISTS lines (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
        name       TEXT NOT NULL,
        color      TEXT NOT NULL DEFAULT '#3B82F6',
        type       TEXT NOT NULL DEFAULT 'offense' CHECK (type IN ('offense', 'defense', 'special')),
        is_active  BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lines_user_id ON lines(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lines_team_id ON lines(team_id) WHERE team_id IS NOT NULL;`);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_lines_updated_at ON lines;
      CREATE TRIGGER trg_lines_updated_at
        BEFORE UPDATE ON lines
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // Many-to-many: ein Kader-Spieler darf in beliebig vielen Lines stehen,
    // eine Line enthält beliebig viele Kader-Spieler – exakt dasselbe Muster
    // wie team_members/board_collaborators (Junction-Tabelle, UNIQUE-Paar,
    // beidseitig ON DELETE CASCADE, ein Index pro FK-Seite). CASCADE sorgt
    // dafür, dass Löschen eines Spielers/einer Line automatisch nur die
    // Zuordnung entfernt, nie die jeweils andere Seite.
    await client.query(`
      CREATE TABLE IF NOT EXISTS line_players (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        line_id          UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
        roster_player_id UUID NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
        order_index      INTEGER NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (line_id, roster_player_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_line_players_line_id ON line_players(line_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_line_players_roster_player_id ON line_players(roster_player_id);`);

    // ── board_collaborators (Issue #51 MVP – Board-Sharing) ─────────────────
    // Kein Echtzeit-Sync (das wäre ein deutlich größerer Scope, siehe
    // Issue-Text) – nur ein Berechtigungsmodell: read (ansehen) oder
    // write (voll editieren wie der Owner, außer Löschen/Sharing selbst).
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_collaborators (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (board_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_collaborators_board_id ON board_collaborators(board_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_collaborators_user_id ON board_collaborators(user_id);`);

    // ── board_invites (E-Mail-Einladungsflow für noch nicht registrierte
    // Adressen) ──────────────────────────────────────────────────────────
    // board_collaborators setzt einen bestehenden Account voraus – für
    // unbekannte E-Mail-Adressen landet die Einladung hier, bis sie sich
    // mit genau dieser Adresse registrieren (siehe routes/auth.js), dann
    // wird automatisch eine board_collaborators-Zeile daraus.
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_invites (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        email       TEXT NOT NULL,
        permission  TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'write')),
        invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
        token       UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        expires_at  TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (board_id, email)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_invites_board_id ON board_invites(board_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_invites_email ON board_invites(email) WHERE accepted_at IS NULL;`);

    // ── board_videos (ROADMAP-Backlog: Video-/Spielfilm-Integration, MVP) ──
    // Ablage auf Disk (VIDEOS_DIR, analog EXPORTS_DIR) statt als DB-Blob.
    // Bewusst KEIN Ablauf-/Cleanup-Job wie bei exports – Videos sind
    // dauerhafter Nutzerinhalt, kein ephemerer Export. Löschung läuft über
    // deleteVideo (Owner/Write) bzw. kaskadierend beim Board-Löschen (siehe
    // boardsController.js/deleteBoard – Dateien werden dort explizit
    // mitgelöscht, weil Boards nur soft-deleted werden und der
    // ON DELETE CASCADE unten sonst nie greift).
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_videos (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename    TEXT NOT NULL,
        storage_key TEXT NOT NULL UNIQUE,
        mime_type   TEXT NOT NULL,
        size_bytes  BIGINT NOT NULL,
        title       TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_videos_board_id ON board_videos(board_id);`);

    // Video-Ausbau: feste Zeichnungs-Überlagerung, Player-seitige Trim-
    // Grenzen (Originaldatei bleibt unangetastet), Szenen-Marken. Bewusst
    // JSONB statt eigener Tabellen (analog boards.players_json) – erwartete
    // Anzahl Elemente/Marken pro Video ist klein.
    await client.query(`ALTER TABLE board_videos ADD COLUMN IF NOT EXISTS elements_json JSONB NOT NULL DEFAULT '[]'::jsonb;`);
    await client.query(`ALTER TABLE board_videos ADD COLUMN IF NOT EXISTS trim_start_seconds REAL;`);
    await client.query(`ALTER TABLE board_videos ADD COLUMN IF NOT EXISTS trim_end_seconds REAL;`);
    await client.query(`ALTER TABLE board_videos ADD COLUMN IF NOT EXISTS markers_json JSONB NOT NULL DEFAULT '[]'::jsonb;`);

    // ── teams + team_members (ROADMAP Phase 2 – Team und Organisation) ────
    // Additiv zum bestehenden user_id-Besitzmodell: ein Team teilt Kader/
    // Playbooks/Trainingspläne/Formationen zwischen mehreren Trainern (siehe
    // team_id-Spalten weiter unten), OHNE Boards selbst anzufassen – die
    // bestehende board_collaborators-Einzel-Freigabe bleibt granularer und
    // unverändert. created_by ist rein informativ (wer hat das Team
    // angelegt) – die eigentliche Berechtigung läuft über team_members.role.
    await client.query(`
      CREATE TABLE IF NOT EXISTS teams (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_teams_updated_at ON teams;
      CREATE TRIGGER trg_teams_updated_at
        BEFORE UPDATE ON teams
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);`);

    // role: owner (Ersteller/Cheftrainer, verwaltet Mitglieder+Rollen),
    // coach (Co-Trainer, darf team-geteilte Inhalte anlegen/bearbeiten),
    // member (Spieler, nur lesend) – bewusst 3 Stufen statt der vollen
    // Rollen-Hierarchie aus den Vision-Dokumenten.
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'coach', 'member')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (team_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);`);

    // ── Team-Fähigkeit der vier teilbaren Ressourcen (additiv, nullable) ───
    // team_id IS NULL → weiterhin rein persönlich (unverändertes Verhalten).
    await client.query(`ALTER TABLE roster_players ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_roster_players_team_id ON roster_players(team_id) WHERE team_id IS NOT NULL;`);
    await client.query(`ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playbooks_team_id ON playbooks(team_id) WHERE team_id IS NOT NULL;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_sessions_team_id ON training_sessions(team_id) WHERE team_id IS NOT NULL;`);
    await client.query(`ALTER TABLE formation_templates ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_formation_templates_team_id ON formation_templates(team_id) WHERE team_id IS NOT NULL;`);

    // ── comments (ROADMAP Phase 2 – Kommentare auf Boards und
    // Trainingseinheiten) ────────────────────────────────────────────────
    // Eine gemeinsame Tabelle mit resource_type als Diskriminator statt
    // zweier getrennter Tabellen – kein DB-seitiges FK über zwei
    // Zieltabellen hinweg möglich, daher wird beim Löschen eines Boards/
    // einer Trainingseinheit explizit in den jeweiligen Controllern
    // aufgeräumt (siehe boardsController.deleteBoard,
    // trainingSessionsController.deleteSession).
    await client.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resource_type TEXT NOT NULL CHECK (resource_type IN ('board', 'training_session')),
        resource_id   UUID NOT NULL,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text          TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_comments_updated_at ON comments;
      CREATE TRIGGER trg_comments_updated_at
        BEFORE UPDATE ON comments
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comments_resource ON comments(resource_type, resource_id);`);

    // ── board_versions (ROADMAP Phase 2 – automatische Versionierung) ────
    // Snapshot ALLER Frames eines Boards, entsteht automatisch bei jedem
    // Speichern (siehe framesController.updateFrame). Aufbewahrungsgrenze
    // von 50 Versionen pro Board (siehe dort) statt unbegrenztem Wachstum.
    await client.query(`
      CREATE TABLE IF NOT EXISTS board_versions (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id        UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        frames_snapshot JSONB NOT NULL,
        created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_board_versions_board_id ON board_versions(board_id, created_at DESC);`);

    // ── organizations + organization_members (ROADMAP Phase 2 – Verein-
    // Ebene). Reine Verwaltungsebene über mehreren Teams: ein Verein kann
    // Teams organisatorisch bündeln, teilt aber selbst KEINE Inhalte –
    // Kader/Playbooks/Trainingspläne/Formationen bleiben team_id-gebunden.
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name       TEXT NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_organizations_updated_at ON organizations;
      CREATE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role            TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (organization_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);`);

    await client.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams(organization_id) WHERE organization_id IS NOT NULL;`);

    // ── ROADMAP Phase 3 (Trainingsplanung): Datum + Ziel einer
    // Trainingseinheit – laut Roadmap gehören "Datum, Dauer, Ziel,
    // Übungen" zu den Kernfeldern; Dauer/Übungen sind über
    // training_session_items bereits abgedeckt.
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS scheduled_date DATE;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS goal TEXT NOT NULL DEFAULT '';`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_sessions_scheduled_date ON training_sessions(scheduled_date) WHERE scheduled_date IS NOT NULL;`);

    // ── Bugfix: teams.created_by / organizations.created_by hatten
    // ON DELETE CASCADE statt SET NULL. created_by ist reine Provenienz
    // (wird nie an die API exponiert) – die eigentliche Berechtigung läuft
    // über team_members.role='owner' bzw. organization_members.role='admin',
    // die unabhängig davon geändert werden kann. Der ursprüngliche
    // Ersteller kann das Team/den Verein längst verlassen haben und Monate
    // später seinen persönlichen Account löschen – mit CASCADE riss das
    // ganze Team/den Verein für alle verbleibenden Mitglieder mit, obwohl
    // die ursprünglich erstellende Person damit gar nichts mehr zu tun
    // hatte. Analog zu board_versions.created_by (dort schon korrekt).
    await client.query(`ALTER TABLE teams ALTER COLUMN created_by DROP NOT NULL;`);
    await client.query(`ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_created_by_fkey;`);
    await client.query(`ALTER TABLE teams ADD CONSTRAINT teams_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE organizations ALTER COLUMN created_by DROP NOT NULL;`);
    await client.query(`ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_created_by_fkey;`);
    await client.query(`ALTER TABLE organizations ADD CONSTRAINT organizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;`);

    // ── ROADMAP Phase 4 (Offline First/Sync): updated_at für Frames –
    // fehlte bisher (anders als boards, das updated_at + Trigger schon
    // hat), war aber Voraussetzung für eine Konflikterkennung beim
    // Offline-Sync über mehrere Geräte (siehe offlineSync.js).
    await client.query(`ALTER TABLE frames ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_frames_updated_at ON frames;
      CREATE TRIGGER trg_frames_updated_at
        BEFORE UPDATE ON frames
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // ── exports ───────────────────────────────────────────────────────────
    // format: 'gif' | 'mp4' | 'pdf' | 'link' | 'png'
    await client.query(`
      CREATE TABLE IF NOT EXISTS exports (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        board_id    UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
        user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        format      TEXT NOT NULL CHECK (format IN ('gif', 'mp4', 'pdf', 'link', 'png')),
        share_token TEXT UNIQUE,
        expires_at  TIMESTAMPTZ,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    // Datensparsamkeit: nie genutzte Spalte (GIF/MP4-Exporte laufen über
    // EXPORTS_DIR + zeitbasiertem Cleanup, PDF wird direkt gestreamt – nie
    // auf Platte referenziert) – idempotent für bereits existierende DBs.
    await client.query(`ALTER TABLE exports DROP COLUMN IF EXISTS file_path;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_exports_board_id ON exports(board_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_exports_share_token ON exports(share_token) WHERE share_token IS NOT NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_exports_expires_at ON exports(expires_at) WHERE expires_at IS NOT NULL;`);

    // ── app_config (Issue #21) ───────────────────────────────────────────
    // Globale, nicht user-gebundene Konfiguration – genau eine Zeile.
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_config (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        backup_enabled   BOOLEAN NOT NULL DEFAULT false,
        backup_schedule  TEXT NOT NULL DEFAULT 'daily' CHECK (backup_schedule IN ('daily', 'weekly')),
        backup_retention INTEGER NOT NULL DEFAULT 7,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_app_config_updated_at ON app_config;
      CREATE TRIGGER trg_app_config_updated_at
        BEFORE UPDATE ON app_config
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`
      INSERT INTO app_config (backup_enabled, backup_schedule, backup_retention)
      SELECT false, 'daily', 7
      WHERE NOT EXISTS (SELECT 1 FROM app_config);
    `);

    // ── app_config: KI-Anbieter-Konfiguration (EPIC 010) ──────────────────
    // Admin-editierbar über Einstellungen -> Admin, statt nur per .env/
    // Container-Neustart (AI_PROVIDER_*-Env-Vars bleiben als Fallback für
    // Erstinstallationen bestehen, siehe services/ai/aiProvider.js – DB-
    // Werte haben Vorrang, sobald ein Admin sie über die UI setzt).
    // ai_provider_api_key wird nie an die UI zurückgegeben (nur ob gesetzt).
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider_base_url TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider_api_key TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider_model TEXT NOT NULL DEFAULT '';`);
    await client.query(`ALTER TABLE app_config ADD COLUMN IF NOT EXISTS ai_provider_timeout_ms INTEGER NOT NULL DEFAULT 30000;`);

    // ── library_entries (EPIC 010 – Community-Übungsbibliothek MVP) ──────
    // Snapshot-Kopie statt Live-Verweis auf boards: beim Veröffentlichen
    // werden nur die taktischen Inhalte (Aufstellung Frame 0, Zeichnungen,
    // Feldtyp, Farben, Kategorie-Metadaten) kopiert. Bewusst NICHT
    // übernommen: notes (Trainervermerke), opponent (Gegner-Name),
    // board_collaborators, Kommentare – Privacy by Design, eine
    // Veröffentlichung darf nie interne Notizen offenlegen. Der Snapshot
    // bleibt unabhängig davon bestehen, ob das Quell-Board später
    // geändert/gelöscht wird (source_board_id ist reine Provenienz, kein
    // Zugriffspfad). owner_id -> SET NULL statt CASCADE: löscht ein Nutzer
    // seinen Account, bleibt sein Beitrag für die Community erhalten, nur
    // die Autoren-Zuordnung wird anonymisiert (Frontend zeigt dann einen
    // Platzhalter statt display_name).
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_entries (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
        owner_id        UUID REFERENCES users(id) ON DELETE SET NULL,
        name            TEXT NOT NULL,
        field_type      TEXT NOT NULL DEFAULT 'large'
                        CHECK (field_type IN ('large', 'small', 'street', '3v3')),
        category        TEXT NOT NULL DEFAULT ''
                        CHECK (category IN ('', 'technik', 'taktik', 'kondition', 'spielverstaendnis', 'nachwuchs')),
        age_group       TEXT NOT NULL DEFAULT '',
        goal            TEXT NOT NULL DEFAULT '',
        material        TEXT NOT NULL DEFAULT '',
        theme           TEXT NOT NULL DEFAULT 'dark'
                        CHECK (theme IN ('dark', 'light', 'vikings', 'iff')),
        home_color      TEXT NOT NULL DEFAULT '#1d4ed8',
        away_color      TEXT NOT NULL DEFAULT '#dc2626',
        ball_color      TEXT NOT NULL DEFAULT '#ffffff',
        players_json    JSONB NOT NULL DEFAULT '[]',
        elements_json   JSONB NOT NULL DEFAULT '[]',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_library_entries_updated_at ON library_entries;
      CREATE TRIGGER trg_library_entries_updated_at
        BEFORE UPDATE ON library_entries
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_library_entries_category ON library_entries(category);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_library_entries_owner_id ON library_entries(owner_id);`);

    // Melde-Funktion: ein Report pro Nutzer und Eintrag (UNIQUE),
    // verhindert Spam-Meldungen ohne eigene Rate-Limiting-Infrastruktur.
    await client.query(`
      CREATE TABLE IF NOT EXISTS library_entry_reports (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        library_entry_id UUID NOT NULL REFERENCES library_entries(id) ON DELETE CASCADE,
        reported_by      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason           TEXT NOT NULL DEFAULT '',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (library_entry_id, reported_by)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_library_entry_reports_entry_id ON library_entry_reports(library_entry_id);`);

    // ── roster_players: updated_at (Voraussetzung für die Offline-
    // Konfliktlösung, EPIC 010-Backlog – bisher hatten nur Boards/Frames/
    // Trainingseinheiten überhaupt eine Grundlage für einen Konfliktcheck).
    await client.query(`ALTER TABLE roster_players ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_roster_players_updated_at ON roster_players;
      CREATE TRIGGER trg_roster_players_updated_at
        BEFORE UPDATE ON roster_players
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // ── password_reset_tokens (Backlog: Passwort-Reset-Flow) ───────────────
    // Bewusst der EINZIGE Token-Typ im Projekt, dessen Wert gehasht statt im
    // Klartext gespeichert wird (anders als Share-/Invite-Tokens, siehe
    // shareController.js/boardCollaboratorsController.js) – Besitz dieses
    // Tokens erlaubt eine vollständige Account-Übernahme, ein DB-Leak darf
    // das nicht automatisch mit-kompromittieren. Ein Reset-Vorgang = eine
    // Zeile; ein neuer Request löscht bewusst alle vorherigen offenen Tokens
    // desselben Nutzers (siehe authController), daher kein UNIQUE nötig.
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);`);

    // ── games (Backlog: Live-Spielnotizen, "Erweiterung: Live-Unterstützung") ──
    // Bewusst schlank (nur Gegner/Datum/Team) – Live-Notizen selbst sind
    // KEINE eigene Tabelle, sondern nutzen die bestehende `comments`-Tabelle
    // mit resource_type='game' mit (siehe ALTER unten): identisches Muster
    // (freier Text, zeitgestempelt, an eine Ressource gehängt) wie bei
    // Boards/Trainingseinheiten, keine Duplikation nötig.
    await client.query(`
      CREATE TABLE IF NOT EXISTS games (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
        opponent   TEXT NOT NULL DEFAULT '',
        played_at  DATE,
        notes      TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_games_updated_at ON games;
      CREATE TRIGGER trg_games_updated_at
        BEFORE UPDATE ON games
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_games_user_id ON games(user_id);`);

    await client.query(`ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_resource_type_check;`);
    await client.query(`
      ALTER TABLE comments ADD CONSTRAINT comments_resource_type_check
        CHECK (resource_type IN ('board', 'training_session', 'game'));
    `);

    // ── formation_templates/playbooks: updated_at (Voraussetzung für die
    // Offline-Konfliktlösung, analog roster_players oben – bisher hatten
    // beide Ressourcen kein Bearbeiten-Feature, nur Anlegen/Löschen).
    await client.query(`ALTER TABLE formation_templates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_formation_templates_updated_at ON formation_templates;
      CREATE TRIGGER trg_formation_templates_updated_at
        BEFORE UPDATE ON formation_templates
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query(`ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_playbooks_updated_at ON playbooks;
      CREATE TRIGGER trg_playbooks_updated_at
        BEFORE UPDATE ON playbooks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    logger.info('Database migrations completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Migration failed, rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Erlaubt den direkten Aufruf via `npm run db:migrate` (node src/db/migrate.js),
// zusätzlich zum Import durch server.js beim Bootstrap.
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
