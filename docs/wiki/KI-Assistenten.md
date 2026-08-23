# 🤖 KI-Assistenten

Fünf optionale, textbasierte Assistenten (`/api/ai/*`), sichtbar nur
wenn diese Instanz einen KI-Anbieter konfiguriert hat. Kein Assistent
speichert automatisch etwas – jeder liefert nur einen Textentwurf, den
der Trainer prüft, bearbeitet und explizit übernimmt (Ausnahme:
Spiel-Insights ist reines Lese-Ergebnis ohne Übernehmen-Schritt, siehe
unten).

## Konfiguration (Admin)

Unter [Einstellungen](./Einstellungen.md#admin-einstellungen) → Admin:
Basis-URL, Modell, Timeout, API-Key. Die API funktioniert mit jedem
Anbieter, der eine OpenAI-kompatible `/v1/chat/completions`-Schnittstelle
bereitstellt – lokal (z. B. Ollama, LM Studio) oder als Cloud-Dienst.
Kein Vendor-Lock-in auf einen bestimmten Anbieter. Der API-Key wird nie
an das Frontend zurückgegeben (nur ob einer gesetzt ist).

Alternativ per Umgebungsvariablen (`AI_PROVIDER_*` in `.env`, siehe
[Umgebungsvariablen](./Umgebungsvariablen.md)) – die Admin-UI-Werte
haben Vorrang, sobald sie einmal gesetzt wurden.

## Die fünf Assistenten

| Assistent | Seite | Eingabe | Ausgabe |
|---|---|---|---|
| Trainingsassistent | Trainingspläne | Altersgruppe (feste Liste), Ziel, Dauer, Spieleranzahl | Textentwurf einer Trainingseinheit (Warm-up/Technik/Taktik/Spielform/Cool-down) |
| Taktikassistent | Boards | Kategorie (Forechecking/Powerplay/Boxplay/Allgemein), Frage | 2–3 taktische Varianten mit Vor-/Nachteilen |
| Analyseassistent | Boards | Freitext-Beobachtungen zu einem Spiel/einer Situation | Zusammenfassung, erkannte Muster, Anschlussfragen |
| Wissensassistent | Wissen | Frage in natürlicher Sprache | Antwort auf Basis eigener Boards/Trainings/Bibliothekseinträge, mit Quellenangaben |
| Spiel-Insights | Spielseite (`/games/:id`) | Keine – nutzt automatisch die bereits berechneten Statistiken dieses Spiels | Auffällige Muster + mögliche Trainingsschwerpunkte, Grundlage einsehbar |

### Spiel-Insights im Detail

Button "KI-Spielanalyse" auf der Spielseite. Anders als die anderen
vier Assistenten braucht dieser **keine Eingabe** – die Grundlage sind
ausschließlich bereits berechnete Team-Kennzahlen dieses Spiels
(Schuss-Statistiken inkl. Zonen, Special Teams, Situations-Splits nach
Spielstand), keine Rohereignisse, keine Spieler-Namen. "Grundlage
anzeigen" zeigt den exakten Textblock, der tatsächlich an die KI
gesendet wurde – Nachvollziehbarkeit statt Blackbox. Kein "Übernehmen"-
Schritt: die zugrunde liegenden Zahlen sind ohnehin dauerhaft in den
[Statistiken](./Statistiken.md) sichtbar, der KI-Text ist ein
Lese-Ergebnis.

## Datenschutz und Grenzen

- Keine Spieler- oder Talentbewertung, keine Rankings einzelner
  Personen – die Prompt-Vorlagen (`backend/src/services/ai/prompts/`)
  schreiben das explizit vor.
- Der Analyseassistent zeigt im UI einen sichtbaren Hinweis, keine
  Namen/Rückennummern einzutragen.
- Der Wissensassistent ruft die KI **gar nicht erst auf**, wenn keine
  passenden eigenen Einträge gefunden werden – verhindert erfundene
  Antworten ohne echte Grundlage. Die Quellenliste kommt direkt aus
  der Datenbank-Suche, nicht aus dem KI-Text.
- Trainingsassistent/Taktikassistent nutzen bewusst feste Auswahllisten
  statt Freitext für Personendaten-sensible Felder.
- Spiel-Insights geht noch einen Schritt weiter: die Eingabe besteht
  ausschließlich aus bereits aggregierten Team-Zahlen, es gibt
  strukturell gar kein Feld, über das Namen/Rückennummern hineingelangen
  könnten (kein Freitext, keine Rohereignisse mit
  `roster_player_id`).

## Verwandte Seiten

- [Architektur – KI-Anbieter](./Architektur.md#ki-anbieter-optional)
- [Einstellungen](./Einstellungen.md)
