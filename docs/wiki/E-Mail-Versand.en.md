# 📧 Setting up email delivery (e.g. with Gmail)

*[🇩🇪 Deutsch](E-Mail-Versand.md) | 🇬🇧 English*

OpenFloorball currently sends emails in two cases: when a user is
added as a collaborator to a board via the "Share board" button, and
for the password reset link. For board sharing this is entirely
optional – without configuration the app works exactly the same,
it just won't send an email. **Password reset, on the other hand,
doesn't work at all without SMTP configuration** – without this setup,
"Forgot password?" stays a no-op (no error, but also no email, see
step 4).

> ⚠️ **Important:** OpenFloorball only sends invitations to **already
> registered** OpenFloorball users. There is no invite link for email
> addresses that haven't signed up yet – the person needs to have
> registered themselves first.

## Requirements

An SMTP account that OpenFloorball is allowed to send mail through.
Most coaches already have a Gmail account – this guide uses Gmail as
an example, but any other SMTP provider (your own mail server,
Mailbox.org, Zoho, …) works the same way through the same environment
variables.

## Step 1: Create an app password with Google

Since mandatory two-factor authentication, Google no longer allows
regular account passwords for SMTP access from external applications.
Instead, you need a so-called **app password**:

1. Two-factor authentication must be enabled for the Google account
   (a prerequisite for app passwords) – if not done yet, set it up at
   [myaccount.google.com/security](https://myaccount.google.com/security).
2. Create an app password at
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Give it any name (e.g. `OpenFloorball`) and click **Create**.
4. Copy the displayed 16-character password (only shown once!).

## Step 2: Configure `.env`

In the OpenFloorball server's `.env` file (see
[`.env.example`](../../.env.example) for all variables), add:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-address@gmail.com
SMTP_PASSWORD=the_16-character_app-password
SMTP_FROM=OpenFloorball <your-address@gmail.com>
```

- `SMTP_SECURE=false` is correct for port `587` (STARTTLS is
  negotiated automatically). Only for port `465` would you need
  `SMTP_SECURE=true`.
- `SMTP_PASSWORD` is the app password from step 1 – **not** your
  regular Google account password, which won't work.
- `SMTP_FROM` may differ from `SMTP_USER` as long as the Gmail account
  is authorized to send on behalf of that address – when in doubt, use
  the same address as `SMTP_USER`.

## Step 3: Restart

```bash
docker compose up -d --build backend
```

(A plain `restart` doesn't always reliably pick up a changed `.env` –
`up -d` reliably re-reads the file.)

## Step 4: Test

Register a second test account (or ask a real colleague), then go to
a board → "Share board" → enter the test email address. If no email
arrives:

```bash
docker compose logs backend | grep -i "e-mail-versand"
```

A log entry `E-Mail-Versand fehlgeschlagen` ("email delivery failed")
indicates an SMTP connection or auth problem (e.g. wrong app password,
firewall blocking outbound port 587). No log entry at all and no email
arriving: check `SMTP_HOST` in `.env` – if the variable is left empty,
OpenFloorball deliberately sends nothing at all (no error, no log, see
the project's data-minimization principle:
[CONTRIBUTING.md](../../CONTRIBUTING.md)).

## Other SMTP providers

The same five variables work with any SMTP server:

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_SECURE` |
|---|---|---|---|
| Gmail / Google Workspace | `smtp.gmail.com` | `587` | `false` |
| Mailbox.org | `smtp.mailbox.org` | `587` | `false` |
| Zoho Mail | `smtp.zoho.eu` | `587` | `false` |
| Your own mail server (implicit TLS) | *your host* | `465` | `true` |

For most providers: use an app password instead of your account
password once 2FA is active.
