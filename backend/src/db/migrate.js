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

    // ── users: Kalender-Feed-Token (Roadmap-Audit: ICS-Kalender-Abo) ────────
    // Bewusst Klartext wie share_token/invite-Tokens, nicht gehasht wie
    // password_reset_tokens.token_hash – ein Kalender-Feed-Token gewährt nur
    // Lesezugriff auf Termine (kein Account-Übernahme-Risiko wie bei einem
    // Passwort-Reset) und muss bei jedem Kalender-Client-Poll schnell ohne
    // erneutes Hashen nachschlagbar sein. Regenerieren ersetzt den Wert
    // vollständig – das macht die alte URL sofort ungültig (einziges
    // Widerruf-Mittel neben explizitem Löschen).
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS calendar_feed_token UUID UNIQUE;`);

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
    // team_id wird NICHT hier inline referenziert (teams wird erst weiter
    // unten angelegt) - CI/frische Self-Hosting-Installationen liefen sonst
    // beim allerersten Migrationslauf mit "relation teams does not exist"
    // auf einen Fehler. Kommt wie bei roster_players/playbooks/
    // training_sessions/formation_templates per ALTER TABLE nach.
    await client.query(`
      CREATE TABLE IF NOT EXISTS lines (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        color      TEXT NOT NULL DEFAULT '#3B82F6',
        type       TEXT NOT NULL DEFAULT 'offense' CHECK (type IN ('offense', 'defense', 'special')),
        is_active  BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lines_user_id ON lines(user_id);`);
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

    // ── announcements (Roadmap-Audit: News/Ankündigungen, Phase D) ──────────
    // Anders als games/training_sessions gibt es KEINEN persönlichen Fall –
    // eine Ankündigung ohne Team hat kein Publikum, daher team_id NOT NULL
    // und ON DELETE CASCADE statt SET NULL (exakt wie beim einzigen anderen
    // nicht-nullbaren team_id-Fall, team_members oben). Kein updated_at/
    // Bearbeiten – bei Tippfehler löschen und neu erfassen, wie bei
    // Notizen/Kommentaren üblich. Kein Titel-Feld (ein Satz reicht).
    await client.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id    UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        text       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_announcements_team_id ON announcements(team_id);`);

    // ── polls/poll_options/poll_votes (Roadmap-Audit: Umfragen, Phase D) ────
    // Wie announcements: team_id NOT NULL + ON DELETE CASCADE (kein
    // persönlicher Fall, eine Umfrage ohne Team hat kein Publikum). Kein
    // Bearbeiten von Frage/Optionen nach dem Anlegen – bei Fehler löschen
    // und neu erstellen. Ergebnisse sind für alle Team-Mitglieder immer
    // sichtbar (kein "erst nach Schließen sichtbar"-Zustand).
    await client.query(`
      CREATE TABLE IF NOT EXISTS polls (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question        TEXT NOT NULL,
        multiple_choice BOOLEAN NOT NULL DEFAULT false,
        closed_at       TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_polls_team_id ON polls(team_id);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS poll_options (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        poll_id     UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
        text        TEXT NOT NULL,
        order_index INT NOT NULL
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON poll_options(poll_id);`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS poll_votes (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        poll_option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
        user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (poll_option_id, user_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(poll_option_id);`);

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
    await client.query(`ALTER TABLE lines ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_lines_team_id ON lines(team_id) WHERE team_id IS NOT NULL;`);

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

    // ── rsvps (Roadmap-Audit: RSVP/Anwesenheit für Spiele/Trainings) ────────
    // Polymorph wie comments oben, aber genau EIN Status pro User+Ressource
    // (UNIQUE) statt beliebig vieler Einträge. Kein FK auf resource_id
    // (polymorph) – Aufräumen läuft explizit über deleteRsvpsForResource/
    // deleteRsvpsForUser, analog deleteCommentsForResource/-ForUser.
    await client.query(`
      CREATE TABLE IF NOT EXISTS rsvps (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resource_type TEXT NOT NULL CHECK (resource_type IN ('game', 'training_session')),
        resource_id   UUID NOT NULL,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status        TEXT NOT NULL CHECK (status IN ('yes', 'no', 'maybe')),
        reason        TEXT NOT NULL DEFAULT '',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (resource_type, resource_id, user_id)
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_rsvps_updated_at ON rsvps;
      CREATE TRIGGER trg_rsvps_updated_at
        BEFORE UPDATE ON rsvps
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_rsvps_resource ON rsvps(resource_type, resource_id);`);

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

    // ── Spieluhr (Roadmap-Audit: letzter, größerer Baustein Phase C) ────────
    // 1:1 mit games, daher direkte Spalten statt einer eigenen Tabelle.
    // Pause-Resume-Modell ohne Server-Tick: clock_elapsed_seconds ist die
    // bereits "eingesammelte" Zeit dieser Periode, clock_started_at (nur bei
    // status='running' gesetzt) + (NOW() - clock_started_at) ergibt die
    // zusätzliche laufende Zeit – Restzeit wird rein clientseitig berechnet.
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_period INT NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_status TEXT NOT NULL DEFAULT 'stopped' CHECK (clock_status IN ('stopped', 'running'));`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_elapsed_seconds INT NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_started_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS clock_period_minutes INT NOT NULL DEFAULT 20;`);

    // ── game_squad (Roadmap-Audit: Match-Kader für ein konkretes Spiel) ─────
    // Anders als rsvps/comments KEINE polymorphe Tabelle, sondern eine echte
    // Junction wie line_players – direkte FKs auf beide Seiten, dadurch
    // automatisches Aufräumen per CASCADE (kein manueller Cleanup-Code nötig,
    // weder beim Löschen eines Spiels noch eines Kader-Spielers/Accounts).
    // Status bewusst 4 statt der im Auftrag genannten 5 Zustände – "fährt
    // mit" ist inhaltlich playing ODER reserve, keine eigene Kategorie wert.
    // Muss NACH games UND roster_players stehen (beide FK-Ziele).
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_squad (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        roster_player_id UUID NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
        status           TEXT NOT NULL CHECK (status IN ('playing', 'reserve', 'injured', 'absent')),
        note             TEXT NOT NULL DEFAULT '',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (game_id, roster_player_id)
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_game_squad_updated_at ON game_squad;
      CREATE TRIGGER trg_game_squad_updated_at
        BEFORE UPDATE ON game_squad
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_game_squad_game_id ON game_squad(game_id);`);

    // ── game_events (Roadmap-Audit: Live-Match-Ereignisse, Start Phase C) ───
    // Strukturierte Speicherung der 10 festen IFF-Presets aus GamePage.jsx
    // (Anstoß Drittel 1-3, Drittelende, Auszeit, Tor, Strafe 2/5 Min.,
    // Matchstrafe, Spielende) – bisher wurden diese als fertig
    // zusammengesetzter Freitext in comments abgelegt (z.B. "Tor – #9
    // Müller"), was spätere Auswertung (Tore/Spieler, Strafminuten) ohne
    // Text-Parsing unmöglich macht. Freitext-Notizen bleiben bewusst
    // weiterhin über comments laufen – nur das feste Ereignis-Vokabular
    // wird hier strukturiert. Echte Junction wie game_squad (nicht
    // polymorph wie comments/rsvps) – automatisches Aufräumen per CASCADE.
    // Kein period-/penalty_minutes-Feld (redundant zu event_type), keine
    // Bearbeitung (updated_at) – bei Tippfehler löschen und neu erfassen,
    // exakt wie bei den heutigen Notizen dokumentiert.
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_events (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        event_type       TEXT NOT NULL CHECK (event_type IN (
          'kickoff_q1', 'kickoff_q2', 'kickoff_q3', 'period_end', 'timeout',
          'goal', 'penalty_2', 'penalty_5', 'match_penalty', 'game_end'
        )),
        roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL,
        is_opponent      BOOLEAN NOT NULL DEFAULT false,
        created_by       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);`);

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

    // ── Statistik-Architektur Phase 1 (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md,
    // ADR-0001 in DECISIONS.md): event_type wird von einem starren
    // CHECK-Constraint auf eine erweiterbare Definitionstabelle umgestellt.
    // Neue Event-Typen (auch vereinsspezifische Custom-Events, spätere
    // Phase) brauchen dadurch nur noch einen INSERT, keine Migration mehr.
    // Die 10 bestehenden Typen werden unverändert als is_builtin=true
    // übernommen – rein additiv, kein bestehendes Verhalten ändert sich.
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_type_definitions (
        key                       TEXT PRIMARY KEY,
        category                  TEXT NOT NULL,
        label_de                  TEXT NOT NULL,
        label_en                  TEXT NOT NULL,
        icon                      TEXT,
        color                     TEXT,
        requires_player           BOOLEAN NOT NULL DEFAULT false,
        requires_secondary_player BOOLEAN NOT NULL DEFAULT false,
        requires_position         BOOLEAN NOT NULL DEFAULT false,
        requires_outcome          BOOLEAN NOT NULL DEFAULT false,
        requires_strength_state   BOOLEAN NOT NULL DEFAULT false,
        is_builtin                BOOLEAN NOT NULL DEFAULT false,
        team_id                   UUID REFERENCES teams(id) ON DELETE CASCADE,
        active                    BOOLEAN NOT NULL DEFAULT true,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO event_type_definitions (key, category, label_de, label_en, requires_player, is_builtin) VALUES
        ('kickoff_q1',     'period',   'Anstoß Drittel 1',    'Kickoff period 1', false, true),
        ('kickoff_q2',     'period',   'Anstoß Drittel 2',    'Kickoff period 2', false, true),
        ('kickoff_q3',     'period',   'Anstoß Drittel 3',    'Kickoff period 3', false, true),
        ('period_end',     'period',   'Drittelende',         'Period end',       false, true),
        ('timeout',        'general',  'Auszeit',             'Timeout',          false, true),
        ('goal',           'offense',  'Tor',                 'Goal',             true,  true),
        ('penalty_2',      'penalty',  'Strafe 2 Minuten',    'Penalty 2 minutes',true,  true),
        ('penalty_5',      'penalty',  'Strafe 5 Minuten',    'Penalty 5 minutes',true,  true),
        ('match_penalty',  'penalty',  'Matchstrafe',         'Match penalty',    true,  true),
        ('game_end',       'period',   'Spielende',           'Game end',         false, true)
      ON CONFLICT (key) DO NOTHING;
    `);

    // Zusätzliche, optionale Spalten für ein detaillierteres Ereignis
    // (alle nullable/mit unschädlichem Default – kein bestehender Insert
    // muss angepasst werden). Siehe Abschnitt 8.2/9 des Architektur-Dokuments.
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS secondary_roster_player_id UUID REFERENCES roster_players(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS period INT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS clock_seconds_at_event INT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS outcome TEXT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS shot_type TEXT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS strength_state TEXT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS x REAL;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS y REAL;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS zone TEXT;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS video_timestamp_seconds REAL;`);
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';`);

    // CHECK-Constraint durch FK auf event_type_definitions ersetzen – muss
    // NACH dem Seed oben laufen, sonst würden bestehende Zeilen die neue FK
    // verletzen.
    await client.query(`ALTER TABLE game_events DROP CONSTRAINT IF EXISTS game_events_event_type_check;`);
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'game_events_event_type_fkey'
        ) THEN
          ALTER TABLE game_events
            ADD CONSTRAINT game_events_event_type_fkey
            FOREIGN KEY (event_type) REFERENCES event_type_definitions(key);
        END IF;
      END $$;
    `);

    // Lösch-Audit-Log (Anforderung §19.5/71 Auditierbarkeit): die bestehende
    // "bei Tippfehler löschen und neu erfassen"-UX bleibt unverändert
    // (kein Edit-Endpunkt), aber jede Löschung wird ab jetzt nachvollziehbar
    // protokolliert – wer hat wann welches Ereignis mit welcher Attribution
    // gelöscht.
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_event_deletions (
        id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        game_id              UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        event_type           TEXT NOT NULL,
        roster_player_id     UUID REFERENCES roster_players(id) ON DELETE SET NULL,
        is_opponent          BOOLEAN NOT NULL DEFAULT false,
        original_created_at  TIMESTAMPTZ NOT NULL,
        deleted_by           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deleted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_game_event_deletions_game_id ON game_event_deletions(game_id);`);

    // ── Statistik-Architektur Phase 2 (docs/planning/STATISTICS_ANALYTICS_ARCHITECTURE.md
    // Abschnitt 8.3): zeitgestempelte Historie tatsächlicher Line-Nutzung
    // während eines konkreten Spiels – ENTKOPPELT von der lines-Vorlage
    // selbst (lines.is_active bleibt unverändert ein reines
    // Vorbereitungs-Flag ohne Spielbezug, siehe linesController.
    // setLineActive). line_name ist ein Snapshot (überlebt Umbenennen/
    // Löschen der Vorlage). Bewusst KEINE Cross-Game-Exklusivität auf
    // line_id – Lines sind bereits geteilte Vorlagen, match_lines ist ein
    // reines Spiel-Log, keine Live-Sperre wie lines.is_active. Muss NACH
    // games/lines/users stehen (FK-Ziele).
    await client.query(`
      CREATE TABLE IF NOT EXISTS match_lines (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        game_id    UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        line_id    UUID REFERENCES lines(id) ON DELETE SET NULL,
        line_name  TEXT NOT NULL,
        period     INT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ended_at   TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        CHECK (ended_at IS NULL OR ended_at >= started_at)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_match_lines_game_id ON match_lines(game_id);`);
    // Höchstens eine offene Zeile pro Spiel – schützt gegen Race
    // Conditions UND ist zugleich der Index für "finde die aktuell
    // offene Zeile für Spiel X".
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_match_lines_one_open_per_game
        ON match_lines(game_id) WHERE ended_at IS NULL;
    `);

    // ── Statistik-Architektur Phase 3 (Schuss-Tracking) ──────────────────
    // Abschnitt 9 des Architektur-Dokuments: GOAL/SHOT_ON_GOAL/SHOT_MISSED/
    // SHOT_BLOCKED werden NICHT als 4 Event-Typen umgesetzt, sondern als
    // EIN `shot`-Typ mit `outcome ∈ {goal, save, miss, block}`. Keine neue
    // Tabelle/Spalte nötig – Phase 1 hat outcome/shot_type/x/y/zone/
    // secondary_roster_player_id bereits auf game_events ergänzt.
    // requires_player/requires_position/requires_outcome sind aktuell rein
    // dekorativ (kein Controller liest sie) – Durchsetzung bleibt
    // client-seitig (Submit-Button disabled bis Position+Outcome gesetzt).
    await client.query(`
      INSERT INTO event_type_definitions
        (key, category, label_de, label_en, requires_player, requires_secondary_player, requires_position, requires_outcome, is_builtin)
      VALUES
        ('shot', 'offense', 'Schuss', 'Shot', false, false, true, true, true)
      ON CONFLICT (key) DO NOTHING;
    `);

    // ── Statistik-Architektur Phase 5 (Trainings-Analytics/
    // Spielerentwicklung, eigene Domäne, siehe Architektur-Dokument
    // Abschnitt 11) ──────────────────────────────────────────────────────
    // training_attendance: tatsächliche Anwesenheit bei einem Training,
    // analog game_squad – unabhängig von RSVP (Selbstauskunft VOR dem
    // Termin) und unabhängig von Lines (taktische Gruppierung). Echte
    // Junction (nicht polymorph wie comments/rsvps) – CASCADE räumt
    // automatisch auf. Muss NACH training_sessions/roster_players stehen.
    await client.query(`
      CREATE TABLE IF NOT EXISTS training_attendance (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id       UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
        roster_player_id UUID NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
        status           TEXT NOT NULL CHECK (status IN ('present', 'excused', 'absent', 'injured')),
        note             TEXT NOT NULL DEFAULT '',
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (session_id, roster_player_id)
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_training_attendance_updated_at ON training_attendance;
      CREATE TRIGGER trg_training_attendance_updated_at
        BEFORE UPDATE ON training_attendance
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_attendance_session_id ON training_attendance(session_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_attendance_roster_player_id ON training_attendance(roster_player_id);`);

    // player_development_notes: freie, zeitgestempelte Beobachtungsnotizen
    // eines Coaches zu einem Kader-Spieler (CLAUDE.md-Vision "Wissen im
    // Verein aufbauen" / "Spielerentwicklung langfristig begleiten").
    // Bewusst NICHT über comments (polymorph, dort für Boards/Trainings/
    // Spiele) – Notizen hier sind personenbezogene Daten ÜBER einen
    // Spieler (oft minderjährig), keine Diskussion ZU einer Ressource,
    // daher restriktiverer Lese-/Schreibzugriff (nur coach/owner, siehe
    // playerDevelopmentNotesController.js) statt "jedes Team-Mitglied
    // liest mit" wie bei comments. training_session_id optional (Kontext,
    // in dem die Beobachtung entstand) – ON DELETE SET NULL, eine Notiz
    // überlebt das Löschen des Trainings.
    await client.query(`
      CREATE TABLE IF NOT EXISTS player_development_notes (
        id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        roster_player_id     UUID NOT NULL REFERENCES roster_players(id) ON DELETE CASCADE,
        author_user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        training_session_id  UUID REFERENCES training_sessions(id) ON DELETE SET NULL,
        note                 TEXT NOT NULL,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_player_development_notes_updated_at ON player_development_notes;
      CREATE TRIGGER trg_player_development_notes_updated_at
        BEFORE UPDATE ON player_development_notes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_player_development_notes_roster_player_id ON player_development_notes(roster_player_id);`);

    // ── Statistik-Architektur Phase 6 (Video↔Event-Verknüpfung, siehe
    // Architektur-Dokument Abschnitt 11/Roadmap Phase 6, ADR-0005 in
    // DECISIONS.md) ──────────────────────────────────────────────────────
    // game_videos: EIGENE Tabelle statt game_id an board_videos
    // anzuhängen – folgt dem in der Architektur-Doku (Abschnitt 5,
    // "Wichtige Muster") vorgegebenen Grundsatz, dass spielbezogene
    // Ressourcen transitiv über game_id scopen, nicht dem
    // Vorlagen-Muster (team_id direkt) von board_videos folgen. Ein
    // Mischen von assertBoardAccess und assertGameRead/-Write in einem
    // Controller hätte unnötige Verzweigungskomplexität eingeführt.
    // Struktur bewusst identisch zu board_videos (gleiche Spalten,
    // gleiche Disk-Ablage über VIDEOS_DIR) – siehe
    // gameVideosController.js, das videoController.js spiegelt.
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_videos (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        game_id             UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename            TEXT NOT NULL,
        storage_key         TEXT NOT NULL UNIQUE,
        mime_type           TEXT NOT NULL,
        size_bytes          BIGINT NOT NULL,
        title               TEXT,
        elements_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
        trim_start_seconds  REAL,
        trim_end_seconds    REAL,
        markers_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_game_videos_game_id ON game_videos(game_id);`);

    // game_events.video_id: verweist auf das konkrete Video, zu dem
    // video_timestamp_seconds (seit Phase 1 bereits vorhanden, bis hierhin
    // ungenutzt) gehört – ohne diese Spalte wäre ein Zeitstempel bei
    // mehreren Videos je Spiel nicht eindeutig zuordenbar. ON DELETE
    // SET NULL statt CASCADE: das Event selbst (Tor/Strafe/…) bleibt
    // gültig und in der Statistik zählbar, auch wenn die verknüpfte
    // Videodatei später gelöscht wird – nur der Video-Sprung verschwindet.
    await client.query(`ALTER TABLE game_events ADD COLUMN IF NOT EXISTS video_id UUID REFERENCES game_videos(id) ON DELETE SET NULL;`);

    // ── Statistik-Architektur Phase 7 (Custom Events, siehe Architektur-
    // Dokument Roadmap Phase 7, Phasenplanungs-Review 2026-08-21) ─────────
    // event_type_definitions.team_id existierte bereits (Phase 1), deckte
    // aber nur team-geteilte Custom-Typen ab. Persönliche (nicht
    // team-geteilte) Nutzer – überall sonst im Repo als "team_id NULL,
    // stattdessen user_id" unterstützt (roster_players, formation_templates,
    // lines, playbooks, games) – hätten sonst gar keine eigenen Custom-Typen
    // anlegen können. user_id NULL bleibt für die 10 eingebauten globalen
    // Typen reserviert.
    await client.query(`ALTER TABLE event_type_definitions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_type_definitions_team_id ON event_type_definitions(team_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_type_definitions_user_id ON event_type_definitions(user_id);`);

    // ── EPIC 011 (Vereinsebene): vereinsweit geteilte Playbooks ────────────
    // Playbook-Sichtbarkeit war bisher zweistufig (persönlich über user_id,
    // team-geteilt über team_id, siehe ROADMAP Phase 2) – jetzt zusätzlich
    // eine dritte, umfassendere Stufe für Vereine mit mehreren Teams
    // (z.B. 1. Herren + U15), die eine gemeinsame Übungssammlung über alle
    // Teams hinweg pflegen wollen. organization_id ist bewusst NICHT
    // zusätzlich zu team_id gesetzt (Anwendungsebene erzwingt "entweder
    // oder", siehe playbooksController.createPlaybook) – ein Playbook hat
    // genau EINEN Scope: persönlich, ein Team, oder ein ganzer Verein.
    // Anlegen/Ändern bewusst auf Vereins-Admins beschränkt (analog
    // getSchedule) – ein normales Team-Coach-Recht reicht hier nicht, da
    // die Sichtbarkeit über die eigene Team-Grenze hinausgeht.
    await client.query(`ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playbooks_organization_id ON playbooks(organization_id) WHERE organization_id IS NOT NULL;`);

    // ── Strukturierte Gegner-Entität (ADR-0007 in DECISIONS.md) ────────────
    // Bisher reiner Freitext auf games.opponent (siehe games-Block oben) –
    // Statistik-Architektur hat eine opponents-Tabelle bewusst
    // zurückgestellt (STATISTICS_ANALYTICS_ARCHITECTURE.md Abschnitt 8.4),
    // jetzt als eigenständiger, nachgelagerter Schritt umgesetzt. games.opponent
    // bleibt unverändert als Snapshot-Feld bestehen (identisches Prinzip zu
    // match_lines.line_name: überlebt Umbenennung, verfälscht keine Historie).
    //
    // Ein Gegnername ist eindeutig pro TEAM (nicht pro Nutzer) – zwei
    // Co-Trainer desselben Teams, die denselben Namen tippen, sollen auf
    // denselben Datensatz treffen, gleiches Team-Sharing-Prinzip wie bei
    // games selbst. Für team-lose (rein persönliche) Spiele eindeutig pro
    // Nutzer. Zwei PARTIELLE Unique-Indizes statt einem normalen UNIQUE,
    // weil Postgres NULL in gewöhnlichen UNIQUE-Constraints als "distinct"
    // behandelt (mehrere team_id=NULL-Zeilen wären sonst nicht geschützt).
    await client.query(`
      CREATE TABLE IF NOT EXISTS opponents (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        team_id    UUID REFERENCES teams(id) ON DELETE SET NULL,
        name       TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_opponents_updated_at ON opponents;
      CREATE TRIGGER trg_opponents_updated_at
        BEFORE UPDATE ON opponents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_opponents_user_id ON opponents(user_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_opponents_team_id ON opponents(team_id);`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_opponents_unique_team_scoped
        ON opponents(team_id, lower(trim(name))) WHERE team_id IS NOT NULL;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_opponents_unique_personal_scoped
        ON opponents(user_id, lower(trim(name))) WHERE team_id IS NULL;
    `);

    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS opponent_id UUID REFERENCES opponents(id) ON DELETE SET NULL;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_games_opponent_id ON games(opponent_id);`);

    // Backfill bestehender Spiele: idempotent, bei jedem Migrationslauf
    // sicher wiederholbar, da bereits verknüpfte Spiele (opponent_id IS NOT
    // NULL) übersprungen werden und ON CONFLICT DO NOTHING doppelte
    // opponents-Zeilen verhindert.
    await client.query(`
      INSERT INTO opponents (user_id, team_id, name)
      SELECT DISTINCT ON (team_id, lower(trim(opponent))) user_id, team_id, trim(opponent)
      FROM games
      WHERE team_id IS NOT NULL AND trim(opponent) <> ''
      ON CONFLICT (team_id, (lower(trim(name)))) WHERE team_id IS NOT NULL DO NOTHING;
    `);
    await client.query(`
      INSERT INTO opponents (user_id, team_id, name)
      SELECT DISTINCT ON (user_id, lower(trim(opponent))) user_id, NULL, trim(opponent)
      FROM games
      WHERE team_id IS NULL AND trim(opponent) <> ''
      ON CONFLICT (user_id, (lower(trim(name)))) WHERE team_id IS NULL DO NOTHING;
    `);
    await client.query(`
      UPDATE games g SET opponent_id = o.id
      FROM opponents o
      WHERE g.opponent_id IS NULL AND g.team_id IS NOT NULL
        AND o.team_id = g.team_id AND lower(trim(o.name)) = lower(trim(g.opponent));
    `);
    await client.query(`
      UPDATE games g SET opponent_id = o.id
      FROM opponents o
      WHERE g.opponent_id IS NULL AND g.team_id IS NULL
        AND o.team_id IS NULL AND o.user_id = g.user_id AND lower(trim(o.name)) = lower(trim(g.opponent));
    `);

    // ── Layer-System (CLAUDE.md §10.2): Kommentare als optionale
    // Feld-Pins ──────────────────────────────────────────────────────
    // Nullable, additiv – bestehende Kommentare (Boards ohne Pin,
    // Trainings-/Spiel-Kommentare) bleiben unverändert NULL. Keine
    // CHECK-Constraint auf resource_type nötig: für training_session/
    // game sind x/y schlicht immer NULL, es gibt kein Feld, auf das man
    // dort anpinnen könnte.
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS x REAL;`);
    await client.query(`ALTER TABLE comments ADD COLUMN IF NOT EXISTS y REAL;`);

    // ── Demo-Daten (Onboarding-Ausbau): Markierung + Idempotenz-Flag ────────
    // is_demo ist additiv auf den fünf Tabellen, die pro Account eine
    // eigenständige Demo-Testumgebung tragen (Team, Kader, Spiele,
    // Trainings, Gegner) – game_squad/game_events/training_attendance/
    // team_members brauchen KEIN eigenes Flag, sie hängen bereits per
    // ON DELETE CASCADE an genau diesen Tabellen und werden beim Löschen
    // automatisch mit entfernt (siehe demoData.js). users.demo_seeded_at
    // ist der einzige Ort, der "wurde für diesen Account schon einmal
    // erzeugt" festhält – NULL nach Löschung erlaubt erneutes Anlegen.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_seeded_at TIMESTAMPTZ;`);
    await client.query(`ALTER TABLE teams ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE roster_players ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`ALTER TABLE opponents ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_teams_is_demo ON teams(is_demo) WHERE is_demo = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_roster_players_is_demo ON roster_players(is_demo) WHERE is_demo = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_games_is_demo ON games(is_demo) WHERE is_demo = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_training_sessions_is_demo ON training_sessions(is_demo) WHERE is_demo = true;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_opponents_is_demo ON opponents(is_demo) WHERE is_demo = true;`);

    // ── Spieler-Dashboard: Verknüpfung Login-Account ↔ Kader-Eintrag ────────
    // roster_players.user_id ist der Ersteller/Coach, nicht zwangsläufig der
    // Spieler selbst – ohne diese zusätzliche, optionale Spalte kann ein
    // eingeloggter Account nie ermitteln, welcher Kader-Eintrag "er selbst"
    // ist, und damit auch nie eigene Tore/Assists sehen. Nullable, vom
    // Team-Owner/-Coach gesetzt (siehe rosterController.js::updateRosterPlayer).
    // Partieller Unique-Index statt normalem UNIQUE, weil NULL in Postgres
    // sonst nicht mehrfach vorkommen dürfte (Standardfall: nicht verknüpft).
    await client.query(`ALTER TABLE roster_players ADD COLUMN IF NOT EXISTS linked_user_id UUID REFERENCES users(id) ON DELETE SET NULL;`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_players_linked_user_id ON roster_players(linked_user_id) WHERE linked_user_id IS NOT NULL;`);

    // ── Spieler-Dashboard: Spiel-/Trainings-Logistik ────────────────────────
    // Bisher trugen games/training_sessions nur ein Datum (DATE, keine
    // Uhrzeit) und keinerlei Ort-/Status-Information – für einen Countdown
    // und eine Orts-Karte auf dem neuen Dashboard reicht das nicht. Alle
    // Felder nullable/additiv, bestehende Einträge zeigen dafür einen
    // sauberen Fallback statt erfundener Werte. "Abgeschlossen" wird bewusst
    // NICHT gespeichert, sondern aus Datum+status='scheduled' abgeleitet.
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS kickoff_time TIME;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS venue_name TEXT;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS venue_address TEXT;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS venue_lat REAL;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS venue_lng REAL;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS is_home BOOLEAN;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'postponed', 'cancelled'));`);

    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS start_time TIME;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS venue_name TEXT;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS venue_address TEXT;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS venue_lat REAL;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS venue_lng REAL;`);
    await client.query(`ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'postponed', 'cancelled'));`);

    // ── Spieler-Dashboard: optionale Saisonmanager-Anbindung pro Team ───────
    // Rein optional (Local-/Self-Hosting-First, CLAUDE.md §5.5/§5.7) – ein
    // Team OHNE Eintrag hier nutzt weiterhin ausschließlich die eigenen
    // games/training_sessions. api_key ist serverseitig-only: wird nie in
    // einer API-Response zurückgegeben (siehe teamSaisonmanagerController.js),
    // exakt wie settings.ai_provider_api_key nie ans Frontend geht.
    await client.query(`
      CREATE TABLE IF NOT EXISTS team_saisonmanager_links (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        team_id    UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
        api_key    TEXT NOT NULL,
        league_id  INTEGER NOT NULL,
        sm_team_id INTEGER NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_team_saisonmanager_links_updated_at ON team_saisonmanager_links;
      CREATE TRIGGER trg_team_saisonmanager_links_updated_at
        BEFORE UPDATE ON team_saisonmanager_links
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    // ── Geburtstag: Pflichtfeld bei Neu-Registrierung, für Bestandsnutzer
    // per BirthdayGateDialog.jsx einmalig nachgetragen (daher hier NULLable,
    // die Pflicht wird auf Anwendungsebene in routes/auth.js erzwungen).
    // Nur users – nicht roster_players, siehe Architekturentscheidung: die
    // meisten Kader-Einträge sind nicht mit einem echten Konto verknüpft.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE;`);

    // ── carpool_offers (ISSUE 028: Fahrgemeinschaften) ──────────────────────
    // Polymorph wie rsvps/comments (resource_type-Diskriminator, kein DB-FK
    // auf resource_id) – Aufräumen läuft explizit über
    // deleteCarpoolOffersForResource/deleteCarpoolOffersForUser, analog
    // deleteRsvpsForResource/-ForUser.
    //
    // share_token ist NICHT optional wie exports.share_token – JEDES Angebot
    // bekommt beim Anlegen sofort einen Token (kein separater "Link
    // erzeugen"-Schritt wie bei Board-Shares), damit ein Elternteil ohne
    // Account direkt über den Link mitfahren/absagen kann (bestätigte
    // Design-Entscheidung, siehe BACKLOG.md ISSUE 028).
    //
    // Datensparsamkeit (CLAUDE.md §5.1/§5.3): meeting_point ist Freitext,
    // den der Anbieter selbst wählt – keine Adress-/Telefonfelder.
    await client.query(`
      CREATE TABLE IF NOT EXISTS carpool_offers (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        resource_type TEXT NOT NULL CHECK (resource_type IN ('game', 'training_session')),
        resource_id   UUID NOT NULL,
        user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        meeting_point TEXT NOT NULL,
        total_seats   INTEGER NOT NULL CHECK (total_seats BETWEEN 1 AND 8),
        note          TEXT NOT NULL DEFAULT '',
        share_token   UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS trg_carpool_offers_updated_at ON carpool_offers;
      CREATE TRIGGER trg_carpool_offers_updated_at
        BEFORE UPDATE ON carpool_offers
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carpool_offers_resource ON carpool_offers(resource_type, resource_id);`);

    // ── carpool_claims ───────────────────────────────────────────────────
    // Echte Junction (wie game_squad/training_attendance), aber auf
    // carpool_offers statt games/training_sessions – EINE Elternressource
    // (der Angebot-Datensatz selbst), daher kein polymorpher Diskriminator
    // nötig. ON DELETE CASCADE auf offer_id UND user_id bedeutet: Löschen
    // eines Angebots ODER eines Nutzer-Accounts räumt zugehörige Claims
    // automatisch ab, KEIN manueller Cleanup-Helper nötig (anders als bei
    // carpool_offers selbst).
    //
    // Genau eines von user_id/claimant_name ist gesetzt: authentifizierte
    // Team-Mitglieder claimen über ihren Account (user_id), anonyme
    // Mitfahrer:innen (share_token-Pfad, typischerweise Eltern ohne
    // Account) geben nur einen Anzeigenamen an (claimant_name).
    // cancel_token erlaubt der anonymen Person, ihren EIGENEN Claim ohne
    // Login wieder zu löschen (es gibt keine Session, über die sich "mein
    // Eintrag" sonst feststellen ließe).
    await client.query(`
      CREATE TABLE IF NOT EXISTS carpool_claims (
        id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        offer_id       UUID NOT NULL REFERENCES carpool_offers(id) ON DELETE CASCADE,
        user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
        claimant_name  TEXT,
        cancel_token   UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CHECK ((user_id IS NULL) <> (claimant_name IS NULL))
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_carpool_claims_offer_id ON carpool_claims(offer_id);`);
    // Verhindert Doppel-Claim desselben authentifizierten Nutzers auf
    // dasselbe Angebot; anonyme Claims (user_id NULL) sind hiervon nicht
    // betroffen, da NULL in einem UNIQUE-Index nie mit sich selbst kollidiert.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_carpool_claims_offer_user_unique ON carpool_claims(offer_id, user_id) WHERE user_id IS NOT NULL;`);

    // ── games: Saisonmanager-Spielplan-Sync ─────────────────────────────
    // Nutzer-Feedback (2026-08-31): Saisonmanager-Anbindung fütterte bisher
    // nur die Dashboard-Karten (live abgerufen, nie gespeichert), Kalender/
    // Spiele-Seite lesen aber ausschließlich aus `games` – Saisonmanager-
    // Spiele erschienen dort nie. `external_source`/`external_id` markieren
    // synchronisierte Zeilen und dienen als Upsert-Schlüssel (Saisonmanagers
    // `game_id` ist laut deren offizieller OpenAPI-Spec ein Pflichtfeld,
    // stabil über Terminverschiebungen hinweg – robuster als ein
    // Datum+Gegner-Composite-Key). Partial-Unique-Index statt einer
    // NOT-NULL-Spalte, da normale, manuell angelegte Spiele weiterhin
    // external_source/external_id NULL haben.
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS external_source TEXT;`);
    await client.query(`ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id TEXT;`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_games_external_unique
        ON games(team_id, external_source, external_id)
        WHERE external_source IS NOT NULL;
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
