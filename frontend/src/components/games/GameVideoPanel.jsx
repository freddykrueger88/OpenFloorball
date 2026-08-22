/**
 * GameVideoPanel – Video-Integration Phase 6 (Statistik-Architektur,
 * ADR-0005). Upload + Liste von Spielvideos, strukturell identisch zu
 * VideoPanel.jsx (Board-Videos) – nutzt bewusst dieselbe
 * VideoAnnotationOverlay.jsx (Zeichnen/Trimmen/Marken) UND dasselbe
 * CSS-Modul (VideoPanel.module.css ist generisch, keine Board-spezifischen
 * Klassennamen).
 *
 * Zusätzlich zu Board-Videos: game_events lassen sich mit einer
 * Videoposition verknüpfen (linkableEvents/onLinkEvent/onUnlinkEvent,
 * siehe VideoAnnotationOverlay), und die Zeitleiste in GamePage.jsx kann
 * über registerJump von einem Ereignis aus zur passenden Videoposition
 * springen (seekFns-Registry unten, gefüllt über onSeekReady).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useGameVideos } from '../../hooks/useGameVideos.js';
import VideoAnnotationOverlay from '../board/VideoAnnotationOverlay.jsx';
import { DEFAULT_TEAM_COLORS } from '../../constants/fieldConfig.js';
import Button from '../common/Button.jsx';
import styles from '../board/VideoPanel.module.css';

const MAX_VIDEOS = 5;
// Video-Zeichnung → Taktik-Board (siehe VideoAnnotationOverlay) braucht
// einen Feldtyp/Teamfarben-Kontext – ein Spiel hat (anders als ein Board)
// keinen eigenen, daher sinnvolle Standardwerte statt diese Funktion
// wegzulassen.
const DEFAULT_FIELD_TYPE = 'large';
const DEFAULT_BALL_COLOR = '#f97316';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GameVideoPanel({ gameId, canEdit, linkableEvents, onLinkEvent, onUnlinkEvent, registerJump }) {
  const { t } = useTranslation();
  const { videos, loading, uploading, error, fetchVideos, uploadVideo, updateVideo, deleteVideo, streamUrl } = useGameVideos(gameId);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef(null);
  const seekFns = useRef({});

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  useEffect(() => {
    if (!registerJump) return;
    registerJump((videoId, timestamp) => {
      seekFns.current[videoId]?.(timestamp);
      document.getElementById(`game-video-${videoId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [registerJump]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadVideo(file, title.trim() || null);
      setTitle('');
    } catch {
      // Fehler wird über `error` angezeigt
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t('games.videoPanelTitle')}</h3>
      <p className={styles.hint}>{t('games.videoPanelHint')}</p>

      {error && <p className={styles.errorMsg} role="alert"><AlertTriangle size={16} aria-hidden="true" /> {error}</p>}

      {canEdit && (
        <div className={styles.uploadRow}>
          <input
            type="text"
            className={styles.titleInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('video.titlePlaceholder')}
            maxLength={80}
            disabled={uploading || videos.length >= MAX_VIDEOS}
            aria-label={t('video.titlePlaceholder')}
          />
          <label className={styles.uploadBtn}>
            {uploading ? t('video.uploading') : t('video.upload')}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              disabled={uploading || videos.length >= MAX_VIDEOS}
              className={styles.fileInput}
            />
          </label>
        </div>
      )}
      {videos.length >= MAX_VIDEOS && (
        <p className={styles.hint}>{t('video.maxReached', { max: MAX_VIDEOS })}</p>
      )}

      {loading && videos.length === 0 ? (
        <p className={styles.hint}>{t('video.loading')}</p>
      ) : videos.length === 0 ? (
        <p className={styles.hint}>{t('games.videoPanelEmpty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {videos.map((v) => (
            <li key={v._id} id={`game-video-${v._id}`} className={styles.item}>
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{v.title || v.filename}</span>
                <span className={styles.itemMeta}>{formatSize(v.sizeBytes)}</span>
                {canEdit && (
                  <Button
                    variant="danger"
                    size="sm"
                    iconOnly
                    className={styles.deleteBtn}
                    onClick={() => deleteVideo(v._id)}
                    aria-label={t('video.deleteAriaLabel', { title: v.title || v.filename })}
                    title={t('video.delete')}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                )}
              </div>
              <VideoAnnotationOverlay
                video={v}
                canEdit={canEdit}
                streamUrl={streamUrl(v._id)}
                onUpdate={(patch) => updateVideo(v._id, patch)}
                fieldType={DEFAULT_FIELD_TYPE}
                homeColor={DEFAULT_TEAM_COLORS.home.fill}
                awayColor={DEFAULT_TEAM_COLORS.away.fill}
                ballColor={DEFAULT_BALL_COLOR}
                linkableEvents={linkableEvents}
                onLinkEvent={(eventId, timestamp) => onLinkEvent(eventId, v._id, timestamp)}
                onUnlinkEvent={onUnlinkEvent}
                onSeekReady={(videoId, seekFn) => { seekFns.current[videoId] = seekFn; }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
