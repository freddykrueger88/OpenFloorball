# 📋 Audit Log

*🇩🇪 [Deutsch](Audit-Log.md) | 🇬🇧 English*

Append-only log of all security- and compliance-relevant actions in
OpenFloorball. Every entry captures **who, when, and what action** was
performed, including before/after delta and metadata. The audit log
ensures traceability as required by the statistics architecture
document (EPIC 012).

## What is logged?

| Category | Examples |
|---|---|
| **Permissions / roles** | Admin user role changes, team member add/remove, club members, board collaborators including invitations |
| **Deletions** | Admin user deletion, self-deletion of account |
| **Data exports** | PDF tactic sheet, match report, CSV roster/games, GIF/MP4, GDPR ZIP backup |
| **Admin actions** | Backup config/run, AI provider configuration (API keys are **deliberately never** stored in audit) |

## Technical implementation

- Append-only table `audit_log` in PostgreSQL
- Central service: `auditLogger` (importable in any route handler)
- Existing endpoints are not affected by the audit logging

## Viewing

The audit log is accessible in the admin section under administrative
settings. Details on columns and permissions: see
[API documentation](./API.md) (internal admin module).

---

> Changelog reference: Unreleased – Generic Audit Log, see
> [CHANGELOG.md](../../CHANGELOG.md)
