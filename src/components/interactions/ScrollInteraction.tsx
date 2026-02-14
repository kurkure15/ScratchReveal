import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

interface ScrollProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

type BlockType = 'gradientField' | 'floatingOrbs' | 'colorBands' | 'meshGradient' | 'singleColor' | 'particleDust';
type PaletteName = 'sunset' | 'ocean' | 'forest' | 'berry' | 'fire' | 'arctic' | 'dusk' | 'candy' | 'card';

interface FloatingOrb {
  size: number;
  x: number;
  y: number;
  color: string;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
}

interface ColorBand {
  heightPercent: number;
  colorA: string;
  colorB: string;
}

interface MeshBlob {
  sizePercent: number;
  xPercent: number;
  yPercent: number;
  color: string;
  dx: number;
  dy: number;
  duration: number;
  delay: number;
}

interface DustParticle {
  size: number;
  xPercent: number;
  yPercent: number;
  color: string;
  opacity: number;
  riseDuration: number;
  wobbleDuration: number;
  delay: number;
  wobbleDistance: number;
}

interface ContentBlock {
  id: string;
  type: BlockType;
  paletteName: PaletteName;
  palette: [string, string, string];
  gradientKind?: 'linear' | 'radial';
  gradientAngle?: number;
  radialX?: number;
  radialY?: number;
  singleColor?: string;
  backgroundColor?: string;
  orbs?: FloatingOrb[];
  bands?: ColorBand[];
  blobs?: MeshBlob[];
  particles?: DustParticle[];
  accentColor?: string;
}

const BLOCK_COUNT = 60;
const TIMER_FREEZE_SECONDS = 30;
const TIMER_SHOW_AFTER_SECONDS = 5;

const TYPE_WEIGHTS: Array<{ type: BlockType; weight: number }> = [
  { type: 'gradientField', weight: 30 },
  { type: 'floatingOrbs', weight: 25 },
  { type: 'colorBands', weight: 15 },
  { type: 'meshGradient', weight: 15 },
  { type: 'singleColor', weight: 10 },
  { type: 'particleDust', weight: 5 },
];

const COMPLEMENTS: Record<PaletteName, PaletteName[]> = {
  sunset: ['ocean', 'dusk'],
  ocean: ['sunset', 'fire'],
  forest: ['berry', 'candy'],
  berry: ['forest', 'arctic'],
  fire: ['ocean', 'arctic'],
  arctic: ['berry', 'fire'],
  dusk: ['sunset', 'candy'],
  candy: ['dusk', 'forest'],
  card: ['dusk', 'ocean'],
};

const BASE_PALETTES: Omit<Record<PaletteName, [string, string, string]>, 'card'> = {
  sunset: ['#FF6B6B', '#FEC89A', '#FFD93D'],
  ocean: ['#0077B6', '#00B4D8', '#90E0EF'],
  forest: ['#2D6A4F', '#52B788', '#B7E4C7'],
  berry: ['#7B2CBF', '#C77DFF', '#E0AAFF'],
  fire: ['#E63946', '#F4845F', '#F7B267'],
  arctic: ['#CAF0F8', '#ADE8F4', '#48CAE4'],
  dusk: ['#22223B', '#4A4E69', '#9A8C98'],
  candy: ['#FF69B4', '#FF85C0', '#FFC4E1'],
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randInt(min: number, max: number) {
  return Math.floor(randRange(min, max + 1));
}

function pickOne<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalizeHex(hex: string) {
  const value = hex.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const short = value.slice(1);
    return `#${short[0]}${short[0]}${short[1]}${short[1]}${short[2]}${short[2]}`;
  }
  return '#4A4E69';
}

function hexToRgb(hex: string): [number, number, number] {
  const safe = normalizeHex(hex).slice(1);
  return [
    Number.parseInt(safe.slice(0, 2), 16),
    Number.parseInt(safe.slice(2, 4), 16),
    Number.parseInt(safe.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((part) => clamp(Math.round(part), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(a: string, b: string, t: number) {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(
    ar + (br - ar) * t,
    ag + (bg - ag) * t,
    ab + (bb - ab) * t,
  );
}

function lighten(hex: string, amount: number) {
  return mixHex(hex, '#FFFFFF', clamp(amount, 0, 1));
}

function darken(hex: string, amount: number) {
  return mixHex(hex, '#000000', clamp(amount, 0, 1));
}

function buildPalettes(cardColor: string): Record<PaletteName, [string, string, string]> {
  const safeCard = normalizeHex(cardColor);
  return {
    ...BASE_PALETTES,
    card: [
      darken(safeCard, 0.15),
      safeCard,
      lighten(safeCard, 0.28),
    ],
  };
}

function pickWeightedType(previous: BlockType | null): BlockType {
  const options = previous
    ? TYPE_WEIGHTS.filter(({ type }) => type !== previous)
    : TYPE_WEIGHTS;
  const totalWeight = options.reduce((sum, item) => sum + item.weight, 0);
  let cursor = randRange(0, totalWeight);

  for (const option of options) {
    cursor -= option.weight;
    if (cursor <= 0) return option.type;
  }

  return options[options.length - 1].type;
}

function pickPaletteName(previous: PaletteName | null, allNames: PaletteName[]): PaletteName {
  if (!previous) return pickOne(allNames);
  const candidates = [previous, ...COMPLEMENTS[previous]].filter((name, index, arr): name is PaletteName => {
    return arr.indexOf(name) === index && allNames.includes(name);
  });
  return pickOne(candidates);
}

function createGradientBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const gradientKind: 'linear' | 'radial' = Math.random() > 0.45 ? 'linear' : 'radial';
  return {
    id: `scroll-block-${id}`,
    type: 'gradientField',
    paletteName,
    palette,
    gradientKind,
    gradientAngle: randRange(0, 360),
    radialX: randRange(15, 85),
    radialY: randRange(15, 85),
  };
}

function createOrbsBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const orbCount = randInt(3, 5);
  const orbs: FloatingOrb[] = Array.from({ length: orbCount }, (_, index) => {
    const color = palette[index % palette.length];
    return {
      size: randInt(150, 300),
      x: randRange(-10, 80),
      y: randRange(-10, 80),
      color,
      dx: randRange(-30, 30),
      dy: randRange(-30, 30),
      duration: randRange(6, 10),
      delay: randRange(-2.5, 0),
    };
  });

  return {
    id: `scroll-block-${id}`,
    type: 'floatingOrbs',
    paletteName,
    palette,
    orbs,
    backgroundColor: '#0A0A0A',
  };
}

function createBandsBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const bandCount = randInt(4, 6);
  const weights = Array.from({ length: bandCount }, () => randRange(15, 25));
  const total = weights.reduce((sum, part) => sum + part, 0);
  const ascending = Math.random() > 0.5;
  const paletteOrder = ascending ? [...palette] : [...palette].reverse();

  const bands: ColorBand[] = weights.map((weight, index) => {
    const t = bandCount === 1 ? 0 : index / (bandCount - 1);
    const base = mixHex(paletteOrder[0], paletteOrder[2], t);
    return {
      heightPercent: (weight / total) * 100,
      colorA: darken(base, 0.1),
      colorB: lighten(base, 0.08),
    };
  });

  return {
    id: `scroll-block-${id}`,
    type: 'colorBands',
    paletteName,
    palette,
    bands,
  };
}

function createMeshBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const blobs: MeshBlob[] = Array.from({ length: 4 }, (_, index) => ({
    sizePercent: randRange(60, 80),
    xPercent: randRange(-20, 60),
    yPercent: randRange(-20, 60),
    color: palette[index % palette.length],
    dx: randRange(-20, 20),
    dy: randRange(-20, 20),
    duration: randRange(8, 12),
    delay: randRange(-3, 0),
  }));

  return {
    id: `scroll-block-${id}`,
    type: 'meshGradient',
    paletteName,
    palette,
    backgroundColor: darken(palette[0], 0.4),
    blobs,
  };
}

function createSingleColorBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const deep = darken(palette[0], 0.35);
  return {
    id: `scroll-block-${id}`,
    type: 'singleColor',
    paletteName,
    palette,
    singleColor: deep,
  };
}

function createParticlesBlock(id: number, paletteName: PaletteName, palette: [string, string, string]): ContentBlock {
  const particleCount = randInt(40, 60);
  const accent = palette[1];
  const particles: DustParticle[] = Array.from({ length: particleCount }, () => {
    const useAccent = Math.random() > 0.6;
    return {
      size: randRange(2, 4),
      xPercent: randRange(0, 100),
      yPercent: randRange(0, 100),
      color: useAccent ? accent : '#FFFFFF',
      opacity: randRange(0.3, 0.7),
      riseDuration: randRange(15, 25),
      wobbleDuration: randRange(2.5, 5),
      delay: randRange(-12, 0),
      wobbleDistance: randRange(3, 12),
    };
  });

  return {
    id: `scroll-block-${id}`,
    type: 'particleDust',
    paletteName,
    palette,
    particles,
    accentColor: accent,
    backgroundColor: '#0D0D0D',
  };
}

function formatClock(seconds: number) {
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function ScrollInteraction({ onClose, cardColor, onReveal }: ScrollProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const timeoutRef = useRef<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const freezeStartedRef = useRef(false);
  const hintShownRef = useRef(false);
  const onRevealRef = useRef(onReveal);
  const originalBodyOverflowRef = useRef<string>('');
  const originalThemeColorRef = useRef<string | null>(null);
  const createdThemeMetaRef = useRef<HTMLMetaElement | null>(null);

  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showDarkOverlay, setShowDarkOverlay] = useState(false);
  const [showFirstLine, setShowFirstLine] = useState(false);
  const [showSecondLine, setShowSecondLine] = useState(false);

  onRevealRef.current = onReveal;

  const palettes = useMemo(() => buildPalettes(cardColor), [cardColor]);

  const contentBlocks = useMemo<ContentBlock[]>(() => {
    const blocks: ContentBlock[] = [];
    const names = Object.keys(palettes) as PaletteName[];
    let previousType: BlockType | null = null;
    let previousPalette: PaletteName | null = null;

    for (let i = 0; i < BLOCK_COUNT; i += 1) {
      const type = pickWeightedType(previousType);
      const paletteName = pickPaletteName(previousPalette, names);
      const palette = palettes[paletteName];

      if (type === 'gradientField') {
        blocks.push(createGradientBlock(i, paletteName, palette));
      } else if (type === 'floatingOrbs') {
        blocks.push(createOrbsBlock(i, paletteName, palette));
      } else if (type === 'colorBands') {
        blocks.push(createBandsBlock(i, paletteName, palette));
      } else if (type === 'meshGradient') {
        blocks.push(createMeshBlock(i, paletteName, palette));
      } else if (type === 'singleColor') {
        blocks.push(createSingleColorBlock(i, paletteName, palette));
      } else {
        blocks.push(createParticlesBlock(i, paletteName, palette));
      }

      previousType = type;
      previousPalette = paletteName;
    }

    return blocks;
  }, [palettes]);

  const setThemeColor = useCallback((color: string) => {
    const existing = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (existing) {
      existing.setAttribute('content', color);
      createdThemeMetaRef.current = existing;
      return;
    }

    const meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    document.head.appendChild(meta);
    createdThemeMetaRef.current = meta;
  }, []);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const clearTimerInterval = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const clearManagedTimeouts = useCallback(() => {
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
  }, []);

  const playFreezeTone = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 330;

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.42);
    } catch {
      // no-op
    }
  }, []);

  const triggerFreeze = useCallback(() => {
    if (freezeStartedRef.current) return;
    freezeStartedRef.current = true;

    clearTimerInterval();
    clearIdleTimer();
    setIsFrozen(true);
    setShowDarkOverlay(true);

    const phaseFiveId = window.setTimeout(() => {
      setShowFirstLine(true);
      playFreezeTone();
      try {
        navigator.vibrate([40, 30, 60]);
      } catch {
        // no-op
      }
      onRevealRef.current?.();
    }, 800);

    const secondLineId = window.setTimeout(() => {
      setShowSecondLine(true);
    }, 2500);

    timeoutRef.current.push(phaseFiveId, secondLineId);
  }, [clearIdleTimer, clearTimerInterval, playFreezeTone]);

  const runIdleHint = useCallback(() => {
    if (hintShownRef.current || freezeStartedRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    hintShownRef.current = true;
    const baseY = container.scrollTop;
    container.scrollTo({ top: baseY + 20, behavior: 'smooth' });

    const returnId = window.setTimeout(() => {
      container.scrollTo({ top: baseY, behavior: 'smooth' });
    }, 280);

    timeoutRef.current.push(returnId);
  }, []);

  const scheduleIdleHint = useCallback(() => {
    if (hintShownRef.current || freezeStartedRef.current) return;
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      runIdleHint();
      idleTimerRef.current = null;
    }, 3000);
  }, [clearIdleTimer, runIdleHint]);

  useEffect(() => {
    originalBodyOverflowRef.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const existingTheme = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    originalThemeColorRef.current = existingTheme?.getAttribute('content') ?? null;
    setThemeColor('#000000');

    timerIntervalRef.current = window.setInterval(() => {
      setTimerSeconds((previous) => previous + 1);
    }, 1000);

    scheduleIdleHint();

    return () => {
      clearTimerInterval();
      clearIdleTimer();
      clearManagedTimeouts();

      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }

      document.body.style.overflow = originalBodyOverflowRef.current;

      if (originalThemeColorRef.current !== null) {
        setThemeColor(originalThemeColorRef.current);
      } else if (createdThemeMetaRef.current && createdThemeMetaRef.current.parentNode) {
        createdThemeMetaRef.current.parentNode.removeChild(createdThemeMetaRef.current);
      }
    };
  }, [clearIdleTimer, clearManagedTimeouts, clearTimerInterval, scheduleIdleHint, setThemeColor]);

  useEffect(() => {
    if (timerSeconds >= TIMER_SHOW_AFTER_SECONDS) {
      setShowTimer(true);
    }
    if (timerSeconds >= TIMER_FREEZE_SECONDS && !freezeStartedRef.current) {
      triggerFreeze();
    }
  }, [timerSeconds, triggerFreeze]);

  const handleFeedScroll = useCallback(() => {
    if (freezeStartedRef.current) return;
    scheduleIdleHint();
  }, [scheduleIdleHint]);

  const renderGradientField = (block: ContentBlock) => {
    if (!block.gradientKind || block.gradientAngle === undefined || block.radialX === undefined || block.radialY === undefined) {
      return null;
    }

    const gradient = block.gradientKind === 'linear'
      ? `linear-gradient(${block.gradientAngle}deg, ${block.palette[0]}, ${block.palette[1]}, ${block.palette[2]})`
      : `radial-gradient(circle at ${block.radialX}% ${block.radialY}%, ${block.palette[0]}, ${block.palette[1]}, ${block.palette[2]})`;

    return (
      <>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: gradient }} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.03,
            backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 0.5px, transparent 0.5px)',
            backgroundSize: '2px 2px',
            mixBlendMode: 'soft-light',
          }}
        />
      </>
    );
  };

  const renderFloatingOrbs = (block: ContentBlock) => {
    if (!block.orbs || !block.backgroundColor) return null;

    return (
      <>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: block.backgroundColor }} />
        {block.orbs.map((orb, index) => (
          <div
            key={`${block.id}-orb-${index}`}
            className="si-anim"
            style={{
              position: 'absolute',
              width: orb.size,
              height: orb.size,
              left: `${orb.x}%`,
              top: `${orb.y}%`,
              marginLeft: -orb.size / 2,
              marginTop: -orb.size / 2,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${orb.color} 0%, ${orb.color}99 38%, transparent 75%)`,
              filter: 'blur(40px)',
              transform: 'translate3d(0,0,0)',
              animation: `si-float ${orb.duration}s ease-in-out ${orb.delay}s infinite alternate`,
              ['--si-dx' as '--si-dx']: `${orb.dx}px`,
              ['--si-dy' as '--si-dy']: `${orb.dy}px`,
            } as CSSProperties}
          />
        ))}
      </>
    );
  };

  const renderColorBands = (block: ContentBlock) => {
    if (!block.bands) return null;

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
        {block.bands.map((band, index) => (
          <div
            key={`${block.id}-band-${index}`}
            style={{
              height: `${band.heightPercent}%`,
              width: '100%',
              backgroundImage: `linear-gradient(90deg, ${band.colorA}, ${band.colorB})`,
            }}
          />
        ))}
      </div>
    );
  };

  const renderMeshGradient = (block: ContentBlock) => {
    if (!block.blobs || !block.backgroundColor) return null;

    return (
      <>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: block.backgroundColor }} />
        {block.blobs.map((blob, index) => (
          <div
            key={`${block.id}-blob-${index}`}
            className="si-anim"
            style={{
              position: 'absolute',
              width: `${blob.sizePercent}%`,
              height: `${blob.sizePercent}%`,
              left: `${blob.xPercent}%`,
              top: `${blob.yPercent}%`,
              borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
              backgroundColor: blob.color,
              opacity: 0.7,
              filter: 'blur(60px)',
              transform: 'translate3d(0,0,0)',
              animation: `si-float ${blob.duration}s ease-in-out ${blob.delay}s infinite alternate`,
              ['--si-dx' as '--si-dx']: `${blob.dx}px`,
              ['--si-dy' as '--si-dy']: `${blob.dy}px`,
            } as CSSProperties}
          />
        ))}
      </>
    );
  };

  const renderSingleColor = (block: ContentBlock) => {
    if (!block.singleColor) return null;

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(circle at center, ${block.singleColor} 30%, ${darken(block.singleColor, 0.2)} 75%, rgba(0,0,0,0.3) 100%)`,
        }}
      />
    );
  };

  const renderParticleDust = (block: ContentBlock) => {
    if (!block.particles || !block.backgroundColor) return null;

    return (
      <>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: block.backgroundColor }} />
        {block.particles.map((particle, index) => (
          <div
            key={`${block.id}-dust-${index}`}
            className="si-anim"
            style={{
              position: 'absolute',
              left: `${particle.xPercent}%`,
              top: `${particle.yPercent}%`,
              width: particle.size,
              height: particle.size,
              animation: `si-dust-rise ${particle.riseDuration}s linear ${particle.delay}s infinite`,
            }}
          >
            <div
              className="si-anim"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                backgroundColor: particle.color,
                opacity: particle.opacity,
                filter: 'blur(0.5px)',
                animation: `si-dust-wobble ${particle.wobbleDuration}s ease-in-out ${particle.delay}s infinite alternate`,
                ['--si-wobble' as '--si-wobble']: `${particle.wobbleDistance}px`,
              } as CSSProperties}
            />
          </div>
        ))}
      </>
    );
  };

  const renderBlockContent = (block: ContentBlock) => {
    if (block.type === 'gradientField') return renderGradientField(block);
    if (block.type === 'floatingOrbs') return renderFloatingOrbs(block);
    if (block.type === 'colorBands') return renderColorBands(block);
    if (block.type === 'meshGradient') return renderMeshGradient(block);
    if (block.type === 'singleColor') return renderSingleColor(block);
    return renderParticleDust(block);
  };

  return (
    <div
      className={isFrozen ? 'scroll-interaction-root scroll-interaction-frozen' : 'scroll-interaction-root'}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#000000',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: 'rgba(255,255,255,0.7)',
          color: '#0F0F0F',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 1020,
        }}
      >
        ×
      </button>

      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 60,
          zIndex: 1010,
          fontFamily: "'SFMono-Regular', ui-monospace, 'Menlo', 'Monaco', monospace",
          fontSize: 13,
          letterSpacing: 0.4,
          color: 'rgba(255,255,255,0.3)',
          opacity: showTimer ? 0.3 : 0,
          transition: 'opacity 1000ms ease',
          pointerEvents: 'none',
        }}
      >
        {formatClock(timerSeconds)}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleFeedScroll}
        style={{
          width: '100%',
          height: '100%',
          overflowY: isFrozen ? 'hidden' : 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehaviorY: 'contain',
        }}
      >
        {contentBlocks.map((block) => (
          <section
            key={block.id}
            style={{
              position: 'relative',
              width: '100%',
              height: '100vh',
              minHeight: '100dvh',
              overflow: 'hidden',
              scrollSnapAlign: 'start',
              flexShrink: 0,
            }}
          >
            {renderBlockContent(block)}
          </section>
        ))}
      </div>

      {(showDarkOverlay || showFirstLine || showSecondLine) && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              opacity: showDarkOverlay ? 1 : 0,
              transition: 'opacity 500ms ease',
              zIndex: 1050,
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1060,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              padding: '0 24px',
              pointerEvents: 'none',
            }}
          >
            <p
              style={{
                margin: 0,
                maxWidth: 280,
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                fontSize: 18,
                fontWeight: 300,
                lineHeight: 1.5,
                letterSpacing: 0.5,
                color: '#FFFFFF',
                opacity: showFirstLine ? 1 : 0,
                transform: showFirstLine ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 600ms ease, transform 600ms ease',
              }}
            >
              that was 30 seconds you&apos;ll never get back.
            </p>
            <p
              style={{
                margin: '18px 0 0',
                fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                fontSize: 15,
                lineHeight: 1.5,
                color: 'rgba(255,255,255,0.5)',
                opacity: showSecondLine ? 1 : 0,
                transform: showSecondLine ? 'translateY(0)' : 'translateY(10px)',
                transition: 'opacity 600ms ease, transform 600ms ease',
              }}
            >
              felt good though right?
            </p>
          </div>
        </>
      )}

      <style>{`
        .scroll-interaction-frozen .si-anim {
          animation-play-state: paused !important;
        }

        @keyframes si-float {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(var(--si-dx, 0px), var(--si-dy, 0px), 0);
          }
        }

        @keyframes si-dust-rise {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(0, -100vh, 0);
          }
        }

        @keyframes si-dust-wobble {
          from {
            transform: translateX(calc(var(--si-wobble, 6px) * -1));
          }
          to {
            transform: translateX(var(--si-wobble, 6px));
          }
        }
      `}</style>
    </div>
  );
}
