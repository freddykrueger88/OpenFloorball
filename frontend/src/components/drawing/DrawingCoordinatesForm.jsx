/**
 * DrawingCoordinatesForm – Tastatur-Alternative zum Ziehen mit der Maus
 * (Issue #38 – WCAG 2.1.1 Keyboard). Nur sichtbar bei aktivem Zeichen-
 * Werkzeug (move/pass/shot/zone/freehand/winkel) – select/eraser/comment
 * sind reine Klick-Werkzeuge und nicht Teil dieses Formulars.
 *
 * "winkel" (Torwart-Winkel, CLAUDE.md §9.7): spezielles ein-Punkt-
 * Formular + Tor-Auswahl + Positionierungs-Voreinstellungen statt des
 * generischen Zwei-Punkte-Formulars.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import Button from '../common/Button.jsx';
import { getKeeperStancePresets } from '../../utils/angleMath.js';
import { KOMM_PHRASES, KOMM_DEFAULT_PHRASE_KEY } from '../../constants/drawingConfig.js';
import styles from './DrawingCoordinatesForm.module.css';

// 'zone' zeichnet kein Pfeil, sondern ein Rechteck – teilt sich aber
// dasselbe Zwei-Punkte-Formular (x1/y1/x2/y2), da useDrawing.js beide
// über denselben generischen addArrowElement()-Pfad anlegt (siehe dort).
const ARROW_TOOLS = ['move', 'pass', 'shot', 'zone'];

const GOAL_SIDES = [
  { value: 'auto',  key: 'drawing.winkelGoalAuto'  },
  { value: 'left',  key: 'drawing.winkelGoalLeft'  },
  { value: 'right', key: 'drawing.winkelGoalRight' },
];

// Gemeinsamer Ziel-Tor-Selektor für alle tor-verankerten Torhüter-Werkzeuge
// (Winkel/Rebound/Konter, CLAUDE.md §9.7) – 'auto' = nächstgelegenes Tor.
function GoalSidePicker({ value, onChange }) {
  const { t } = useTranslation();
  return (
    <div className={styles.row} role="radiogroup" aria-label={t('drawing.winkelGoalSide')}>
      {GOAL_SIDES.map(({ value: v, key }) => (
        <button
          key={v}
          type="button"
          className={`${styles.toolBtn} ${value === v ? styles.active : ''}`}
          onClick={() => onChange(v)}
          aria-checked={value === v}
          role="radio"
        >
          {t(key)}
        </button>
      ))}
    </div>
  );
}

// Gemeinsames Ein-Punkt-Formular für tor-verankerte Torhüter-Werkzeuge:
// fragt genau einen Punkt ab (Tiefen-/Anspiel-/Scheitelpunkt), die
// Startgeometrie (Torpfosten/Torlinie) wird im Renderer abgeleitet.
function KeeperPointForm({ maxX, maxY, onSubmit, submitLabel, hintKey }) {
  const { t } = useTranslation();
  const [x, setX] = useState('');
  const [y, setY] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const nx = parseFloat(x), ny = parseFloat(y);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return;
    onSubmit(nx, ny);
    setX(''); setY('');
  };

  return (
    <>
      {hintKey && <p className={styles.hint}>{t(hintKey)}</p>}
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.row}>
          <label className={styles.field} htmlFor="coord-keeper-x">
            {t('drawing.freehandPointX')}
            <input id="coord-keeper-x" type="number" step="0.1" min={0} max={maxX} value={x} onChange={(e) => setX(e.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="coord-keeper-y">
            {t('drawing.freehandPointY')}
            <input id="coord-keeper-y" type="number" step="0.1" min={0} max={maxY} value={y} onChange={(e) => setY(e.target.value)} required />
          </label>
        </div>
        <Button type="submit" variant="primary" size="md">
          {t(submitLabel)}
        </Button>
      </form>
    </>
  );
}

export default function DrawingCoordinatesForm({ activeTool, field, onAddArrow, onAddFreehand, winkelGoalSide = 'auto', setWinkelGoalSide }) {
  const { t } = useTranslation();
  const maxX = field?.width ?? 40;
  const maxY = field?.height ?? 20;

  const [x1, setX1] = useState('');
  const [y1, setY1] = useState('');
  const [x2, setX2] = useState('');
  const [y2, setY2] = useState('');

  const [points, setPoints] = useState([]);
  const [pointX, setPointX] = useState('');
  const [pointY, setPointY] = useState('');

  // Torwart-Kommunikation: gewählte Phrase (LabelKey) – beim Anlegen wird
  // der übersetzte Text ins Element eingebrannt (el.text).
  const [kommPhraseKey, setKommPhraseKey] = useState(KOMM_DEFAULT_PHRASE_KEY);

  const isGoalkeeperTool = activeTool === 'winkel' || activeTool === 'rebound' || activeTool === 'konter' || activeTool === 'komm';

  if (!isGoalkeeperTool && !ARROW_TOOLS.includes(activeTool) && activeTool !== 'freehand') return null;

  const handleAddArrow = (e) => {
    e.preventDefault();
    const nx1 = parseFloat(x1), ny1 = parseFloat(y1), nx2 = parseFloat(x2), ny2 = parseFloat(y2);
    if ([nx1, ny1, nx2, ny2].some(Number.isNaN)) return;
    onAddArrow(activeTool, nx1, ny1, nx2, ny2);
    setX1(''); setY1(''); setX2(''); setY2('');
  };

  const handleAddPoint = (e) => {
    e.preventDefault();
    const nx = parseFloat(pointX), ny = parseFloat(pointY);
    if (Number.isNaN(nx) || Number.isNaN(ny)) return;
    setPoints((prev) => [...prev, [nx, ny]]);
    setPointX(''); setPointY('');
  };

  const handleRemovePoint = (index) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveFreehand = () => {
    if (points.length < 2) return;
    onAddFreehand(points.flat());
    setPoints([]);
  };

  // ── Torhüter-Werkzeuge (§9.7) ─────────────────────────────────────────
  if (isGoalkeeperTool) {
    const presetsLeft  = field ? getKeeperStancePresets(field, 'left')  : [];
    const presetsRight = field ? getKeeperStancePresets(field, 'right') : [];

    const handleWinkelApex = (nx, ny) => {
      onAddArrow('winkel', nx, ny, nx, ny);
    };

    const handleRebound = (nx, ny) => {
      // x1/y1-slot bleibt unbenutzt (tor-verankert), nur die Tiefe zählt
      onAddArrow('rebound', nx, ny, nx, ny);
    };

    const handleKonter = (nx, ny) => {
      // Anker = Torwart (Torlinien-Mitte) wird im Renderer abgeleitet –
      // gespeichert wird nur der Anspielpunkt (x2/y2).
      onAddArrow('konter', nx, ny, nx, ny);
    };

    const handleKomm = (nx, ny) => {
      // Phrase gewählter LabelKey → übersetzten Text ins Element einbrennen
      // (extra-Feld; der Offline-Export rendert die Blase ohne i18n).
      const phrase = KOMM_PHRASES.find((p) => p.key === kommPhraseKey) ?? KOMM_PHRASES[0];
      onAddArrow('komm', nx, ny, nx, ny, undefined, { text: t(phrase.labelKey) });
    };

    const handlePreset = (side, preset) => {
      if (!setWinkelGoalSide) return;
      // Preset-Element mit explizitem goalSide anlegen (kein 'auto' –
      // die Tatsache, dass ein Tor-Preset gewählt wurde, fließt mit ein)
      onAddArrow('winkel', preset.x, preset.y, preset.x, preset.y, side);
    };

    // Titel pro Werkzeug
    const sectionTitle = activeTool === 'winkel' ? 'drawing.winkelGoalSide'
      : activeTool === 'rebound' ? 'drawing.reboundGoalSide'
      : activeTool === 'konter' ? 'drawing.konterGoalSide'
      : 'drawing.kommGoalSide';

    return (
      <section className={styles.panel} aria-label={t('drawing.coordinatesTitle')}>
        {/* Tor-Auswahl */}
        <h3 className={styles.title}>{t(sectionTitle)}</h3>
        <GoalSidePicker value={winkelGoalSide} onChange={setWinkelGoalSide} />

        {/* Positionierungs-Presets (§9.7 "Positionierung" + "Verschiebung") –
            nur beim Winkel; Rebound/Konter nutzen das einfache ein-Punkt-
            Formular darunter. */}
        {activeTool === 'winkel' && field && (
          <>
            <h3 className={styles.title}>{t('drawing.winkelStanceTitle')}</h3>
            {['left', 'right'].map((side) => (
              <div key={side} className={styles.row} role="group" aria-label={side === 'left' ? t('drawing.winkelGoalLeft') : t('drawing.winkelGoalRight')}>
                {((side === 'left' ? presetsLeft : presetsRight)).map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => handlePreset(side, preset)}
                    aria-label={`${t(side === 'left' ? 'drawing.winkelGoalLeft' : 'drawing.winkelGoalRight')}: ${t(`drawing.winkelStance.${preset.id}`)}`}
                  >
                    {t(`drawing.winkelStance.${preset.id}`)}
                  </Button>
                ))}
              </div>
            ))}
          </>
        )}

        {activeTool === 'winkel' && (
          <KeeperPointForm
            maxX={maxX} maxY={maxY}
            onSubmit={handleWinkelApex}
            submitLabel="drawing.addArrow"
            hintKey="drawing.winkelHint"
          />
        )}
        {activeTool === 'rebound' && (
          <KeeperPointForm
            maxX={maxX} maxY={maxY}
            onSubmit={handleRebound}
            submitLabel="drawing.addRebound"
            hintKey="drawing.reboundHint"
          />
        )}
        {activeTool === 'konter' && (
          <KeeperPointForm
            maxX={maxX} maxY={maxY}
            onSubmit={handleKonter}
            submitLabel="drawing.addKonter"
            hintKey="drawing.konterHint"
          />
        )}
        {activeTool === 'komm' && (
          <>
            <h3 className={styles.title}>{t('drawing.kommPhraseTitle')}</h3>
            <div className={styles.row} role="radiogroup" aria-label={t('drawing.kommPhraseTitle')}>
              {/* Kommando-Phrasen: LabelKey-Buttons, der übersetzte Text
                  wird beim Anlegen eingebrannt (siehe handleKomm). */}
              {KOMM_PHRASES.map(({ key, labelKey }) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.toolBtn} ${kommPhraseKey === key ? styles.active : ''}`}
                  onClick={() => setKommPhraseKey(key)}
                  aria-pressed={kommPhraseKey === key}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
            <KeeperPointForm
              maxX={maxX} maxY={maxY}
              onSubmit={handleKomm}
              submitLabel="drawing.addKomm"
              hintKey="drawing.kommHint"
            />
          </>
        )}
      </section>
    );
  }

  // ── Freehand ──────────────────────────────────────────────────────────
  if (activeTool === 'freehand') {
    return (
      <section className={styles.panel} aria-label={t('drawing.coordinatesTitle')}>
        <h3 className={styles.title}>{t('drawing.coordinatesTitle')}</h3>
        <p className={styles.hint}>{t('drawing.coordinatesHint')}</p>
        <div className={styles.form}>
          {points.length > 0 && (
            <ul className={styles.pointList} aria-label={t('drawing.pointList')}>
              {points.map(([px, py], i) => (
                <li key={i} className={styles.pointItem}>
                  <span>{px.toFixed(1)} / {py.toFixed(1)}</span>
                  <Button type="button" variant="danger" size="sm" iconOnly onClick={() => handleRemovePoint(i)} aria-label={t('drawing.removePoint')}>
                    <X size={16} aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <form className={styles.row} onSubmit={handleAddPoint}>
            <label className={styles.field} htmlFor="coord-point-x">
              {t('drawing.freehandPointX')}
              <input id="coord-point-x" type="number" step="0.1" min={0} max={maxX} value={pointX} onChange={(e) => setPointX(e.target.value)} required />
            </label>
            <label className={styles.field} htmlFor="coord-point-y">
              {t('drawing.freehandPointY')}
              <input id="coord-point-y" type="number" step="0.1" min={0} max={maxY} value={pointY} onChange={(e) => setPointY(e.target.value)} required />
            </label>
            <Button type="submit" variant="secondary" size="md">{t('drawing.addPoint')}</Button>
          </form>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSaveFreehand}
            disabled={points.length < 2}
          >
            {t('drawing.saveFreehand')}
          </Button>
        </div>
      </section>
    );
  }

  // ── Pfeile / Zone (Zwei-Punkte-Formular) ─────────────────────────────
  return (
    <section className={styles.panel} aria-label={t('drawing.coordinatesTitle')}>
      <h3 className={styles.title}>{t('drawing.coordinatesTitle')}</h3>
      <p className={styles.hint}>{t('drawing.coordinatesHint')}</p>
      <form className={styles.form} onSubmit={handleAddArrow}>
        <div className={styles.row}>
          <label className={styles.field} htmlFor="coord-x1">
            {t('drawing.startX')}
            <input id="coord-x1" type="number" step="0.1" min={0} max={maxX} value={x1} onChange={(e) => setX1(e.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="coord-y1">
            {t('drawing.startY')}
            <input id="coord-y1" type="number" step="0.1" min={0} max={maxY} value={y1} onChange={(e) => setY1(e.target.value)} required />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field} htmlFor="coord-x2">
            {t('drawing.endX')}
            <input id="coord-x2" type="number" step="0.1" min={0} max={maxX} value={x2} onChange={(e) => setX2(e.target.value)} required />
          </label>
          <label className={styles.field} htmlFor="coord-y2">
            {t('drawing.endY')}
            <input id="coord-y2" type="number" step="0.1" min={0} max={maxY} value={y2} onChange={(e) => setY2(e.target.value)} required />
          </label>
        </div>
        <Button type="submit" variant="primary" size="md">
          {activeTool === 'zone' ? t('drawing.addZone') : t('drawing.addArrow')}
        </Button>
      </form>
    </section>
  );
}
