/**
 * VideoPanel – Video-Integration (ROADMAP-Backlog)
 *
 * Upload + Liste, pro Video übernimmt VideoAnnotationOverlay.jsx den
 * Player samt Zeichnen-Überlagerung/Trimmen/Szenen-Marken.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useVideos } from '../../hooks/useVideos.js';
import VideoAnnotationOverlay from './VideoAnnotationOverlay.jsx';
import Button from '../common/Button.jsx';
import styles from './VideoPanel.module.css';

const MAX_VIDEOS = 5;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function VideoPanel({ boardId, canEdit, fieldType, homeColor, awayColor, ballColor }) {
  const { t } = useTranslation();
  const { videos, loading, uploading, error, fetchVideos, uploadVideo, updateVideo, deleteVideo, streamUrl } = useVideos(boardId);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

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
      <h3 className={styles.title}>{t('video.title')}</h3>
      <p className={styles.hint}>{t('video.hint')}</p>

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
        <p className={styles.hint}>{t('video.empty')}</p>
      ) : (
        <ul className={styles.list} role="list">
          {videos.map((v) => (
            <li key={v._id} className={styles.item}>
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
                fieldType={fieldType}
                homeColor={homeColor}
                awayColor={awayColor}
                ballColor={ballColor}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
