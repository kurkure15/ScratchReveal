import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import type { CardData } from '../data/cards';
import { playRevealChime } from '../utils/sounds';

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

// Confetti piece component
function ConfettiPiece({ delay, color, seed }: { delay: number; color: string; seed: number }) {
  const startX = seededUnit(seed) * 100;
  const drift = (seededUnit(seed + 1) - 0.5) * 120;
  const rotateTo = seededUnit(seed + 2) * 720 - 360;

  return (
    <motion.div
      style={{
        position: 'absolute',
        top: -10,
        left: `${startX}%`,
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
        pointerEvents: 'none',
      }}
      initial={{ y: 0, x: 0, opacity: 1 }}
      animate={{
        y: [0, 500],
        x: [0, drift],
        opacity: [1, 0],
        rotate: [0, rotateTo],
      }}
      transition={{
        duration: 1.8,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

interface ScratchOverlayProps {
  card: CardData;
  onClose: () => void;
}

const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D', '#C9B1FF', '#FF90B3'];

export default function ScratchOverlay({ card, onClose }: ScratchOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const lastHapticDist = useRef(0);
  const [revealed, setRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const revealedRef = useRef(false);
  const dragYRef = useRef(0);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    ctx.fillStyle = '#D4D4D4';
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Add some texture
    ctx.fillStyle = '#C8C8C8';
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * rect.width;
      const y = Math.random() * rect.height;
      ctx.fillRect(x, y, 2, 2);
    }
  }, []);

  const checkScratchPercentage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || revealedRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let transparent = 0;
    let total = 0;

    // Sample every 4th pixel for performance
    for (let i = 3; i < pixels.length; i += 16) {
      total++;
      if (pixels[i] === 0) transparent++;
    }

    const percentage = transparent / total;
    if (percentage > 0.55) {
      revealedRef.current = true;
      setRevealed(true);
      setShowConfetti(true);
      playRevealChime();
      try { navigator.vibrate(100); } catch { /* no haptics */ }
    }
  }, []);

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current;
    if (!canvas || revealedRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = x - rect.left;
    const canvasY = y - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 44;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (lastPoint.current) {
      ctx.beginPath();
      ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
      ctx.lineTo(canvasX, canvasY);
      ctx.stroke();

      // Haptic feedback every ~40px
      const dist = Math.hypot(canvasX - lastPoint.current.x, canvasY - lastPoint.current.y);
      lastHapticDist.current += dist;
      if (lastHapticDist.current > 40) {
        lastHapticDist.current = 0;
        try { navigator.vibrate(5); } catch { /* no haptics */ }
      }
    } else {
      ctx.beginPath();
      ctx.arc(canvasX, canvasY, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    lastPoint.current = { x: canvasX, y: canvasY };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = null;
    lastHapticDist.current = 0;
    scratch(e.clientX, e.clientY);
  }, [scratch]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    scratch(e.clientX, e.clientY);
  }, [scratch]);

  const handlePointerUp = useCallback(() => {
    isDrawing.current = false;
    lastPoint.current = null;
    checkScratchPercentage();
  }, [checkScratchPercentage]);

  // Swipe-to-dismiss on backdrop
  const handleBackdropDrag = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    dragYRef.current = info.offset.y;
  }, []);

  const handleBackdropDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          touchAction: 'none',
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Backdrop */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          onClick={onClose}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.3}
          onDrag={handleBackdropDrag}
          onDragEnd={handleBackdropDragEnd}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            zIndex: 60,
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '50%',
            width: 40,
            height: 40,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: 20,
            fontWeight: 300,
            backdropFilter: 'blur(4px)',
            padding: 0,
          }}
        >
          ✕
        </button>

        {/* Card */}
        <motion.div
          style={{
            position: 'relative',
            width: '90vw',
            maxWidth: 360,
            aspectRatio: '280 / 360',
            borderRadius: 20,
            backgroundColor: card.color,
            overflow: 'hidden',
            zIndex: 51,
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {/* Label */}
          <div
            style={{
              padding: '20px 22px',
              color: 'white',
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {card.label}
          </div>

          {/* Reward text (below scratch layer) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <AnimatePresence>
              {revealed && (
                <motion.div
                  style={{
                    fontSize: 48,
                    fontWeight: 900,
                    color: 'white',
                    textAlign: 'center',
                    lineHeight: 1.1,
                    textShadow: '0 2px 10px rgba(0,0,0,0.3)',
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {card.reward}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Scratch canvas */}
          <motion.canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 3,
              touchAction: 'none',
              cursor: 'crosshair',
            }}
            animate={{ opacity: revealed ? 0 : 1 }}
            transition={{ duration: 0.5 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          {/* Confetti */}
          {showConfetti && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden' }}>
              {Array.from({ length: 20 }, (_, i) => (
                <ConfettiPiece
                  key={i}
                  delay={i * 0.05}
                  color={CONFETTI_COLORS[i % CONFETTI_COLORS.length]}
                  seed={i + 1}
                />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
