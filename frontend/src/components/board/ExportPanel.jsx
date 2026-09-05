/**
 * ExportPanel – GIF-Export UI
 * Issue #15 – v0.5.0
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useExport } from '../../hooks/useExport.js';
import { useShare } from '../../hooks/useShare.js';
import { getIntlLocale } from '../../utils/formatDate.js';
import Button from '../common/Button.jsx';
import styles from './ExportPanel.module.css';

// Web-Share-API: nur Feature-Detection auf Funktionsebene – ob Dateien
// tatsächlich teilbar sind, entscheidet erst navigator.canShare({ files })
// zur Klick-Zeit (browserabhängig, v.a. mobile Chrome/Safari; Desktop-
// Firefox z.B. unterstützt Datei-Sharing i.d.R. nicht). Fällt der Check
// negativ aus oder ist die API gar nicht vorhanden, bleibt der normale
// Download-Link als Fallback ohnehin immer sichtbar.
const CAN_USE_SHARE_API = typeof navigator !== 'undefined'
  && typeof navigator.share === 'function'
  && typeof navigator.canShare === 'function';

const FPS_OPTIONS    = [1, 2, 3, 4, 5, 8, 10];
const WIDTH_OPTIONS  = [
  { value: 480,  label: '480p',  standard: false },
  { value: 720,  label: '720p',  standard: true  },
  { value: 1280, label: '1080p', standard: false },
];

function formatExpiry(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(getIntlLocale(), { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ExportPanel({ boardId, frames, activeFrame, renderFrame }) {
  const { t } = useTranslation();
  const [format, setFormat] = useState('gif');
  const [fps,   setFps  ] = useState(4);
  const [width, setWidth] = useState(720);
  const [loop,  setLoop ] = useState(true);
  const [watermark, setWatermark] = useState(true);

  const { status, progress, fileUrl, error, startExport, reset } = useExport();
  const [sharing,      setSharing     ] = useState(false);
  const [shareFileErr, setShareFileErr] = useState(null);

  // Issue #16 – Share-Link
  const share = useShare(boardId);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [copied,    setCopied   ] = useState(false);

  const handleCreateShareLink = async () => {
    setCopied(false);
    try {
      const { url } = await share.createShareLink();
      setQrDataUrl(await QRCode.toDataURL(url, { width: 240, margin: 1 }));
    } catch {
      // Fehler wird über share.error angezeigt
    }
  };

  const handleCopy = async () => {
    if (!share.shareUrl) return;
    try {
      await navigator.clipboard.writeText(share.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Zwischenablage evtl. ohne Berechtigung – Link steht trotzdem im Feld zum manuellen Kopieren
    }
  };

  // Einzel-Frame-Share (ROADMAP-Backlog) – teilt nur den aktuellen Frame
  const [frameCopied, setFrameCopied] = useState(false);

  const handleCreateFrameShare = async () => {
    if (!activeFrame) return;
    setFrameCopied(false);
    try {
      const image = await renderFrame(activeFrame);
      await share.createFrameShare(image);
    } catch {
      // Fehler wird über share.frameError angezeigt
    }
  };

  const handleCopyFrameLink = async () => {
    if (!share.frameShareUrl) return;
    try {
      await navigator.clipboard.writeText(share.frameShareUrl);
      setFrameCopied(true);
      setTimeout(() => setFrameCopied(false), 2000);
    } catch {
      // Zwischenablage evtl. ohne Berechtigung – Link steht trotzdem im Feld zum manuellen Kopieren
    }
  };

  const busy    = ['rendering', 'uploading', 'processing'].includes(status);
  const canExport = frames?.length >= 2 && !busy;

  const handleExport = () => {
    startExport({ frames, renderFrame, fps, width, loop, format, watermark });
  };

  // Teilt die fertige Export-Datei direkt über das native Teilen-Menü des
  // Geräts (u.a. WhatsApp), statt nur einen Download-Link anzubieten.
  const handleShareFile = async () => {
    if (!fileUrl) return;
    setShareFileErr(null);
    setSharing(true);
    try {
      const res = await fetch(fileUrl, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const filename = format === 'mp4' ? 'openfloorball.mp4' : 'openfloorball.gif';
      const mimeType = format === 'mp4' ? 'video/mp4' : 'image/gif';
      const file = new File([blob], filename, { type: mimeType });

      if (!navigator.canShare({ files: [file] })) {
        throw new Error(t('export.shareFileNotSupported'));
      }
      await navigator.share({ files: [file], title: 'OpenFloorball' });
    } catch (err) {
      if (err.name !== 'AbortError') { // Nutzer hat den Teilen-Dialog selbst abgebrochen – kein Fehler
        setShareFileErr(err.message);
      }
    } finally {
      setSharing(false);
    }
  };

  const statusLabel = {
    idle:       null,
    rendering:  t('export.rendering', { progress }),
    uploading:  t('export.uploading'),
    processing: t('export.processing', { progress }),
    done:       t('export.done'),
    error:      t('export.error', { error }),
  }[status];

  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>{t('export.title')}</h3>

      {frames?.length < 2 && (
        <p className={styles.hint}>{t('export.minFramesHint')}</p>
      )}

      <div className={styles.options}>
        <div className={styles.formatGroup} role="radiogroup" aria-label={t('export.formatLabel')}>
          <label className={styles.checkLabel}>
            <input
              type="radio"
              name="export-format"
              checked={format === 'gif'}
              onChange={() => setFormat('gif')}
              disabled={busy}
            />
            {t('export.formatGif')}
          </label>
          <label className={styles.checkLabel}>
            <input
              type="radio"
              name="export-format"
              checked={format === 'mp4'}
              onChange={() => setFormat('mp4')}
              disabled={busy}
            />
            {t('export.formatMp4')}
          </label>
        </div>

        <label className={styles.optLabel}>
          {t('export.fps')}
          <select
            className={styles.select}
            value={fps}
            onChange={(e) => setFps(Number(e.target.value))}
            disabled={busy}
          >
            {FPS_OPTIONS.map((f) => (
              <option key={f} value={f}>{f} fps</option>
            ))}
          </select>
        </label>

        <label className={styles.optLabel}>
          {t('export.resolution')}
          <select
            className={styles.select}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            disabled={busy}
          >
            {WIDTH_OPTIONS.map(({ value, label, standard }) => (
              <option key={value} value={value}>{label}{standard ? ` (${t('export.standard')})` : ''}</option>
            ))}
          </select>
        </label>

        {format === 'gif' ? (
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
              disabled={busy}
            />
            {t('export.loop')}
          </label>
        ) : (
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={watermark}
              onChange={(e) => setWatermark(e.target.checked)}
              disabled={busy}
            />
            {t('export.watermark')}
          </label>
        )}
      </div>

      {busy && (
        <div className={styles.progressBar} role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}

      {statusLabel && (
        <p className={`${styles.statusMsg} ${status === 'error' ? styles.statusError : ''}`}>
          {statusLabel}
        </p>
      )}

      {status === 'done' && shareFileErr && (
        <p className={`${styles.statusMsg} ${styles.statusError}`}>{t('export.error', { error: shareFileErr })}</p>
      )}

      <div className={styles.actions}>
        {status === 'done' ? (
          <>
            <a
              href={fileUrl}
              download={format === 'mp4' ? 'openfloorball.mp4' : 'openfloorball.gif'}
              className={styles.downloadBtn}
            >
              {format === 'mp4' ? t('export.downloadMp4') : t('export.download')}
            </a>
            {CAN_USE_SHARE_API && (
              <Button variant="secondary" size="sm" onClick={handleShareFile} disabled={sharing}>
                {sharing ? t('export.sharingFile') : t('export.shareFile')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => { reset(); setShareFileErr(null); }}>{t('export.exportAgain')}</Button>
          </>
        ) : (
          <Button
            variant="primary"
            size="md"
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={!canExport}
            aria-disabled={!canExport}
          >
            {busy ? t('export.exporting') : (format === 'mp4' ? t('export.createMp4') : t('export.create'))}
          </Button>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Issue #16 – Share-Link ohne Login */}
      <h3 className={styles.title}>{t('export.shareTitle')}</h3>
      <p className={styles.hint}>
        {t('export.shareHint')}
        {share.expiresAt && ` ${t('export.shareExpiry', { date: formatExpiry(share.expiresAt) })}`}
      </p>

      {share.error && (
        <p className={`${styles.statusMsg} ${styles.statusError}`}>{t('export.error', { error: share.error })}</p>
      )}

      {share.shareUrl ? (
        <>
          <div className={styles.shareRow}>
            <input
              type="text"
              readOnly
              value={share.shareUrl}
              className={styles.urlInput}
              onFocus={(e) => e.target.select()}
              aria-label={t('export.shareLinkAriaLabel')}
            />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? t('export.copied') : t('export.copy')}
            </Button>
          </div>
          {qrDataUrl && (
            <div className={styles.qrWrap}>
              <img src={qrDataUrl} alt={t('export.qrAlt')} />
            </div>
          )}
          <Button variant="secondary" size="sm" onClick={() => { share.reset(); setQrDataUrl(null); }}>
            {t('export.newLink')}
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          size="md"
          className={styles.exportBtn}
          onClick={handleCreateShareLink}
          disabled={share.loading || !frames?.length}
        >
          {share.loading ? t('export.creating') : t('export.createLink')}
        </Button>
      )}

      <hr className={styles.divider} />

      {/* Einzel-Frame-Share (ROADMAP-Backlog) */}
      <h3 className={styles.title}>{t('export.frameShareTitle')}</h3>
      <p className={styles.hint}>
        {t('export.frameShareHint')}
        {share.frameExpiresAt && ` ${t('export.shareExpiry', { date: formatExpiry(share.frameExpiresAt) })}`}
      </p>

      {share.frameError && (
        <p className={`${styles.statusMsg} ${styles.statusError}`}>{t('export.error', { error: share.frameError })}</p>
      )}

      {share.frameShareUrl ? (
        <>
          <div className={styles.shareRow}>
            <input
              type="text"
              readOnly
              value={share.frameShareUrl}
              className={styles.urlInput}
              onFocus={(e) => e.target.select()}
              aria-label={t('export.frameShareLinkAriaLabel')}
            />
            <Button variant="secondary" size="sm" onClick={handleCopyFrameLink}>
              {frameCopied ? t('export.copied') : t('export.copy')}
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={share.resetFrameShare}>
            {t('export.newFrameShare')}
          </Button>
        </>
      ) : (
        <Button
          variant="primary"
          size="md"
          className={styles.exportBtn}
          onClick={handleCreateFrameShare}
          disabled={share.frameLoading || !activeFrame}
        >
          {share.frameLoading ? t('export.creatingFrame') : t('export.createFrameShare')}
        </Button>
      )}
    </div>
  );
}
