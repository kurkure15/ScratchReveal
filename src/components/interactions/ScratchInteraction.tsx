import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import confetti from 'canvas-confetti';
import { ScratchSoundEngine } from '../../utils/sounds';

interface ScratchInteractionProps {
  cardColor: string;
  onReveal: () => void;
  revealText: string;
  onClose?: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface GridTracker {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  scratched: Uint8Array;
  scratchedCount: number;
  totalCells: number;
}

interface SparkleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  decay: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

const GRID_COLS = 30;
const GRID_ROWS = 40;
const BRUSH_RADIUS = 21;
const BRUSH_DIAMETER = 42;
const SCRATCH_HINT_THRESHOLD = 0.6;
const SCRATCH_REVEAL_THRESHOLD = 0.75;
const HAPTIC_STEP_DISTANCE = 25;
const MAX_PARTICLES = 320;
const SPARKLE_COLORS = ['#FFFFFF', '#FFD700', '#C0C0C0', '#FFFACD'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function lightenColor(hex: string, amount: number): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return hex;
  }

  const value = Number.parseInt(normalized, 16);
  const r = clamp((value >> 16) + amount, 0, 255);
  const g = clamp(((value >> 8) & 0xff) + amount, 0, 255);
  const b = clamp((value & 0xff) + amount, 0, 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function playRevealTone() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();

    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 523.25;
    gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc1.connect(gain1).connect(audioCtx.destination);
    osc1.start(audioCtx.currentTime);
    osc1.stop(audioCtx.currentTime + 0.3);

    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 659.25;
    gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc2.connect(gain2).connect(audioCtx.destination);
    osc2.start(audioCtx.currentTime + 0.1);
    osc2.stop(audioCtx.currentTime + 0.4);
  } catch {
    // no-op if blocked
  }
}

export default function ScratchInteraction({
  cardColor,
  onReveal,
  revealText,
  onClose,
}: ScratchInteractionProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement>(null);
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const scratchCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const particleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  const isDrawingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const moveCounterRef = useRef(0);
  const hapticDistanceRef = useRef(0);
  const gridRef = useRef<GridTracker | null>(null);

  const particlesRef = useRef<SparkleParticle[]>([]);
  const particleRafRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);
  const revealTriggeredRef = useRef(false);
  const scratchAudioCtxRef = useRef<AudioContext | null>(null);
  const scratchSoundEngineRef = useRef<ScratchSoundEngine | null>(null);

  const [scratchOpacity, setScratchOpacity] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showCompletionLabel, setShowCompletionLabel] = useState(false);
  const [shaking, setShaking] = useState(false);

  const clearScheduledTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  const scheduleTimeout = useCallback((fn: () => void, ms: number) => {
    const timeoutId = window.setTimeout(fn, ms);
    timeoutIdsRef.current.push(timeoutId);
  }, []);

  const ensureScratchAudioContext = useCallback((): AudioContext | null => {
    try {
      if (scratchAudioCtxRef.current) {
        if (!scratchSoundEngineRef.current) {
          scratchSoundEngineRef.current = new ScratchSoundEngine(scratchAudioCtxRef.current);
        }
        return scratchAudioCtxRef.current;
      }

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      scratchAudioCtxRef.current = ctx;
      scratchSoundEngineRef.current = new ScratchSoundEngine(ctx);
      return ctx;
    } catch {
      return null;
    }
  }, []);

  const setupCanvas = useCallback((canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D | null => {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return null;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;

    return ctx;
  }, []);

  const drawMetalScratchSurface = useCallback(() => {
    const ctx = scratchCtxRef.current;
    if (!ctx) return;

    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);

    const metallicGradient = ctx.createLinearGradient(0, 0, width, height);
    metallicGradient.addColorStop(0, '#C0C0C0');
    metallicGradient.addColorStop(0.5, '#A8A8A8');
    metallicGradient.addColorStop(1, '#B8B8B8');
    ctx.fillStyle = metallicGradient;
    ctx.fillRect(0, 0, width, height);

    const dotCount = clamp(Math.floor((width * height) / 28), 3000, 5000);
    for (let i = 0; i < dotCount; i += 1) {
      const x = randomBetween(0, width);
      const y = randomBetween(0, height);
      const radius = randomBetween(0.5, 1.5);
      ctx.beginPath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.15)';
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 50; i += 1) {
      const y = randomBetween(0, height);
      const x = randomBetween(0, width * 0.15);
      const lineWidth = width - randomBetween(0, width * 0.18) - x;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, lineWidth, 1);
    }

    const sheen = ctx.createLinearGradient(0, 0, width, 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0.06)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    sheen.addColorStop(1, 'rgba(255,255,255,0.06)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.max(18, Math.floor(width * 0.08))}px "Manrope", sans-serif`;
    ctx.fillText('✦ ✦ ✦', width / 2, height / 2);
  }, []);

  const initGrid = useCallback((width: number, height: number) => {
    gridRef.current = {
      cols: GRID_COLS,
      rows: GRID_ROWS,
      cellWidth: width / GRID_COLS,
      cellHeight: height / GRID_ROWS,
      scratched: new Uint8Array(GRID_COLS * GRID_ROWS),
      scratchedCount: 0,
      totalCells: GRID_COLS * GRID_ROWS,
    };
  }, []);

  const getScratchPercent = useCallback((): number => {
    const grid = gridRef.current;
    if (!grid || grid.totalCells === 0) return 0;
    return grid.scratchedCount / grid.totalCells;
  }, []);

  const markCellsAtPoint = useCallback((x: number, y: number, radius: number) => {
    const grid = gridRef.current;
    if (!grid) return;

    const minCol = clamp(Math.floor((x - radius) / grid.cellWidth), 0, grid.cols - 1);
    const maxCol = clamp(Math.floor((x + radius) / grid.cellWidth), 0, grid.cols - 1);
    const minRow = clamp(Math.floor((y - radius) / grid.cellHeight), 0, grid.rows - 1);
    const maxRow = clamp(Math.floor((y + radius) / grid.cellHeight), 0, grid.rows - 1);

    const radiusSquared = radius * radius;

    for (let row = minRow; row <= maxRow; row += 1) {
      for (let col = minCol; col <= maxCol; col += 1) {
        const index = row * grid.cols + col;
        if (grid.scratched[index] === 1) continue;

        const cellX = col * grid.cellWidth;
        const cellY = row * grid.cellHeight;
        const closestX = clamp(x, cellX, cellX + grid.cellWidth);
        const closestY = clamp(y, cellY, cellY + grid.cellHeight);
        const dx = x - closestX;
        const dy = y - closestY;

        if (dx * dx + dy * dy <= radiusSquared) {
          grid.scratched[index] = 1;
          grid.scratchedCount += 1;
        }
      }
    }
  }, []);

  const drawSparkleStar = useCallback((ctx: CanvasRenderingContext2D, particle: SparkleParticle) => {
    ctx.save();
    ctx.translate(particle.x, particle.y);
    ctx.rotate((particle.rotation * Math.PI) / 180);
    ctx.globalAlpha = particle.opacity;
    ctx.fillStyle = particle.color;
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = particle.size * 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const radius = i % 2 === 0 ? particle.size : particle.size * 0.3;
      const angle = (i * Math.PI) / 4;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, []);

  const stopParticleLoop = useCallback(() => {
    if (particleRafRef.current !== null) {
      cancelAnimationFrame(particleRafRef.current);
      particleRafRef.current = null;
    }
  }, []);

  const startParticleLoop = useCallback(() => {
    if (particleRafRef.current !== null) return;

    const tick = () => {
      const ctx = particleCtxRef.current;
      const { width, height } = sizeRef.current;
      if (!ctx || width <= 0 || height <= 0) {
        particleRafRef.current = requestAnimationFrame(tick);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.opacity -= particle.decay;
        particle.rotation += particle.rotationSpeed;
        particle.vx *= 0.985;
        particle.vy += 0.05;

        if (particle.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        drawSparkleStar(ctx, particle);
      }

      if (isDrawingRef.current || particles.length > 0) {
        particleRafRef.current = requestAnimationFrame(tick);
      } else {
        particleRafRef.current = null;
      }
    };

    particleRafRef.current = requestAnimationFrame(tick);
  }, [drawSparkleStar]);

  const spawnParticlesAt = useCallback((x: number, y: number, count: number) => {
    for (let i = 0; i < count; i += 1) {
      particlesRef.current.push({
        x,
        y,
        vx: randomBetween(-2, 2),
        vy: randomBetween(-3, -0.5),
        size: randomBetween(1.5, 4),
        opacity: 1,
        decay: randomBetween(0.02, 0.05),
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        rotation: randomBetween(0, 360),
        rotationSpeed: randomBetween(-5, 5),
      });
    }
    if (particlesRef.current.length > MAX_PARTICLES) {
      particlesRef.current.splice(0, particlesRef.current.length - MAX_PARTICLES);
    }
    startParticleLoop();
  }, [startParticleLoop]);

  const spawnCenterBurst = useCallback(() => {
    const { width, height } = sizeRef.current;
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < 30; i += 1) {
      particlesRef.current.push({
        x: centerX,
        y: centerY,
        vx: randomBetween(-4, 4),
        vy: randomBetween(-4, 4),
        size: randomBetween(2, 5),
        opacity: 1,
        decay: randomBetween(0.02, 0.04),
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        rotation: randomBetween(0, 360),
        rotationSpeed: randomBetween(-5, 5),
      });
    }

    startParticleLoop();
  }, [startParticleLoop]);

  const runConfetti = useCallback(() => {
    const palette = [cardColor, '#FFD700', '#FFFFFF', lightenColor(cardColor, 30)];

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.5, x: 0.5 },
      colors: palette,
      startVelocity: 30,
      gravity: 0.8,
      scalar: 1.2,
      shapes: ['circle', 'square'],
      ticks: 120,
    });

    scheduleTimeout(() => {
      confetti({
        particleCount: 40,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.5 },
        colors: [cardColor, '#FFD700', '#FFFFFF'],
        startVelocity: 35,
      });
      confetti({
        particleCount: 40,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.5 },
        colors: [cardColor, '#FFD700', '#FFFFFF'],
        startVelocity: 35,
      });
    }, 150);
  }, [cardColor, scheduleTimeout]);

  const triggerReveal = useCallback(() => {
    if (revealTriggeredRef.current) return;
    revealTriggeredRef.current = true;
    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    lastPointRef.current = null;

    setRevealed(true);
    setScratchOpacity(0);
    spawnCenterBurst();

    scheduleTimeout(() => {
      setShaking(true);
      scheduleTimeout(() => setShaking(false), 500);
    }, 200);

    scheduleTimeout(() => setShowText(true), 300);
    scheduleTimeout(runConfetti, 400);

    scheduleTimeout(() => {
      try {
        navigator.vibrate([50, 30, 100]);
      } catch {
        // no-op on unsupported devices
      }
      playRevealTone();
    }, 500);

    scheduleTimeout(() => {
      setShowCompletionLabel(true);
      onReveal();
    }, 800);
  }, [onReveal, runConfetti, scheduleTimeout, spawnCenterBurst]);

  const maybeHandleRevealThreshold = useCallback(() => {
    const progress = getScratchPercent();
    if (progress >= SCRATCH_REVEAL_THRESHOLD) {
      triggerReveal();
      return;
    }

    if (progress >= SCRATCH_HINT_THRESHOLD) {
      setScratchOpacity((current) => Math.min(current, 0.7));
    }
  }, [getScratchPercent, triggerReveal]);

  const getLocalPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
    const canvas = scratchCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(event.clientX - rect.left, 0, rect.width),
      y: clamp(event.clientY - rect.top, 0, rect.height),
    };
  }, []);

  const scratchAt = useCallback((point: Point) => {
    const ctx = scratchCtxRef.current;
    if (!ctx || revealTriggeredRef.current) return 0;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = BRUSH_DIAMETER;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const previous = lastPointRef.current;
    if (!previous) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, BRUSH_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      markCellsAtPoint(point.x, point.y, BRUSH_RADIUS);
      lastPointRef.current = point;
      return 0;
    }

    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(Math.floor(distance / 3), 1);

    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const x = previous.x + dx * t;
      const y = previous.y + dy * t;
      ctx.lineTo(x, y);
      markCellsAtPoint(x, y, BRUSH_RADIUS);
    }
    ctx.stroke();

    hapticDistanceRef.current += distance;
    if (hapticDistanceRef.current >= HAPTIC_STEP_DISTANCE) {
      hapticDistanceRef.current = 0;
      try {
        navigator.vibrate(2);
      } catch {
        // no-op on unsupported devices
      }

      const audioCtx = ensureScratchAudioContext();
      if (audioCtx && scratchSoundEngineRef.current) {
        try {
          if (audioCtx.state === 'suspended') {
            void audioCtx.resume().then(() => scratchSoundEngineRef.current?.playTick());
          } else {
            scratchSoundEngineRef.current.playTick();
          }
        } catch {
          // no-op on audio failures
        }
      }
    }

    lastPointRef.current = point;
    return distance;
  }, [ensureScratchAudioContext, markCellsAtPoint]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealTriggeredRef.current || activePointerIdRef.current !== null) return;
    event.preventDefault();

    const canvas = scratchCanvasRef.current;
    if (!canvas) return;

    activePointerIdRef.current = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = null;
    moveCounterRef.current = 0;
    hapticDistanceRef.current = 0;
    const audioCtx = ensureScratchAudioContext();
    if (audioCtx?.state === 'suspended') {
      void audioCtx.resume();
    }

    const point = getLocalPoint(event);
    if (!point) return;
    scratchAt(point);

    const spawnCount = Math.floor(randomBetween(2, 5));
    spawnParticlesAt(point.x, point.y, spawnCount);
  }, [ensureScratchAudioContext, getLocalPoint, scratchAt, spawnParticlesAt]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();

    const point = getLocalPoint(event);
    if (!point) return;

    const distance = scratchAt(point);

    const speedBasedCount = clamp(2 + Math.floor(distance / 12), 2, 4);
    const spawnCount = speedBasedCount;
    spawnParticlesAt(point.x, point.y, spawnCount);

    moveCounterRef.current += 1;
    if (moveCounterRef.current % 10 === 0) {
      maybeHandleRevealThreshold();
    }
  }, [getLocalPoint, maybeHandleRevealThreshold, scratchAt, spawnParticlesAt]);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== event.pointerId) return;
    event.preventDefault();

    const canvas = scratchCanvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // no-op when pointer already released
      }
    }

    isDrawingRef.current = false;
    activePointerIdRef.current = null;
    lastPointRef.current = null;
    maybeHandleRevealThreshold();
  }, [maybeHandleRevealThreshold]);

  const handleCardDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (!revealed) return;
    if (info.offset.y > 100) {
      onClose?.();
    }
  }, [onClose, revealed]);

  useEffect(() => {
    const card = cardRef.current;
    const scratchCanvas = scratchCanvasRef.current;
    const particleCanvas = particleCanvasRef.current;
    if (!card || !scratchCanvas || !particleCanvas) return;

    const resizeCanvases = () => {
      const rect = card.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const scratchCtx = setupCanvas(scratchCanvas, rect.width, rect.height);
      const particleCtx = setupCanvas(particleCanvas, rect.width, rect.height);
      if (!scratchCtx || !particleCtx) return;

      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      scratchCtxRef.current = scratchCtx;
      particleCtxRef.current = particleCtx;
      initGrid(rect.width, rect.height);
      drawMetalScratchSurface();
      setScratchOpacity(1);
    };

    resizeCanvases();

    const observer = new ResizeObserver(() => {
      resizeCanvases();
    });
    observer.observe(card);

    return () => observer.disconnect();
  }, [drawMetalScratchSurface, initGrid, setupCanvas]);

  useEffect(() => {
    return () => {
      clearScheduledTimeouts();
      stopParticleLoop();

      const audioCtx = scratchAudioCtxRef.current;
      if (audioCtx) {
        void audioCtx.close().catch(() => undefined);
        scratchAudioCtxRef.current = null;
      }
      scratchSoundEngineRef.current = null;
    };
  }, [clearScheduledTimeouts, stopParticleLoop]);

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        touchAction: 'manipulation',
        overscrollBehavior: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 'max(env(safe-area-inset-top), 16px)',
            right: 'max(env(safe-area-inset-right), 16px)',
            width: 40,
            height: 40,
            border: 'none',
            borderRadius: '50%',
            background: '#FFFFFF',
            color: '#111111',
            fontSize: 24,
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 1020,
            boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
          }}
        >
          ×
        </button>
      )}

      <motion.div
        ref={cardRef}
        style={{
          position: 'relative',
          width: 'min(90vw, 420px)',
          height: 'min(60vh, 560px)',
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: cardColor,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          willChange: 'transform',
          touchAction: 'manipulation',
          animation: shaking ? 'cardShake 500ms ease-out' : 'none',
        }}
        initial={{ opacity: 0, y: 20, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        drag={revealed ? 'y' : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        onDragEnd={handleCardDragEnd}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <motion.div
            style={{
              color: '#fff',
              fontWeight: 800,
              fontSize: 32,
              maxWidth: '80%',
              lineHeight: 1.3,
              opacity: 0,
            }}
            initial={{ scale: 0.7, opacity: 0, y: 20 }}
            animate={showText ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.7, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
          >
            {revealText}
          </motion.div>

          <AnimatePresence>
            {showCompletionLabel && (
              <motion.div
                style={{
                  marginTop: 14,
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.02em',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                scratched ✓
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <canvas
          ref={scratchCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            touchAction: 'none',
            opacity: scratchOpacity,
            pointerEvents: revealed ? 'none' : 'auto',
            transition: `opacity ${revealed ? 0.3 : 0.5}s ease-out`,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <canvas
          ref={particleCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
          }}
        />
      </motion.div>
    </motion.div>
  );
}
