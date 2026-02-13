import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import grassBg from '../../assets/grass-bg.png';

interface TouchGrassProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

const REVEAL_ACTIVE_SECONDS = 8;
const PARTICLE_COUNT = 20;

interface Particle {
  left: string;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export default function TouchGrassInteraction({
  onClose,
  onReveal,
}: TouchGrassProps) {
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isRevealed, setIsRevealed] = useState(false);
  const [isFingerDown, setIsFingerDown] = useState(false);

  const pointerActiveRef = useRef(false);
  const activeTimeRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const rafRef = useRef(0);
  const revealedRef = useRef(false);

  // Generate particles once
  const particles = useMemo<Particle[]>(() => {
    const result: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      result.push({
        left: `${Math.random() * 100}%`,
        size: 2 + Math.random() * 4,
        duration: 8 + Math.random() * 7,
        delay: -(Math.random() * 15),
        opacity: 0.15 + Math.random() * 0.35,
      });
    }
    return result;
  }, []);

  // Accumulate active time via rAF (lightweight — no drawing)
  const tick = useCallback(() => {
    const now = performance.now();
    if (lastTimestampRef.current > 0 && pointerActiveRef.current && !revealedRef.current) {
      const dt = (now - lastTimestampRef.current) / 1000;
      activeTimeRef.current += dt;

      if (activeTimeRef.current >= REVEAL_ACTIVE_SECONDS) {
        revealedRef.current = true;
        setIsRevealed(true);
        onReveal?.();
        try { navigator.vibrate([30, 50, 30]); } catch { /* noop */ }
      }
    }
    lastTimestampRef.current = now;
    rafRef.current = requestAnimationFrame(tick);
  }, [onReveal]);

  useEffect(() => {
    lastTimestampRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointerActiveRef.current = true;
    setIsFingerDown(true);
    const offsetX = (e.clientX - window.innerWidth / 2) / window.innerWidth;
    const offsetY = (e.clientY - window.innerHeight / 2) / window.innerHeight;
    setImageOffset({ x: offsetX * -20, y: offsetY * -15 });
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!pointerActiveRef.current) return;
    const offsetX = (e.clientX - window.innerWidth / 2) / window.innerWidth;
    const offsetY = (e.clientY - window.innerHeight / 2) / window.innerHeight;
    setImageOffset({ x: offsetX * -20, y: offsetY * -15 });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    pointerActiveRef.current = false;
    setIsFingerDown(false);
    setImageOffset({ x: 0, y: 0 });
  }, []);

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        touchAction: 'none',
        overscrollBehavior: 'none',
        backgroundColor: '#000',
        overflow: 'hidden',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Parallax background image */}
      <img
        src={grassBg}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '110%',
          height: '110%',
          objectFit: 'cover',
          objectPosition: 'center bottom',
          transform: `translate(calc(-50% + ${imageOffset.x}px), calc(-50% + ${imageOffset.y}px))`,
          transition: isFingerDown
            ? 'transform 0.3s ease-out'
            : 'transform 0.8s ease',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Floating particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: p.left,
            bottom: '-10px',
            width: p.size,
            height: p.size,
            borderRadius: '50%',
            backgroundColor: `rgba(255, 255, 240, ${p.opacity})`,
            pointerEvents: 'none',
            animation: `floatUp ${p.duration}s linear ${p.delay}s infinite`,
          }}
        />
      ))}

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
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
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
        }}
      >
        ×
      </button>

      {/* Reveal text */}
      {isRevealed && (
        <motion.div
          style={{
            position: 'fixed',
            bottom: '22%',
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 2,
            pointerEvents: 'none',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        >
          <span
            style={{
              color: '#FFFFFF',
              fontSize: 26,
              fontWeight: 300,
              letterSpacing: 3,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '12px 24px',
              borderRadius: 20,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            touch grass.
          </span>
        </motion.div>
      )}

      {/* Particle animation keyframes */}
      <style>{`
        @keyframes floatUp {
          0% {
            transform: translateY(100vh) translateX(0px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-10vh) translateX(20px);
            opacity: 0;
          }
        }
      `}</style>
    </motion.div>
  );
}
