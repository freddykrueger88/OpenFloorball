# 📚 Playbooks (Board-Sammlungen)

Ein Playbook gruppiert mehrere Boards thematisch, z. B. "Powerplay",
"Standardsituationen" oder "Gegner XY". Rein organisatorisch – ändert
nichts an den Boards selbst.

## Anlegen und zuweisen

- Playbooks werden unabhängig von Boards erstellt (nur ein Name)
- Beim Anlegen oder Bearbeiten eines Boards kann es einem Playbook
  zugewiesen werden (optional, auch nachträglich änderbar)
- Maximal **15 Playbooks** pro Account
- Ein Playbook hat genau einen Sichtbarkeits-Scope: **persönlich**, mit
  einem **Team** geteilt, oder – neu, EPIC 011 – **vereinsweit** über
  alle Teams eines Vereins hinweg geteilt. Ein vereinsweites Playbook
  anzulegen ist Vereins-Admins vorbehalten (ein einfaches
  Team-Coach-Recht reicht dafür nicht, da die Sichtbarkeit über die
  eigene Team-Grenze hinausgeht) – sichtbar ist es dann für jedes
  Mitglied irgendeines Teams des Vereins, ohne dass diese Person selbst
  extra als Vereinsmitglied eingeladen sein muss. Wie beim
  team-geteilten Playbook gilt: geteilt wird nur der Playbook-**Name**/
  die Sammlung, nicht automatisch der Zugriff auf die einzelnen Boards
  darin (die bleiben über [Board-Kollaboratoren](./Export.md#board-teilen-kollaboratoren)
  separat geschützt).

## Filtern

Auf der Board-Übersicht lässt sich nach Playbook filtern, um schnell
nur die Boards eines bestimmten Themas zu sehen.

## Playbook löschen

Löscht nur die Gruppierung – enthaltene Boards bleiben erhalten und
werden lediglich keinem Playbook mehr zugeordnet
(`playbook_id` wird auf `NULL` gesetzt).

## Verwandt

- [Erste Schritte](./Erste-Schritte.md)
- [Formationen](./Formationen.md) – Vorlagen für Startaufstellungen (anderes Konzept)
