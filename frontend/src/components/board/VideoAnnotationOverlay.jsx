/**
 * VideoAnnotationOverlay – Player + Zeichnen-Überlagerung + Trimmen +
 * Szenen-Marken für ein einzelnes Video (Video-Integration Ausbau,
 * ROADMAP-Backlog).
 *
 * Zeichnen: EINE feste Überlagerung pro Video (kein Zeitstempel-System) –
 * Video pausieren, mit den vorhandenen Zeichen-Werkzeugen (useDrawing.js,
 * DrawingLayer/DrawingToolbar – dieselben Komponenten wie im Board-Editor,
 * players bleibt hier einfach ungenutzt leer) drüberzeichnen, Zeichnung
 * bleibt fürs ganze Video sichtbar bis geändert/gelöscht.
 *
 * Trimmen: rein Player-seitige Start-/Endgrenzen (kein ffmpeg-Schnitt) –
 * Originaldatei bleibt immer vollständig erhalten, jederzeit rückgängig.
 *
 * Szenen-Marken: Zeitstempel mit Label, Klick springt zur Position.
 *
 * Ereignis-Verknüpfung (Statistik-Architektur Phase 6, optional – nur
 * genutzt von GameVideoPanel.jsx im Spielkontext, bei Board-Videos bleiben
 * linkableEvents/onLinkEvent/onUnlinkEvent/onSeekReady einfach undefined
 * und der Abschnitt/Effekt entfällt): analog zu Szenen-Marken lässt sich
 * die aktuelle Wiedergabeposition mit einem bestehenden game_event
 * verknüpfen (video_id + video_timestamp_seconds) – siehe
 * gameEventsController.linkEventVideo. onSeekReady meldet die interne
 * seekTo-Funktion einmalig nach oben, damit die Zeitleiste in GamePage.jsx
 * von einem Ereignis aus zur richtigen Videoposition springen kann.
 */
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Stage } from 'react-konva';
import { Pencil, Eye, EyeOff, Trash2, MapPin, LayoutTemplate, AlertTriangle } from 'lucide-react';
import { useDrawing } from '../../hooks/useDrawing.js';
import { useBoardsApi } from '../../hooks/useBoardsApi.js';
import { apiFetch } from '../../utils/apiFetch.js';
import { IFF_FIELDS } from '../../constants/fieldConfig.js';
import { videoElementsToBoardElements } from '../../utils/videoElementsToBoardElements.js';
import useAnnounceStore from '../../store/announceStore.js';
import DrawingLayer from '../drawing/DrawingLayer.jsx';
import DrawingToolbar from '../drawing/DrawingToolbar.jsx';
import Button from '../common/Button.jsx';
import styles from './VideoAnnotationOverlay.module.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoAnnotationOverlay({
  video, canEdit, streamUrl, onUpdate, fieldType, homeColor, awayColor, ballColor,
  linkableEvents, onLinkEvent, onUnlinkEvent, onSeekReady,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createBoard } = useBoardsApi();
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [drawMode, setDrawMode] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markerLabel, setMarkerLabel] = useState('');
  const [addingMarker, setAddingMarker] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [createBoardError, setCreateBoardError] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [linking, setLinking] = useState(false);

  const drawing = useDrawing();

  // Overlay-Größe an die tatsächlich gerenderte Video-Größe koppeln
  // (gleiches Muster wie FieldContainer.jsx).
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const measure = () => {
      if (!containerRef.current) return;
      setSize({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const enterDrawMode = () => {
    videoRef.current?.pause();
    drawing.loadScene([], video.elements ?? []);
    setDrawMode(true);
  };

  const handleSaveDrawing = async () => {
    setSaving(true);
    try {
      await onUpdate({ elements: drawing.elements });
      setDrawMode(false);
    } finally {
      setSaving(false);
    }
  };

  // ── Video-Zeichnung → eigenständiges Taktik-Board (ROADMAP-Backlog) ──
  // Übernimmt bewusst nur die bereits gespeicherte Overlay-Zeichnung
  // (video.elements), kein Video-Standbild (siehe Plan-Kontext) –
  // Umrechnung Pixel→Meter rein clientseitig anhand der aktuellen
  // Container-Größe (`size`), mit der die Zeichnung auch angezeigt wird.
  const handleCreateBoardFromDrawing = async () => {
    setCreatingBoard(true);
    setCreateBoardError(null);
    try {
      const field = IFF_FIELDS[fieldType] ?? IFF_FIELDS.large;
      const rescaled = videoElementsToBoardElements(video.elements, size, field);
      const title = video.title || t('video.untitled');
      const board = await createBoard({
        name: t('video.boardFromVideoName', { title }),
        fieldType,
        homeColor,
        awayColor,
        ballColor,
        notes: t('video.createdFromVideoNote', { title }),
      });
      const frames = await apiFetch(`/api/boards/${board._id}/frames`);
      const firstFrame = frames[0];
      await apiFetch(`/api/boards/${board._id}/frames/${firstFrame._id}`, {
        method: 'PUT',
        body: JSON.stringify({ elements: rescaled }),
      });
      useAnnounceStore.getState().announce(t('video.createBoardSuccess'));
      navigate(`/board/${board._id}`);
    } catch {
      setCreateBoardError(t('video.createBoardError'));
      setCreatingBoard(false);
    }
  };

  // ── Trimmen (Player-seitig, siehe Dateikopf-Kommentar) ──
  const setTrimStartHere = () => onUpdate({ trimStart: videoRef.current?.currentTime ?? 0 });
  const setTrimEndHere = () => onUpdate({ trimEnd: videoRef.current?.currentTime ?? 0 });
  const resetTrim = () => onUpdate({ trimStart: null, trimEnd: null });

  const handleLoadedMetadata = () => {
    if (typeof video.trimStart === 'number' && videoRef.current) {
      videoRef.current.currentTime = video.trimStart;
    }
  };
  const handleTimeUpdate = () => {
    if (typeof video.trimEnd === 'number' && videoRef.current && videoRef.current.currentTime >= video.trimEnd) {
      videoRef.current.pause();
      videoRef.current.currentTime = video.trimStart ?? 0;
    }
  };

  // ── Szenen-Marken ──
  const handleAddMarker = async () => {
    const timestamp = videoRef.current?.currentTime ?? 0;
    const label = markerLabel.trim() || formatTime(timestamp);
    const markers = [...(video.markers ?? []), { timestamp, label }].sort((a, b) => a.timestamp - b.timestamp);
    await onUpdate({ markers });
    setMarkerLabel('');
    setAddingMarker(false);
  };

  const handleDeleteMarker = (timestamp) => {
    onUpdate({ markers: (video.markers ?? []).filter((m) => m.timestamp !== timestamp) });
  };

  const seekTo = (timestamp) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = timestamp;
    videoRef.current.play();
  };

  // ── Ereignis-Verknüpfung (Phase 6, optional) ──
  useEffect(() => {
    onSeekReady?.(video._id, seekTo);
  }, [video._id, onSeekReady]);

  const handleLinkEvent = async () => {
    if (!selectedEventId) return;
    setLinking(true);
    try {
      await onLinkEvent(selectedEventId, videoRef.current?.currentTime ?? 0);
      setSelectedEventId('');
    } finally {
      setLinking(false);
    }
  };

  const linkedEvents = (linkableEvents ?? []).filter((e) => e.videoId === video._id);
  const unlinkedEvents = (linkableEvents ?? []).filter((e) => e.videoId !== video._id);

  const hasOverlayElements = (video.elements ?? []).length > 0;
  const showStage = (drawMode || (showOverlay && hasOverlayElements)) && size.width > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.playerWrap} ref={containerRef}>
        <video
          ref={videoRef}
          className={styles.player}
          controls={!drawMode}
          preload="metadata"
          src={streamUrl}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        >
          {t('video.notSupported')}
        </video>

        {showStage && (
          <Stage
            className={`${styles.stage} ${drawMode ? styles.stageActive : ''}`}
            width={size.width}
            height={size.height}
            listening={drawMode}
          >
            <DrawingLayer
              elements={drawMode ? drawing.elements : (video.elements ?? [])}
              scale={1}
              offsetX={0}
              offsetY={0}
              fieldW={size.width}
              fieldH={size.height}
              selectedId={drawMode ? drawing.selectedId : null}
              activeTool={drawMode ? drawing.activeTool : 'select'}
              isDrawing={drawMode ? drawing.isDrawing : false}
              onPointerDown={drawing.handlePointerDown}
              onPointerMove={drawing.handlePointerMove}
              onPointerUp={drawing.handlePointerUp}
              onElementClick={drawing.handleElementClick}
              readonly={!drawMode}
            />
          </Stage>
        )}
      </div>

      {canEdit && (
        <div className={styles.actions}>
          {drawMode ? (
            <>
              <DrawingToolbar
                activeTool={drawing.activeTool}
                setActiveTool={drawing.setActiveTool}
                activeColor={drawing.activeColor}
                setActiveColor={drawing.setActiveColor}
                strokeWidth={drawing.strokeWidth}
                setStrokeWidth={drawing.setStrokeWidth}
                onUndo={drawing.undo}
                onRedo={drawing.redo}
                onClear={drawing.clearAll}
                canUndo={drawing.canUndo}
                canRedo={drawing.canRedo}
                elementCount={drawing.elements.length}
                undoStack={drawing.undoStack}
                redoStack={drawing.redoStack}
                onJumpHistory={drawing.jumpHistory}
                hideTools={['winkel', 'rebound', 'konter', 'komm']}
              />
              <div className={styles.drawModeActions}>
                <Button variant="primary" size="sm" onClick={handleSaveDrawing} disabled={saving}>
                  {saving ? t('video.saving') : t('video.saveDrawing')}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setDrawMode(false)} disabled={saving}>
                  {t('video.cancel')}
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.toolRow}>
              <Button variant="secondary" size="sm" onClick={enterDrawMode}>
                <Pencil size={16} aria-hidden="true" /> {t('video.draw')}
              </Button>
              {hasOverlayElements && (
                <Button variant="secondary" size="sm" onClick={() => setShowOverlay((v) => !v)}>
                  {showOverlay ? <><Eye size={16} aria-hidden="true" /> {t('video.hideOverlay')}</> : <><EyeOff size={16} aria-hidden="true" /> {t('video.showOverlay')}</>}
                </Button>
              )}
              {hasOverlayElements && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCreateBoardFromDrawing}
                  disabled={creatingBoard}
                  aria-label={t('video.createBoardAriaLabel')}
                >
                  <LayoutTemplate size={16} aria-hidden="true" /> {creatingBoard ? t('video.creatingBoard') : t('video.createBoard')}
                </Button>
              )}
            </div>
          )}
          {createBoardError && (
            <p className={styles.errorMsg} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {createBoardError}</p>
          )}
        </div>
      )}

      {canEdit && (
        <div className={styles.trimRow}>
          <span className={styles.trimLabel}>{t('video.trimLabel')}</span>
          <Button variant="secondary" size="sm" onClick={setTrimStartHere}>{t('video.setStart')}</Button>
          <Button variant="secondary" size="sm" onClick={setTrimEndHere}>{t('video.setEnd')}</Button>
          {(typeof video.trimStart === 'number' || typeof video.trimEnd === 'number') && (
            <>
              <span className={styles.trimValues}>
                {formatTime(video.trimStart ?? 0)} – {typeof video.trimEnd === 'number' ? formatTime(video.trimEnd) : '…'}
              </span>
              <Button variant="secondary" size="sm" onClick={resetTrim}>{t('video.resetTrim')}</Button>
            </>
          )}
        </div>
      )}

      <div className={styles.markersSection}>
        {(video.markers ?? []).length > 0 && (
          <ul className={styles.markerList} role="list">
            {video.markers.map((m, i) => (
              <li key={`${m.timestamp}-${i}`} className={styles.markerItem}>
                <Button variant="secondary" size="sm" className={styles.markerBtn} onClick={() => seekTo(m.timestamp)}>
                  {formatTime(m.timestamp)} – {m.label}
                </Button>
                {canEdit && (
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    className={styles.markerDeleteBtn}
                    onClick={() => handleDeleteMarker(m.timestamp)}
                    aria-label={t('video.deleteMarkerAriaLabel', { label: m.label })}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          addingMarker ? (
            <div className={styles.markerAddRow}>
              <input
                type="text"
                className={styles.markerInput}
                value={markerLabel}
                onChange={(e) => setMarkerLabel(e.target.value)}
                placeholder={t('video.markerPlaceholder')}
                maxLength={60}
              />
              <Button variant="secondary" size="sm" onClick={handleAddMarker}>{t('video.addMarkerConfirm')}</Button>
              <Button variant="secondary" size="sm" onClick={() => { setAddingMarker(false); setMarkerLabel(''); }}>{t('video.cancel')}</Button>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setAddingMarker(true)}>
              <MapPin size={16} aria-hidden="true" /> {t('video.addMarker')}
            </Button>
          )
        )}
      </div>

      {linkableEvents != null && (
        <div className={styles.markersSection}>
          {linkedEvents.length > 0 && (
            <ul className={styles.markerList} role="list">
              {linkedEvents.map((evt) => (
                <li key={evt._id} className={styles.markerItem}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.markerBtn}
                    onClick={() => seekTo(evt.videoTimestampSeconds ?? 0)}
                  >
                    {formatTime(evt.videoTimestampSeconds ?? 0)} – {evt.label}
                  </Button>
                  {canEdit && (
                    <Button
                      variant="danger"
                      size="sm"
                      iconOnly
                      className={styles.markerDeleteBtn}
                      onClick={() => onUnlinkEvent(evt._id)}
                      aria-label={t('video.unlinkEventAriaLabel', { label: evt.label })}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && unlinkedEvents.length > 0 && (
            <div className={styles.markerAddRow}>
              <select
                className={styles.markerInput}
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                aria-label={t('video.linkEventSelectAriaLabel')}
              >
                <option value="">{t('video.linkEventPlaceholder')}</option>
                {unlinkedEvents.map((evt) => (
                  <option key={evt._id} value={evt._id}>{evt.label}</option>
                ))}
              </select>
              <Button variant="secondary" size="sm" onClick={handleLinkEvent} disabled={!selectedEventId || linking}>
                <MapPin size={16} aria-hidden="true" /> {t('video.linkEventConfirm')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
