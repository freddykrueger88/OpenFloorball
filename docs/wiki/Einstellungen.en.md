# ⚙️ Settings

*[🇩🇪 Deutsch](Einstellungen.md) | 🇬🇧 English*

Available via `/settings` (logged-in user) or the "Settings" tab in
the board editor for field-related options.

## Account-wide settings (`/settings`)

| Setting | Values |
|---|---|
| **Theme** | Dark, Light, Vikings, IFF |
| **Language** | German, English |
| **Dyslexia-friendly font** | on/off ([OpenDyslexic](https://opendyslexic.org/)) |

All account settings are stored as JSON per user and apply across
devices after login.

## Field-related settings (board editor, "Settings" tab)

These apply per browser session, not stored globally:

| Setting | Description |
|---|---|
| **Show names** | Show/hide player names, position above/below the player token |
| **Position hints** | Short description + tips on hovering over a position |
| **Field type** | Large/small/street/3v3 – see [IFF field types](./IFF-Spielfelder.en.md) |
| **Share board** | Add a collaborator – see [Export & sharing](./Export.en.md) |

Team colors (home/away/ball) and the keyboard shortcuts overview
deliberately stay in the header at the top right, since they're meant
to be reachable quickly without a menu click.

## Admin settings

The first registered user automatically becomes admin. Admin-only:

- View the user list, change roles, delete users
- Configure the backup schedule – see [Backup](./Backup.en.md)

There's currently no dedicated admin UI page for this in the frontend
beyond the API (see [API documentation](./API.en.md#admin)).
