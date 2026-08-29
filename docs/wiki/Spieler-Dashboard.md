# 🏠 Spieler-Dashboard

*🇩🇪 Deutsch | [🇬🇧 English](Spieler-Dashboard.en.md)*

Eine neue Startseite unter `/dashboard` (zusätzlich zu `/boards`, nicht als
Ersatz) – gedacht als Anlaufstelle für den Spieltag, den Trainingsalltag und
die persönliche Saisonübersicht.

## Was zeigt das Dashboard?

- **Nächstes Spiel**: Countdown, Gegner, Anstoßzeit, Halle/Adresse, Heim/
  Auswärts, Status (geplant/verlegt/abgesagt) – plus direkte Zu-/Absage.
- **Nächstes Training**: dieselben Kerninformationen kompakter, ebenfalls
  mit direkter Zu-/Absage.
- **Meine Statistiken**: Tore/Assists/Punkte/Strafminuten bzw. bei
  Torhütern Gegentore/Fangquote, plus die letzten 5 Spiele als kleines
  Balkendiagramm.
- **Letztes Spiel**: Endstand und die eigene Leistung darin.
- **Saisonüberblick**: Spiele/Siege/Unentschieden/Niederlagen/
  Tordifferenz.
- **Nächste Termine**: die kommenden 5 Spiele/Trainings gemischt,
  chronologisch.
- **Schnellzugriffe** und eine **OpenStreetMap-Karte** zum nächsten
  Spielort (Adress-Fallback, wenn keine Koordinaten hinterlegt sind).

## Direkte Zu-/Absage

Nutzt das bestehende [RSVP-System](./Live-Spielnotizen.md#anwesenheit-rsvp)
1:1 weiter (Status `yes`/`no`/`maybe`) – neu ist nur ein kompaktes,
**optimistisches** Widget direkt in der Dashboard-Karte: ein Klick speichert
sofort sichtbar, ein Fehlschlag rollt automatisch auf den vorherigen Status
zurück. Gesperrt bei abgesagten oder bereits vergangenen Terminen.

## Warum brauchte es neue Datenbank-Felder?

Zwei echte Lücken mussten geschlossen werden, damit das Dashboard nicht nur
Beispieldaten zeigt:

1. **Spiel-Logistik.** `games`/`training_sessions` hatten bisher nur ein
   Datum, keine Uhrzeit, keinen Ort, keinen Status. Additiv ergänzt:
   `kickoff_time`/`start_time`, `venue_name`/`venue_address`/`venue_lat`/
   `venue_lng`, `is_home` (nur `games`), `status`
   (`scheduled`/`postponed`/`cancelled`), `duration_minutes` (nur
   `training_sessions`). Alle Felder nullable – bestehende Einträge zeigen
   dafür einen sauberen Fallback statt erfundener Werte.
2. **Verknüpfung Login-Account ↔ Kader-Eintrag.** `roster_players.user_id`
   ist der Ersteller/Coach, nicht zwangsläufig der Spieler selbst – ohne
   eine zusätzliche Verknüpfung kann kein Account je ermitteln, welcher
   Kader-Eintrag "er selbst" ist, und damit auch nie eigene Tore/Assists
   sehen. Neu: `roster_players.linked_user_id` (nullable, ein Account kann
   höchstens einem Kader-Eintrag zugeordnet sein). Setzbar durch den Team-
   Owner/-Coach direkt auf [`/roster`](./Kader.md), nur für team-geteilte
   Einträge und nur mit tatsächlichen Team-Mitgliedern als Ziel.

## Optionale Saisonmanager-Anbindung

[Floorball Deutschlands Saisonmanager](https://saisonmanager.de) verwaltet
für viele Vereine bereits Spielpläne und Tabellen. Ein Team kann sich damit
verbinden (Einstellungen → Teams → Saisonmanager, owner-only): API-Key,
Liga-ID und die eigene Saisonmanager-Team-ID eintragen. Danach zeigt das
Dashboard echte Anstoßzeiten/Hallen/Tabellenplätze statt der eigenen,
manuell gepflegten Werte.

- **Rein optional und rein lesend.** Ohne Verbindung ändert sich nichts –
  die eigenen `games` bleiben die Quelle. Es gibt keine Rückschreibung nach
  Saisonmanager.
- **Der API-Key verlässt das Backend nie.** Er wird nur serverseitig
  genutzt (`X-Api-Key`-Header gegen `saisonmanager.de/api/v2`), analog zum
  bestehenden Muster für KI-Provider-Keys.
- Ein Verein muss den API-Key selbst bei Floorball Deutschland beziehen –
  das ist nicht Teil dieser Anbindung.

## Direkte Zu-/Absage – Sonderfälle

Sowohl clientseitig (Buttons deaktiviert) als auch serverseitig
(`rsvpsController.js::guardEditable`) blockiert: eine Rückmeldung zu einem
abgesagten oder bereits vergangenen Termin (Datum + Uhrzeit, ohne erfasste
Uhrzeit gilt der ganze Kalendertag) wird mit 400 abgelehnt.

## Bekannte Einschränkungen

- Keine Rückmeldefrist/Deadline – dieses Konzept existiert im Datenmodell
  nicht und wird nicht vorgetäuscht.
- Ohne Saisonmanager-Anbindung gibt es keinen Tabellenplatz/keine Punkte –
  nur ehrlich aus eigenen Spielen Ableitbares (keine erfundene Tabelle).
- `/` leitet weiterhin nach `/boards` weiter, nicht nach `/dashboard` – eine
  Umstellung der Standard-Startseite ist ein separater, künftiger Schritt.

## Verwandte Seiten

- [Live-Spielnotizen](./Live-Spielnotizen.md) (RSVP-System, Live-Ereignisse)
- [Kader](./Kader.md) (Login-Account-Verknüpfung)
- [Teams und Vereine](./Teams-und-Vereine.md) (Saisonmanager-Anbindung)
- [Trainingsplaner](./Trainingsplaner.md)
