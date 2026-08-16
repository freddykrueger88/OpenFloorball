/**
 * ShotZoneDiagram – EINE Komponente für Picker UND Shot Map (Statistik-
 * Architektur Phase 3), verhindert zwei Feld-Implementierungen. Bewusst
 * kein react-konva/FloorballField-Wiederverwendung (siehe Architektur-
 * Dokument Abschnitt 8.5): eine einfache SVG mit 0-1-normalisierten
 * Koordinaten reicht für ein schematisches Zonen-Diagramm, ohne
 * Meter-Umrechnung oder Board-Editor-Abhängigkeiten in GamePage.jsx zu
 * ziehen.
 *
 * viewBox="0 0 100 100", Tor an der rechten Kante (x=100), Angriffsrichtung
 * links→rechts. Zonen-Schwellwerte identisch zu
 * frontend/src/constants/shotZones.js (SHOT_ZONES/deriveZone).
 */
import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SHOT_ZONES } from '../../constants/shotZones.js';
import styles from './ShotZoneDiagram.module.css';

const ZONE_RECTS = {
  nahzone_zentrum: { x: 72, y: 35, w: 28, h: 30 },
  nahzone_links:   { x: 72, y: 0,  w: 28, h: 35 },
  nahzone_rechts:  { x: 72, y: 65, w: 28, h: 35 },
  halbdistanz:     { x: 40, y: 0,  w: 32, h: 100 },
  distanz:         { x: 0,  y: 0,  w: 40, h: 100 },
};

export default function ShotZoneDiagram({
  interactive = false,
  selectedPoint = null,
  onSelect = undefined,
  markers = [],
  showZoneOverlay = true,
}) {
  const { t, i18n } = useTranslation();
  const svgRef = useRef(null);

  const handlePointer = useCallback((e) => {
    if (!interactive || !onSelect || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    onSelect(x, y);
  }, [interactive, onSelect]);

  const zoneLabel = (key) => {
    const zone = SHOT_ZONES.find((z) => z.key === key);
    if (!zone) return t('shotZones.unknown');
    return i18n.language === 'en' ? zone.labelEn : zone.labelDe;
  };

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className={`${styles.diagram} ${interactive ? styles.interactive : ''}`}
      role="img"
      aria-label={t('shotZones.diagramAriaLabel')}
    >
      {showZoneOverlay && SHOT_ZONES.map((zone) => {
        const rect = ZONE_RECTS[zone.key];
        return (
          <g key={zone.key}>
            <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} className={styles.zoneRect} />
            <text x={rect.x + rect.w / 2} y={rect.y + rect.h / 2} className={styles.zoneLabel} textAnchor="middle">
              {zoneLabel(zone.key)}
            </text>
          </g>
        );
      })}

      <rect x="97" y="40" width="3" height="20" className={styles.goal} aria-hidden="true" />

      {markers.map((m) => (
        <g key={m.id} transform={`translate(${m.x * 100}, ${m.y * 100})`}>
          {m.outcome === 'goal' && <circle r="2.2" className={`${styles.marker} ${styles.markerGoal}`} />}
          {m.outcome === 'save' && <circle r="2.2" className={`${styles.marker} ${styles.markerSave}`} fill="none" />}
          {m.outcome === 'miss' && (
            <g className={`${styles.marker} ${styles.markerMiss}`}>
              <line x1="-1.8" y1="-1.8" x2="1.8" y2="1.8" />
              <line x1="-1.8" y1="1.8" x2="1.8" y2="-1.8" />
            </g>
          )}
          {m.outcome === 'block' && (
            <rect x="-1.8" y="-1.8" width="3.6" height="3.6" className={`${styles.marker} ${styles.markerBlock}`} />
          )}
        </g>
      ))}

      {selectedPoint && (
        <circle cx={selectedPoint.x * 100} cy={selectedPoint.y * 100} r="2.5" className={styles.selectedPoint} />
      )}

      {interactive && (
        <rect
          x="0" y="0" width="100" height="100"
          className={styles.captureLayer}
          onClick={handlePointer}
          onTouchStart={handlePointer}
        />
      )}
    </svg>
  );
}
