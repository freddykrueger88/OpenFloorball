/**
 * useAnimation – Frame-by-Frame Wiedergabe mit flüssiger Interpolation
 * (Issue #11 – v0.3.0)
 *
 * Interpoliert Spielerpositionen linear zwischen dem aktiven Frame und
 * dem nächsten Frame. Zeichen-Elemente (Pfeile/Linien) blenden hart
 * beim Frame-Wechsel ein/aus (kein Tweening, wie im Issue gefordert).
 *
 * Features:
 *   - Play / Pause / Stop
 *   - Geschwindigkeit: 0.5x, 1x, 2x, 3x
 *   - Loop
 *   - Tastaturkürzel: Leertaste = Play/Pause, ←/→ = Frame vor/zurück
 */
import { useState, useRef, useCallback, useEffect } from 'react';

const SPEEDS = [0.5, 1, 2, 3];
const MS_PER_FRAME_TRANSITION = 900; // Basisdauer einer Frame-zu-Frame Bewegung bei 1x

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Interpoliert eine Liste von Spielern anhand ihrer `id`
function interpolatePlayers(fromPlayers = [], toPlayers = [], t) {
  const toMap = new Map(toPlayers.map((p) => [p.id, p]));
  return fromPlayers.map((p) => {
    const target = toMap.get(p.id);
    if (!target) return p; // Spieler existiert im Ziel-Frame nicht → unverändert
    // Sichtbarkeit (Issue 025) wird wie Zeichen-Elemente hart auf den
    // Zielwert umgeschaltet statt über t interpoliert – ein Boolean lässt
    // sich nicht weich tweenen.
    return { ...p, x: lerp(p.x, target.x, t), y: lerp(p.y, target.y, t), visible: target.visible !== false };
  });
}

export function useAnimation({ frames = [], activeIndex = 0, goToFrame, loop: loopDefault = false, arrowKeysEnabled = true } = {}) {
  const [playing,       setPlaying]      = useState(false);
  const [speed,         setSpeed]        = useState(1);
  const [loop,          setLoop]         = useState(loopDefault);
  const [displayPlayers, setDisplayPlayers] = useState(frames[activeIndex]?.players ?? []);
  const [progress,      setProgress]     = useState(0); // 0..1 innerhalb des aktuellen Übergangs

  const rafRef       = useRef(null);
  const startTimeRef = useRef(null);
  const fromIndexRef = useRef(activeIndex);

  // Refs für Werte, die `tick` bei jedem rekursiven requestAnimationFrame-Aufruf
  // aktuell lesen muss (sonst läuft eine bereits gestartete Wiedergabe mit der
  // Closure/den Werten von damals weiter, z.B. Geschwindigkeitswechsel während
  // des Abspielens hätte sonst erst nach Stop/Replay eine Wirkung)
  const speedRef  = useRef(speed);  speedRef.current  = speed;
  const loopRef   = useRef(loop);   loopRef.current   = loop;
  const framesRef = useRef(frames); framesRef.current = frames;
  const goToFrameRef = useRef(goToFrame); goToFrameRef.current = goToFrame;

  // Wenn sich der aktive Frame von außen ändert (z.B. manuelle Auswahl), Anzeige synchronisieren
  useEffect(() => {
    if (!playing) {
      setDisplayPlayers(frames[activeIndex]?.players ?? []);
      setProgress(0);
      fromIndexRef.current = activeIndex;
    }
  }, [activeIndex, frames, playing]);

  const stop = useCallback(() => {
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;
    goToFrame?.(0);
    setDisplayPlayers(frames[0]?.players ?? []);
    setProgress(0);
  }, [frames, goToFrame]);

  const pause = useCallback(() => {
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    startTimeRef.current = null;
  }, []);

  const tick = useCallback((timestamp) => {
    if (startTimeRef.current === null) startTimeRef.current = timestamp;
    const elapsed  = timestamp - startTimeRef.current;
    const duration = MS_PER_FRAME_TRANSITION / speedRef.current;
    const t = Math.min(1, elapsed / duration);

    const frames  = framesRef.current;
    const goToFrame = goToFrameRef.current;
    const fromIdx = fromIndexRef.current;
    const toIdx   = fromIdx + 1;
    const fromFrame = frames[fromIdx];
    const toFrame   = frames[toIdx];

    if (toFrame) {
      setDisplayPlayers(interpolatePlayers(fromFrame?.players, toFrame.players, t));
      setProgress(t);
    }

    if (t >= 1) {
      if (toFrame) {
        fromIndexRef.current = toIdx;
        goToFrame?.(toIdx);
        startTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
      } else if (loopRef.current) {
        fromIndexRef.current = 0;
        goToFrame?.(0);
        setDisplayPlayers(frames[0]?.players ?? []);
        startTimeRef.current = timestamp;
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
        startTimeRef.current = null;
      }
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const play = useCallback(() => {
    if (frames.length < 2) return; // Nichts zu animieren
    // Wenn wir am letzten Frame stehen, von vorne beginnen
    fromIndexRef.current = activeIndex >= frames.length - 1 ? 0 : activeIndex;
    if (fromIndexRef.current !== activeIndex) goToFrame?.(fromIndexRef.current);
    startTimeRef.current = null;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [frames.length, activeIndex, goToFrame, tick]);

  const togglePlay = useCallback(() => {
    playing ? pause() : play();
  }, [playing, pause, play]);

  const cycleSpeed = useCallback(() => {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  }, []);

  // Aufräumen
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Tastaturkürzel
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight' && !playing && arrowKeysEnabled) {
        goToFrame?.(Math.min(activeIndex + 1, frames.length - 1));
      } else if (e.code === 'ArrowLeft' && !playing && arrowKeysEnabled) {
        goToFrame?.(Math.max(activeIndex - 1, 0));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, goToFrame, activeIndex, frames.length, playing, arrowKeysEnabled]);

  return {
    playing,
    speed, setSpeed, cycleSpeed, speeds: SPEEDS,
    loop, setLoop,
    progress,
    displayPlayers: playing ? displayPlayers : (frames[activeIndex]?.players ?? []),
    play, pause, stop, togglePlay,
    canPlay: frames.length >= 2,
  };
}
