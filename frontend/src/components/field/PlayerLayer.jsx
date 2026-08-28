/**
 * PlayerLayer – Rendert alle Spieler beider Teams als Konva-Layer
 *
 * Props:
 *   players      – Array<PlayerState> (aus usePlayerState)
 *   scale        – px pro Meter
 *   offsetX/Y    – Feldversatz
 *   homeColor    – { fill, stroke }
 *   awayColor    – { fill, stroke }
 *   selectedId   – aktuell ausgewählter Spieler-ID
 *   onSelect     – (id) => void
 *   onDragEnd    – (id, x_m, y_m) => void
 *   snapToGrid   – Meter
 *   readonly     – boolean
 *   layerVisibility – { home, away } (Layer-System, CLAUDE.md §10.2) –
 *                  fehlend/undefined gilt als sichtbar (optional chaining
 *                  unten), bestehende Aufrufer ohne dieses Prop bleiben
 *                  unverändert.
 */
import { Layer } from 'react-konva';
import PlayerToken from './PlayerToken.jsx';
import BallToken from './BallToken.jsx';

export default function PlayerLayer({
  players     = [],
  scale,
  offsetX,
  offsetY,
  homeColor   = { fill: '#1d4ed8', stroke: '#1e3a8a' },
  awayColor   = { fill: '#dc2626', stroke: '#991b1b' },
  ballColor   = '#f97316',
  selectedId  = null,
  onSelect,
  onDragEnd,
  snapToGrid  = 0,
  readonly    = false,
  showNames   = false,
  namePosition = 'unten',
  showHints   = false, // Issue #27
  layerVisibility,
}) {
  return (
    <Layer>
      {players.map((p) => {
        // ROADMAP-Backlog "beweglicher Ball": der Ball ist ein Eintrag mit
        // team:'ball' im selben Array wie die Spieler (siehe ensureBall()
        // in constants/fieldConfig.js) – eigenes, einfacheres Token statt
        // PlayerToken (keine Rolle, kein Torwart-Rautenform, kein Namenslabel).
        if (p.team === 'ball') {
          return (
            <BallToken
              key={p.id}
              ball={p}
              scale={scale}
              offsetX={offsetX}
              offsetY={offsetY}
              color={ballColor}
              isSelected={p.id === selectedId}
              onSelect={onSelect}
              onDragEnd={onDragEnd}
              snapToGrid={snapToGrid}
              readonly={readonly}
            />
          );
        }
        // Issue 025: Sichtbarkeit pro Spieler – fehlendes Feld gilt als
        // sichtbar (bestehende Boards ohne dieses Feld unverändert).
        // Layer-System: zusätzlich die gesamte Mannschaft (Eigene
        // Spieler/Gegner) über die Session ausblendbar – beide Filter
        // wirken unabhängig voneinander (UND-Verknüpfung).
        if (p.visible === false) return null;
        if (layerVisibility?.[p.team] === false) return null;

        const color = p.team === 'home' ? homeColor : awayColor;
        return (
          <PlayerToken
            key={p.id}
            player={p}
            scale={scale}
            offsetX={offsetX}
            offsetY={offsetY}
            color={color.fill}
            strokeColor={color.stroke}
            isSelected={p.id === selectedId}
            onSelect={onSelect}
            onDragEnd={onDragEnd}
            snapToGrid={snapToGrid}
            readonly={readonly}
            showName={showNames}
            namePosition={namePosition}
            showHints={showHints}
          />
        );
      })}
    </Layer>
  );
}
