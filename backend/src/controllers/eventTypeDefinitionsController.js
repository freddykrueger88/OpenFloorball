/**
 * eventTypeDefinitionsController – Custom Events/Tags (Statistik-
 * Architektur Phase 7, Phasenplanungs-Review 2026-08-21).
 *
 * `event_type_definitions` existiert bereits seit Phase 1 (ADR-0001),
 * bisher aber ausschließlich für die 10 eingebauten, globalen Typen
 * genutzt (`is_builtin=true`) – kein Endpunkt erlaubte es Trainern,
 * eigene Zeilen anzulegen. Ein Custom-Typ gehört entweder einem Team
 * (`team_id`, sichtbar/nutzbar für alle Team-Mitglieder, anlegen/ändern
 * nur coach/owner) oder – wie roster_players/formation_templates/lines/
 * playbooks/games – persönlich einem einzelnen Nutzer (`user_id`, kein
 * Team). Genau eines von beiden ist gesetzt, nie beides (built-ins haben
 * beides NULL).
 *
 * Bewusst schlank gehalten (kein Icon-/Farb-Picker, keine
 * requires_secondary_player/-position/-outcome/-strength_state-UI): diese
 * Spalten existieren zwar in der Tabelle, werden aber von KEINEM
 * bestehenden Frontend-Code gelesen (auch nicht für die 10 eingebauten
 * Typen) – ein Custom-Typ ist ein einfaches, frei benanntes Tag mit
 * optionaler Spieler-Zuordnung, kein zweites Schuss-Tracking-Formular.
 * `label_de`/`label_en` werden bewusst mit demselben, einzigen
 * Nutzereingabe-Text befüllt (kein Zwei-Sprachen-Formular) – Nutzerinhalt
 * wird im gesamten Repo nie übersetzt (Formationsname, Board-Name, etc.),
 * nur die eingebauten Typen selbst sind bilingual gepflegt.
 *
 * `key` wird serverseitig als `custom_<uuid>` erzeugt statt vom Client
 * vorgeschlagen – vermeidet Kollisionen mit anderen Teams/Nutzern in
 * diesem global über alle Teams hinweg geteilten PRIMARY-KEY-Namensraum.
 */
import { randomUUID } from 'crypto';
import pool from '../db/pool.js';
import logger from '../utils/logger.js';
import { success, created, error } from '../utils/apiResponse.js';
import { getUserTeamIds, assertTeamAccess } from '../utils/teamAccess.js';

const MAX_CUSTOM_EVENT_TYPES = 20;

function toApiEventTypeDefinition(row) {
  return {
    key:             row.key,
    category:        row.category,
    labelDe:         row.label_de,
    labelEn:         row.label_en,
    requiresPlayer:  row.requires_player,
    isBuiltin:       row.is_builtin,
    teamId:          row.team_id,
    userId:          row.user_id,
    active:          row.active,
    createdAt:       row.created_at,
  };
}

async function getDefinitionRow(key) {
  const result = await pool.query('SELECT * FROM event_type_definitions WHERE key = $1', [key]);
  return result.rows[0] ?? null;
}

// Darf der Nutzer diesen (nicht-eingebauten) Typ ändern/löschen?
async function assertCustomTypeWrite(row, userId) {
  if (!row || row.is_builtin) return false;
  if (row.user_id) return row.user_id === userId;
  if (row.team_id) return assertTeamAccess(row.team_id, userId, 'coach');
  return false;
}

// GET /api/event-types – eingebaute Typen (für jeden sichtbar) + eigene
// Custom-Typen (Teams des Nutzers + persönliche). Read reicht für jedes
// Team-Mitglied (analog getFormations), nicht nur coach/owner – wer ein
// Spiel eines Teams sieht, muss auch dessen Custom-Typen zur Anzeige
// auflösen können.
export async function getEventTypeDefinitions(req, res) {
  try {
    const teamIds = await getUserTeamIds(req.user.id);
    const result = await pool.query(
      `SELECT * FROM event_type_definitions
       WHERE is_builtin = true OR team_id = ANY($1::uuid[]) OR user_id = $2
       ORDER BY is_builtin DESC, label_de ASC`,
      [teamIds, req.user.id]
    );
    res.json(success(result.rows.map(toApiEventTypeDefinition)));
  } catch (err) {
    logger.error('[getEventTypeDefinitions]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// POST /api/event-types
export async function createEventTypeDefinition(req, res) {
  try {
    const { label, teamId = null, requiresPlayer = false } = req.body;

    if (teamId && !(await assertTeamAccess(teamId, req.user.id, 'coach'))) {
      return res.status(404).json(error('Team nicht gefunden'));
    }
    const userId = teamId ? null : req.user.id;

    const countResult = await pool.query(
      teamId
        ? 'SELECT COUNT(*)::int AS count FROM event_type_definitions WHERE team_id = $1'
        : 'SELECT COUNT(*)::int AS count FROM event_type_definitions WHERE user_id = $1',
      [teamId ?? req.user.id]
    );
    if (countResult.rows[0].count >= MAX_CUSTOM_EVENT_TYPES) {
      return res.status(400).json(error(`Maximal ${MAX_CUSTOM_EVENT_TYPES} eigene Ereignistypen`));
    }

    const key = `custom_${randomUUID()}`;
    const trimmedLabel = label.trim();
    const result = await pool.query(
      `INSERT INTO event_type_definitions (key, category, label_de, label_en, requires_player, is_builtin, team_id, user_id)
       VALUES ($1, 'custom', $2, $2, $3, false, $4, $5)
       RETURNING *`,
      [key, trimmedLabel, requiresPlayer, teamId, userId]
    );
    res.status(201).json(created(toApiEventTypeDefinition(result.rows[0])));
  } catch (err) {
    logger.error('[createEventTypeDefinition]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// PUT /api/event-types/:key – nur label/requiresPlayer/active, nie bei
// eingebauten Typen (schützt bestehende Statistik-Konsistenz, siehe
// ADR-0001).
export async function updateEventTypeDefinition(req, res) {
  try {
    const existing = await getDefinitionRow(req.params.key);
    if (!existing || !(await assertCustomTypeWrite(existing, req.user.id))) {
      return res.status(404).json(error('Ereignistyp nicht gefunden'));
    }

    const fields = [];
    const values = [];
    let i = 1;
    if (req.body.label !== undefined) {
      const trimmedLabel = String(req.body.label).trim();
      if (!trimmedLabel) return res.status(400).json(error('Bezeichnung darf nicht leer sein'));
      fields.push(`label_de = $${i}`, `label_en = $${i}`);
      values.push(trimmedLabel);
      i += 1;
    }
    if (req.body.requiresPlayer !== undefined) {
      fields.push(`requires_player = $${i++}`);
      values.push(req.body.requiresPlayer);
    }
    if (req.body.active !== undefined) {
      fields.push(`active = $${i++}`);
      values.push(req.body.active);
    }
    if (fields.length === 0) {
      return res.status(400).json(error('Keine gültigen Felder zum Aktualisieren'));
    }

    values.push(req.params.key);
    const result = await pool.query(
      `UPDATE event_type_definitions SET ${fields.join(', ')} WHERE key = $${i} RETURNING *`,
      values
    );
    res.json(success(toApiEventTypeDefinition(result.rows[0])));
  } catch (err) {
    logger.error('[updateEventTypeDefinition]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}

// DELETE /api/event-types/:key – nur möglich, solange kein game_events
// mehr diesen Typ referenziert (FK-Schutz, siehe game_events_event_type_fkey).
// Bereits genutzte Custom-Typen bitte über active=false deaktivieren statt
// löschen (Ereignistyp bleibt für bereits erfasste Ereignisse gültig).
export async function deleteEventTypeDefinition(req, res) {
  try {
    const existing = await getDefinitionRow(req.params.key);
    if (!existing || !(await assertCustomTypeWrite(existing, req.user.id))) {
      return res.status(404).json(error('Ereignistyp nicht gefunden'));
    }
    await pool.query('DELETE FROM event_type_definitions WHERE key = $1', [req.params.key]);
    res.json(success({ message: 'Ereignistyp gelöscht' }));
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json(error('Ereignistyp wird bereits in einem Spiel verwendet – bitte stattdessen deaktivieren'));
    }
    logger.error('[deleteEventTypeDefinition]', err);
    res.status(500).json(error('Interner Serverfehler'));
  }
}
