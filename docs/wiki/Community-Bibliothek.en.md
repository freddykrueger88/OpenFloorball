# 📚 Community Library

*[🇩🇪 Deutsch](Community-Bibliothek.md) | 🇬🇧 English*

An instance-wide exercise library: every logged-in user of this
OpenFloorball instance can publish their own boards and clone other
people's entries. No anonymous access (unlike public share links).

## Publishing

Available from the editor of your own board (owner only). Creates a
**snapshot copy** in a separate table – no live reference to the
original. From then on they're independent: changes to the original
board no longer affect the published entry.

Deliberately **not** copied along (data minimization):

- `notes` (coach's private notes)
- `opponent` (opponent name)
- Board collaborators

## Browsing and adopting

`/library` – filter by category, text search by name. "Add to my
boards" creates a fully editable private copy in your own account.

## Reporting and moderation

Any user can report an entry with a reason (one report per user and
entry). Admins see reported entries under
[Settings → Admin](./Einstellungen.en.md#admin-settings) and can
remove them. Creators can delete their own entries at any time.

## Account deletion

If a user deletes their account, their published library entries
remain – only the creator reference is removed (anonymized), matching
the GDPR deletion of the rest of the account.

## Related pages

- [Playbooks](./Playbooks.en.md)
- [Privacy](./Datenschutz.en.md)
