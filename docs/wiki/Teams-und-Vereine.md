# 👥 Teams und Vereine

Zwei getrennte, hierarchisch unabhängige Ebenen: **Teams** (eine
Mannschaft) und **Organizations** (ein Verein mit mehreren Teams).

## Teams

| Rolle | Rechte |
|---|---|
| owner | Alles, inkl. Mitglieder verwalten. Kann nicht entfernt/degradiert werden, solange er der einzige Owner ist |
| coach | Team-geteilte Inhalte (Kader, Lines, Spiele, Playbooks, Trainingspläne, Formationen) anlegen/bearbeiten |
| member | Nur ansehen – bei Spielen/Trainingseinheiten zusätzlich: per [RSVP](./Live-Spielnotizen.md#anwesenheit-rsvp) für sich selbst zu-/absagen |

Einladung setzt einen **bereits bestehenden** OpenFloorball-Account der
eingeladenen Person voraus – anders als bei Board-Kollaboratoren gibt
es hier keinen E-Mail-Einladungslink für neue Nutzer.

## Organizations (Vereine)

Gleiches Muster, aber nur zwei Rollen (admin/member). Ein Verein
besteht aus mehreren Teams; Org-Admins haben lesenden Einblick in die
Teams ihres Vereins, aber keine automatischen Bearbeitungsrechte an
deren Inhalten.

Jeder Verein hat ein eigenes Dashboard (`/organizations/:id`, verlinkt
aus den Einstellungen → Vereine): Vereinsname umbenennen (Admin, per
Doppelklick), Mitgliederverwaltung (einladen, Rolle ändern, entfernen)
sowie ein Abschnitt "Teams in diesem Verein". Dort sehen Org-Admins
alle Teams ihres Vereins und können direkt ein neues, dem Verein
zugeordnetes Team anlegen. Einfache Mitglieder sehen in diesem
Abschnitt bewusst nur die Teams, in denen sie selbst Mitglied sind
(Datensparsamkeit) – nicht automatisch alle Teams des Vereins.

Zusätzlich, ebenfalls admin-only: "Anstehende Termine im Verein" –
eine gebündelte, rein lesende Übersicht aller zukünftigen Spiele und
Trainingseinheiten über alle Teams des Vereins hinweg (z.B. für
Hallenbelegung/Terminkollisionen zwischen mehreren Sparten wie
1. Herren und U15). Kein neuer Bearbeitungsweg – ändern bleibt weiter
Sache des jeweiligen Teams. Für einfache Mitglieder unsichtbar.

## Was NICHT team-gebunden ist

Boards sind bewusst **kein** Teil des Team-/Vereinsmodells. Wer an
einem Board mitarbeiten soll, wird über
[Board-Kollaboratoren](./Export.md#board-teilen-kollaboratoren) eingeladen – unabhängig
davon, ob beide Personen im selben Team sind. Team-geteilt werden
können dagegen: Kader-Einträge, Lines, Spiele, Playbooks,
Formationsvorlagen und Trainingspläne (jeweils optional, per
`teamId`). Ist ein Spiel oder eine Trainingseinheit team-geteilt,
steht dort automatisch auch die [Anwesenheitsliste (RSVP)](./Live-Spielnotizen.md#anwesenheit-rsvp)
für die ganze Mannschaft zur Verfügung.

## Verwandte Seiten

- [Export & Teilen](./Export.md)
- [Kader](./Kader.md)
- [Lines](./Lines.md)
- [Trainingsplaner](./Trainingsplaner.md)
- [Live-Spielnotizen](./Live-Spielnotizen.md)
