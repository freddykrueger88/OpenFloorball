/**
 * ConfettiOverlay – kleines, abhängigkeitsfreies Konfetti-Feuerwerk
 * (Canvas, keine Library) für den Geburtstags-Klick-Gimmick im
 * Dashboard. Rein dekorativ, `pointer-events: none`, räumt sich nach
 * DURATION_MS selbst auf (ruft `onDone`). Respektiert
 * prefers-reduced-motion (CLAUDE.md §16 Accessibility First) – zeigt in
 * dem Fall gar keine Animation, nur eine kurze Text-Ansage per LiveRegion
 * (übernimmt der aufrufende BirthdayCard).
 */
import { useEffect, useRef } from 'react';

const DURATION_MS = 3000;
const PARTICLE_COUNT = 140;
const COLORS = ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#f472b6', '#a78bfa'];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function ConfettiOverlay({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      const timer = setTimeout(() => onDone?.(), 600);
      return () => clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * width,
      y: -20 - Math.random() * height * 0.5,
      size: 6 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      speedY: 2 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    }));

    let rafId;
    const start = window.performance.now();

    function tick(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        p.rotation += p.rotationSpeed;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (elapsed < DURATION_MS) {
        rafId = requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    }
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: 'none' }}
    />
  );
}
