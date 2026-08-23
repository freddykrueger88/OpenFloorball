/**
 * organizationAccess – Zugriffs-Helper für die Vereins-Ebene (ROADMAP
 * Phase 2). Strukturell identisch zu teamAccess.js, aber nur 2 Rollen
 * (admin/member) statt 3, da ein Verein rein administrativ ist – kein
 * "coach"-Zwischenschritt, weil er selbst keine Inhalte verwaltet.
 */
import pool from '../db/pool.js';

export async function getUserOrgIds(userId) {
  const result = await pool.query(
    'SELECT organization_id FROM organization_members WHERE user_id = $1',
    [userId]
  );
  return result.rows.map((r) => r.organization_id);
}

// Gibt 'admin' | 'member' | null zurück
export async function getOrgRole(organizationId, userId) {
  const result = await pool.query(
    'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
    [organizationId, userId]
  );
  return result.rows[0]?.role ?? null;
}

const ROLE_RANK = { member: 0, admin: 1 };

export async function assertOrgAccess(organizationId, userId, required = 'member') {
  const role = await getOrgRole(organizationId, userId);
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

// getUserReachableOrgIds – für vereinsweit geteilte Ressourcen (EPIC 011,
// z.B. Playbooks): ALLE Vereine, für die ein Nutzer eine sinnvolle
// Berechtigung hat, ein Playbook dieses Vereins zu LESEN – entweder als
// explizites organization_members-Mitglied (i.d.R. Admins/Koordinatoren)
// ODER transitiv als team_members-Mitglied irgendeines Teams dieses
// Vereins (die eigentliche Zielgruppe: Trainer/Spieler der Vereinsteams,
// die typischerweise NIE explizit als organization_member eingeladen
// wurden). Bewusst EIN gemeinsamer Helfer statt zweier getrennter Checks,
// da beide Konsumenten (Liste + Einzel-Zugriffsprüfung) dieselbe Menge
// brauchen.
export async function getUserReachableOrgIds(userId) {
  const result = await pool.query(
    `SELECT organization_id FROM organization_members WHERE user_id = $1
     UNION
     SELECT t.organization_id FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND t.organization_id IS NOT NULL`,
    [userId]
  );
  return result.rows.map((r) => r.organization_id);
}
