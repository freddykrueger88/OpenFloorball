# 📧 E-Mail-Versand einrichten (z. B. mit Gmail)

OpenFloorball verschickt aktuell E-Mails in zwei Fällen: wenn ein
Nutzer über den "Board teilen"-Button als Kollaborator zu einem Board
hinzugefügt wird, und beim Passwort-Reset-Link. Für Board-Sharing ist
das komplett optional – ohne Konfiguration funktioniert die App
unverändert, es wird nur keine Mail verschickt. Der **Passwort-Reset
funktioniert dagegen ohne SMTP-Konfiguration gar nicht** – ohne diese
Einrichtung bleibt "Passwort vergessen?" wirkungslos (kein Fehler, aber
auch keine Mail, siehe Schritt 4).

> ⚠️ **Wichtig:** OpenFloorball verschickt Einladungen nur an **bereits
> registrierte** OpenFloorball-Nutzer. Es gibt keinen Einladungslink für
> noch nicht angemeldete E-Mail-Adressen – die Person muss sich vorher
> selbst registriert haben.

## Voraussetzungen

Ein SMTP-Zugang, über den OpenFloorball Mails verschicken darf. Die
meisten Coaches haben bereits ein Gmail-Konto – diese Anleitung nutzt
Gmail als Beispiel, jeder andere SMTP-Anbieter (eigener Mailserver,
Mailbox.org, Zoho, …) funktioniert genauso über dieselben
Umgebungsvariablen.

## Schritt 1: App-Passwort bei Google erstellen

Google erlaubt seit der verpflichtenden 2-Faktor-Authentifizierung
**keine** normalen Kontopasswörter mehr für SMTP-Zugriff von externen
Anwendungen. Stattdessen wird ein sogenanntes **App-Passwort** benötigt:

1. 2-Faktor-Authentifizierung für das Google-Konto muss aktiviert sein
   (Voraussetzung für App-Passwörter) – falls noch nicht geschehen,
   unter [myaccount.google.com/security](https://myaccount.google.com/security)
   einrichten.
2. App-Passwort erstellen unter
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Einen beliebigen Namen vergeben (z. B. `OpenFloorball`) und
   **Erstellen** klicken.
4. Das angezeigte 16-stellige Passwort kopieren (nur einmal sichtbar!).

## Schritt 2: `.env` konfigurieren

In der `.env`-Datei des OpenFloorball-Servers (siehe
[`.env.example`](../../.env.example) für alle Variablen) ergänzen:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=deine-adresse@gmail.com
SMTP_PASSWORD=das_16-stellige_app-passwort
SMTP_FROM=OpenFloorball <deine-adresse@gmail.com>
```

- `SMTP_SECURE=false` ist bei Port `587` korrekt (STARTTLS wird
  automatisch verhandelt). Nur bei Port `465` müsste `SMTP_SECURE=true`
  gesetzt werden.
- `SMTP_PASSWORD` ist das App-Passwort aus Schritt 1 – **nicht** das
  normale Google-Kontopasswort, das funktioniert nicht.
- `SMTP_FROM` darf von `SMTP_USER` abweichen, sofern das Gmail-Konto
  berechtigt ist, im Namen dieser Adresse zu senden – im Zweifel
  dieselbe Adresse wie `SMTP_USER` verwenden.

## Schritt 3: Neu starten

```bash
docker compose up -d --build backend
```

(Ein reiner `restart` reicht bei einer geänderten `.env` nicht immer
zuverlässig – `up -d` liest die Datei sicher neu ein.)

## Schritt 4: Testen

Einen zweiten Test-Account registrieren (oder einen echten Kollegen
nehmen), dann ein Board → "Board teilen" → die Test-E-Mail eintragen.
Kommt keine Mail an:

```bash
docker compose logs backend | grep -i "e-mail-versand"
```

Ein Log-Eintrag `E-Mail-Versand fehlgeschlagen` zeigt ein
SMTP-Verbindungs- oder Auth-Problem (z. B. falsches App-Passwort,
Firewall blockiert Port 587 ausgehend). Ohne jeden Log-Eintrag und ohne
angekommene Mail: `SMTP_HOST` in der `.env` prüfen – ist die Variable
leer geblieben, verschickt OpenFloorball bewusst gar nichts (kein Fehler,
kein Log, siehe Datensparsamkeit-Prinzip des Projekts:
[CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Andere SMTP-Anbieter

Dieselben fünf Variablen funktionieren mit jedem SMTP-Server:

| Anbieter | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` |
|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | `587` | `false` |
| Mailbox.org | `smtp.mailbox.org` | `587` | `false` |
| Zoho Mail | `smtp.zoho.eu` | `587` | `false` |
| Eigener Mailserver (implizites TLS) | *dein Host* | `465` | `true` |

Bei den meisten Anbietern gilt: App-Passwort statt Kontopasswort
verwenden, sobald 2FA aktiv ist.
