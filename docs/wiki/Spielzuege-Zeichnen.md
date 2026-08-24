# ✏️ Spielzüge zeichnen

*🇩🇪 Deutsch | [🇬🇧 English](Spielzuege-Zeichnen.en.md)*

Die Zeichenwerkzeuge sitzen links neben dem Spielfeld im Board-Editor
(bei aufgeklapptem unterem Menü scrollbar, falls der Platz nicht reicht).

## Werkzeuge

| Werkzeug | Kürzel | Beschreibung |
|---|---|---|
| ← Auswahl | `Esc` | Elemente anklicken/verschieben, kein Zeichnen |
| ➡ Bewegungspfeil | `M` | Zeigt, wohin sich ein Spieler bewegen soll (durchgezogen) |
| ⇢ Pass-Pfeil | `P` | Pass zwischen Spielern (gestrichelt) |
| ⚡ Schuss-Pfeil | `S` | Schuss aufs Tor (dick, durchgezogen) |
| ✏ Freihand | `F` | Freies Zeichnen für flexible Markierungen |
| □ Radierer | `E` | Einzelnes Element per Klick löschen |

Farbe und Linienstärke (dünn/mittel/dick) sind frei wählbar, unabhängig
vom gewählten Werkzeug.

## Per Koordinaten zeichnen

Im unteren Tab-Menü ("Zeichnen"-Tab) lässt sich ein Pfeil oder eine
Freihand-Linie auch über exakte Start-/End-Koordinaten (in Metern)
statt per Maus/Touch erzeugen – nützlich für präzise Diagramme und für
rein tastaturbediente Nutzung (Barrierefreiheit).

## Rückgängig / Wiederherstellen

- `Strg+Z` / `Cmd+Z` – Rückgängig
- `Strg+Y` bzw. `Strg+Umschalt+Z` – Wiederherstellen
- `Entf`/`Backspace` – ausgewähltes Element löschen

Der Verlauf ist in der Werkzeugleiste als Liste sichtbar, ein Klick auf
einen Eintrag springt direkt zu diesem Zustand.

## Frame-Bezug

Gezeichnete Elemente gehören zum **aktuell aktiven Frame** – beim
Wechsel zu einem anderen Frame verschwindet die Zeichnung dort (jeder
Frame hat seine eigenen Elemente).

Beim **Anlegen eines neuen Frames** (Button "Frame" in der Timeline)
werden die aktuellen Spielerpositionen immer übernommen, Zeichnungen
standardmäßig **nicht** – ein neuer Frame ist meist eine neue
Spielsituation, in der alte Pfeile selten noch passen. Direkt neben
dem "Frame"-Button lässt sich das über einen kleinen Schalter
umkehren (Stift-Symbol), falls eine Zeichnung doch über mehrere Frames
hinweg gelten soll (z. B. eine Zonenmarkierung). Für eine Zeichnung,
die nur in einem einzelnen weiteren Frame sichtbar sein soll, kann sie
dort natürlich auch einfach neu angelegt werden. Details zu Frames:
[Frame-by-Frame Animation](./Animation.md).

## Feldgröße ändern

Ein Wechsel des Spielfeld-Typs (Einstellungen-Tab) skaliert
Spielerpositionen und gezeichnete Elemente automatisch proportional auf
die neuen Feldmaße.
