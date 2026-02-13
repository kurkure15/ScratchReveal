import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';

// ── Types ────────────────────────────────────────────────────────────────

interface ReorganizeProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

type ItemPhase = 'swipe' | 'sort' | 'placed' | 'dismissed';
type ItemType = 'notification' | 'tab' | 'social' | 'loose';

interface ClutterItem {
  id: number;
  type: ItemType;
  subtype?: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
  phase: ItemPhase;
  delay: number;
  color: string;
  snappedCell?: number;
}

// ── Data ─────────────────────────────────────────────────────────────────

const NOTIFICATION_TEXTS = [
  '657 unread emails',
  'mom called (3)',
  'rent due tomorrow',
  'screen time: 7h 42m',
  'storage almost full',
  'update available',
];

const TAB_TEXTS = [
  'how to center a div',
  'am I lactose intolerant quiz',
  'flights to bali one way',
  'best restaurants near me',
];

const SOCIAL_TEXTS = [
  'liked your photo from 2019',
  'your ex started a podcast',
  'new follower: your_mom_42',
  'tagged you in a memory',
];

const DOT_COLORS = ['#FF5F57', '#4A90D9', '#28C840', '#FFB366'];
const AVATAR_COLORS = ['#FF6B8A', '#4A90D9', '#28C840', '#FFB366'];

const SWIPE_THRESHOLD_VELOCITY = 300;
const SWIPE_THRESHOLD_OFFSET = 80;
const SNAP_DISTANCE = 80;
const ITEMS_BEFORE_SORT = 12;

// ── Helpers ──────────────────────────────────────────────────────────────

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function bgForProgress(cleared: number, total: number): string {
  const t = Math.min(cleared / total, 1);
  // #F0EDE8 → #FAFAF8 → #FFFFFF
  if (t <= 0.5) {
    const s = t / 0.5;
    const r = Math.round(lerp(0xF0, 0xFA, s));
    const g = Math.round(lerp(0xED, 0xFA, s));
    const b = Math.round(lerp(0xE8, 0xF8, s));
    return `rgb(${r},${g},${b})`;
  }
  const s = (t - 0.5) / 0.5;
  const r = Math.round(lerp(0xFA, 0xFF, s));
  const g = Math.round(lerp(0xFA, 0xFF, s));
  const b = Math.round(lerp(0xF8, 0xFF, s));
  return `rgb(${r},${g},${b})`;
}

function generateItems(): ClutterItem[] {
  const items: ClutterItem[] = [];
  let id = 0;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 700;

  // Grid-based distribution: 4 cols × 5 rows = 20 slots for 18 items
  const cols = 4;
  const rows = 5;
  const padX = 16;
  const padTop = 80;
  const padBottom = 120;
  const usableW = vw - padX * 2 - 200; // subtract max item width
  const usableH = vh - padTop - padBottom;
  const cellW = Math.max(1, usableW / cols);
  const cellH = Math.max(1, usableH / rows);
  const jitter = 20;

  // Shuffle grid slots
  const slots: { col: number; row: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({ col: c, row: r });
    }
  }
  // Fisher-Yates shuffle
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  function nextPos(): { x: number; y: number } {
    const slot = slots[id % slots.length];
    return {
      x: Math.max(padX, Math.min(vw - 200 - padX, padX + slot.col * cellW + randRange(-jitter, jitter))),
      y: Math.max(padTop, Math.min(vh - padBottom, padTop + slot.row * cellH + randRange(-jitter, jitter))),
    };
  }

  // Notifications (6)
  for (let i = 0; i < 6; i++) {
    const pos = nextPos();
    items.push({
      id: id++,
      type: 'notification',
      text: NOTIFICATION_TEXTS[i],
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color: DOT_COLORS[i % DOT_COLORS.length],
    });
  }

  // Tabs (4)
  for (let i = 0; i < 4; i++) {
    const pos = nextPos();
    items.push({
      id: id++,
      type: 'tab',
      text: TAB_TEXTS[i],
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color: '#4A90D9',
    });
  }

  // Social (4)
  for (let i = 0; i < 4; i++) {
    const pos = nextPos();
    items.push({
      id: id++,
      type: 'social',
      text: SOCIAL_TEXTS[i],
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color: AVATAR_COLORS[i % AVATAR_COLORS.length],
    });
  }

  // Loose items (4)
  const looseConfigs: { subtype: string; text: string }[] = [
    { subtype: 'voice', text: '▶ 0:47' },
    { subtype: 'photo', text: '' },
    { subtype: 'note', text: 'grocery list: milk, eggs, uh...' },
    { subtype: 'reminder', text: 'dentist appointment - overdue' },
  ];
  for (let i = 0; i < 4; i++) {
    const pos = nextPos();
    items.push({
      id: id++,
      type: 'loose',
      subtype: looseConfigs[i].subtype,
      text: looseConfigs[i].text,
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color: DOT_COLORS[i % DOT_COLORS.length],
    });
  }

  return items;
}

// ── Pastel colors for photo items ────────────────────────────────────────

const PHOTO_PASTELS = ['#FFE0E6', '#E0F0FF', '#E6FFE0', '#FFF5E0', '#F0E0FF'];

// ── Drag style applied to each draggable item ────────────────────────────

const DRAG_ITEM_STYLE: React.CSSProperties = {
  WebkitTouchCallout: 'none',
  WebkitUserDrag: 'none',
} as React.CSSProperties;

// ── Component ────────────────────────────────────────────────────────────

export default function ReorganizeInteraction({
  onClose,
  onReveal,
}: ReorganizeProps) {
  const [items, setItems] = useState<ClutterItem[]>(() => generateItems());
  const [gamePhase, setGamePhase] = useState<'swipe' | 'sort' | 'reveal'>('swipe');
  const [gridVisible, setGridVisible] = useState(false);
  const [gridOpacity, setGridOpacity] = useState(1);
  const [itemsOpacity, setItemsOpacity] = useState(1);
  const [showFinalNotif, setShowFinalNotif] = useState(false);
  const [showFinalText, setShowFinalText] = useState(false);
  const [occupiedCells, setOccupiedCells] = useState<(number | null)[]>([null, null, null, null, null, null]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const dismissedCountRef = useRef(0);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  const revealTimersRef = useRef<number[]>([]);
  const photoColorRef = useRef(PHOTO_PASTELS[Math.floor(Math.random() * PHOTO_PASTELS.length)]);

  // Lock body scroll on mount, restore on unmount
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    const origPosition = document.body.style.position;
    const origWidth = document.body.style.width;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = origOverflow;
      document.body.style.position = origPosition;
      document.body.style.width = origWidth;
    };
  }, []);

  // Cleanup timers
  useEffect(() => {
    return () => {
      revealTimersRef.current.forEach(id => clearTimeout(id));
    };
  }, []);

  // ── Audio helpers ────────────────────────────────────────────────────

  const ensureAudio = useCallback(() => {
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* noop */ }
    }
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playWhoosh = useCallback((itemIndex: number) => {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const duration = 0.06;
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = Math.max(1500, 3000 - itemIndex * 100);
      bandpass.Q.value = 1;

      const gain = ctx.createGain();
      const vol = Math.min(0.08, 0.03 + itemIndex * 0.003);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      source.connect(bandpass);
      bandpass.connect(gain);
      gain.connect(ctx.destination);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + duration + 0.01);
    } catch { /* noop */ }
  }, [ensureAudio]);

  const playClick = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);
    } catch { /* noop */ }
  }, [ensureAudio]);

  const playRevealChord = useCallback(() => {
    const ctx = ensureAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      for (const freq of [262, 330, 392]) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.32);
      }
    } catch { /* noop */ }
  }, [ensureAudio]);

  // ── Computed values ──────────────────────────────────────────────────

  const activeItems = useMemo(() => items.filter(it => it.phase !== 'dismissed'), [items]);
  const dismissedCount = useMemo(() => items.filter(it => it.phase === 'dismissed').length, [items]);
  const sortItems = useMemo(() => items.filter(it => it.phase === 'sort' || it.phase === 'placed'), [items]);
  const placedCount = useMemo(() => items.filter(it => it.phase === 'placed').length, [items]);

  const bg = useMemo(() => bgForProgress(dismissedCount + placedCount, 18), [dismissedCount, placedCount]);

  // ── Grid cell positions ──────────────────────────────────────────────

  const gridCells = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
    const gridW = Math.min(vw - 48, 340);
    const gap = 12;
    const cols = 2;
    const rows = 3;
    const cellW = (gridW - gap) / cols;
    const cellH = 64;
    const totalH = rows * cellH + (rows - 1) * gap;
    const startX = (vw - gridW) / 2;
    const startY = (vh - totalH) / 2;
    const cells: { x: number; y: number; w: number; h: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({
          x: startX + c * (cellW + gap),
          y: startY + r * (cellH + gap),
          w: cellW,
          h: cellH,
        });
      }
    }
    return cells;
  }, []);

  // ── Phase transitions ────────────────────────────────────────────────

  useEffect(() => {
    if (gamePhase === 'swipe' && dismissedCount >= ITEMS_BEFORE_SORT) {
      // Transition remaining items to sort phase — position them above the grid
      const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
      const gridTopY = gridCells.length > 0 ? gridCells[0].y : 200;
      const aboveY = Math.max(80, gridTopY - 90);
      let sortIdx = 0;
      setItems(prev => prev.map(it => {
        if (it.phase !== 'swipe') return it;
        const col = sortIdx % 3;
        const spacing = Math.min(120, (vw - 60) / 3);
        const xPos = 30 + col * spacing;
        sortIdx++;
        return { ...it, phase: 'sort' as const, x: xPos, y: aboveY, rotation: randRange(-5, 5) };
      }));
      setGamePhase('sort');
      setTimeout(() => setGridVisible(true), 200);
    }
  }, [gamePhase, dismissedCount, gridCells]);

  useEffect(() => {
    if (gamePhase === 'sort' && placedCount === 6) {
      // Start reveal sequence
      setGamePhase('reveal');
      const t1 = setTimeout(() => setItemsOpacity(0.5), 0);
      const t2 = setTimeout(() => setGridOpacity(0), 500);
      const t3 = setTimeout(() => setItemsOpacity(0), 800);
      const t4 = setTimeout(() => {
        setShowFinalNotif(true);
        playRevealChord();
        try { navigator.vibrate([50, 30, 100]); } catch { /* noop */ }
        onRevealRef.current?.();
      }, 2000);
      const t5 = setTimeout(() => setShowFinalText(true), 3000);
      revealTimersRef.current.push(t1, t2, t3, t4, t5);
    }
  }, [gamePhase, placedCount, playRevealChord]);

  // ── Swipe handler ────────────────────────────────────────────────────

  const handleDragEnd = useCallback((itemId: number, _event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const vx = Math.abs(info.velocity.x);
    const vy = Math.abs(info.velocity.y);
    const ox = Math.abs(info.offset.x);
    const oy = Math.abs(info.offset.y);

    if (vx > SWIPE_THRESHOLD_VELOCITY || vy > SWIPE_THRESHOLD_VELOCITY ||
        ox > SWIPE_THRESHOLD_OFFSET || oy > SWIPE_THRESHOLD_OFFSET) {
      const count = dismissedCountRef.current;
      dismissedCountRef.current++;

      playWhoosh(count);
      if (count < 5) {
        try { navigator.vibrate(5); } catch { /* noop */ }
      } else if (count < 11) {
        try { navigator.vibrate(10); } catch { /* noop */ }
      } else {
        try { navigator.vibrate([10, 5, 15]); } catch { /* noop */ }
      }

      setItems(prev => prev.map(it =>
        it.id === itemId ? { ...it, phase: 'dismissed' as const } : it
      ));
    }
  }, [playWhoosh]);

  // ── Sort/snap handler ────────────────────────────────────────────────

  const handleSortDragEnd = useCallback((itemId: number, _event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    const item = items.find(it => it.id === itemId);
    if (!item || item.phase === 'placed') return;

    const curX = item.x + info.offset.x;
    const curY = item.y + info.offset.y;

    let bestCell = -1;
    let bestDist = Infinity;

    for (let ci = 0; ci < gridCells.length; ci++) {
      if (occupiedCells[ci] !== null) continue;
      const cell = gridCells[ci];
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      const dist = Math.sqrt((curX + 85 - cx) ** 2 + (curY + 35 - cy) ** 2);
      if (dist < bestDist) {
        bestDist = dist;
        bestCell = ci;
      }
    }

    if (bestCell >= 0 && bestDist < SNAP_DISTANCE) {
      const cell = gridCells[bestCell];
      playClick();
      try { navigator.vibrate(3); } catch { /* noop */ }

      setOccupiedCells(prev => {
        const next = [...prev];
        next[bestCell] = itemId;
        return next;
      });
      setItems(prev => prev.map(it =>
        it.id === itemId
          ? { ...it, phase: 'placed' as const, x: cell.x, y: cell.y, rotation: 0, snappedCell: bestCell }
          : it
      ));
    }
  }, [items, gridCells, occupiedCells, playClick]);

  // ── Cleanup ──────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  // ── Render item content ──────────────────────────────────────────────

  const renderItemContent = useCallback((item: ClutterItem) => {
    const isPlaced = item.phase === 'placed';
    const borderStyle = isPlaced ? '1px solid #E8E8E8' : undefined;

    const textClip: React.CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

    if (item.type === 'notification') {
      return (
        <div style={{
          background: 'white',
          padding: '12px 16px',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 100,
          maxWidth: 200,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, color: '#1A1A1A', fontWeight: 500, ...textClip }}>{item.text}</span>
        </div>
      );
    }

    if (item.type === 'tab') {
      return (
        <div style={{
          background: 'white',
          padding: '10px 14px',
          borderRadius: 10,
          minWidth: 100,
          maxWidth: 200,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4A90D9', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#666' }}>tab</span>
          </div>
          <span style={{ fontSize: 13, color: '#333', ...textClip, display: 'block' }}>{item.text}</span>
        </div>
      );
    }

    if (item.type === 'social') {
      return (
        <div style={{
          background: `linear-gradient(to right, rgba(${item.color === '#FF6B8A' ? '255,107,138' : item.color === '#4A90D9' ? '74,144,217' : item.color === '#28C840' ? '40,200,64' : '255,179,102'}, 0.08), white)`,
          padding: '12px 16px',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 100,
          maxWidth: 200,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
        }}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#1A1A1A', ...textClip }}>{item.text}</span>
        </div>
      );
    }

    // Loose items
    if (item.subtype === 'voice') {
      return (
        <div style={{
          background: '#2D2D2D',
          color: 'white',
          padding: '12px 16px',
          borderRadius: 12,
          width: 120,
          fontSize: 14,
          fontFamily: 'monospace',
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          ...textClip,
        }}>
          {item.text}
        </div>
      );
    }

    if (item.subtype === 'photo') {
      return (
        <div style={{
          width: 100,
          height: 80,
          backgroundColor: photoColorRef.current,
          borderRadius: 12,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
        }}>
          {/* Sun */}
          <div style={{
            position: 'absolute', top: 12, right: 16,
            width: 14, height: 14, borderRadius: '50%',
            backgroundColor: 'rgba(255,200,50,0.6)',
          }} />
          {/* Mountain */}
          <div style={{
            position: 'absolute', bottom: 0, left: 10,
            width: 0, height: 0,
            borderLeft: '25px solid transparent',
            borderRight: '25px solid transparent',
            borderBottom: '35px solid rgba(0,0,0,0.1)',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 35,
            width: 0, height: 0,
            borderLeft: '30px solid transparent',
            borderRight: '30px solid transparent',
            borderBottom: '45px solid rgba(0,0,0,0.08)',
          }} />
        </div>
      );
    }

    if (item.subtype === 'note') {
      return (
        <div style={{
          background: '#FFF9C4',
          padding: '12px 14px',
          borderRadius: 12,
          fontSize: 13,
          fontStyle: 'italic',
          color: '#333',
          minWidth: 100,
          maxWidth: 200,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          ...textClip,
        }}>
          {item.text}
        </div>
      );
    }

    // reminder
    return (
      <div style={{
        background: 'white',
        padding: '12px 14px',
        borderRadius: 12,
        fontSize: 13,
        color: '#1A1A1A',
        minWidth: 100,
        maxWidth: 200,
        boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
        border: borderStyle,
        borderLeftColor: '#FF5F57',
        borderLeftWidth: 3,
        borderLeftStyle: 'solid',
        ...textClip,
      }}>
        {item.text}
      </div>
    );
  }, []);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1000,
        backgroundColor: bg,
        transition: 'background-color 500ms ease',
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
        overscrollBehavior: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1020,
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: 'white',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: '#666',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Grid cells (sort phase) */}
      {gridVisible && gamePhase !== 'reveal' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: gridOpacity, transition: 'opacity 300ms ease' }}>
          {gridCells.map((cell, i) => (
            <div
              key={`cell-${i}`}
              style={{
                position: 'absolute',
                left: cell.x,
                top: cell.y,
                width: cell.w,
                height: cell.h,
                border: occupiedCells[i] !== null ? '2px solid transparent' : '2px dashed #E0E0E0',
                borderRadius: 14,
                transition: 'border-color 300ms ease',
              }}
            />
          ))}
        </div>
      )}

      {/* Reveal phase: grid fading */}
      {gamePhase === 'reveal' && gridVisible && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: gridOpacity, transition: 'opacity 300ms ease' }}>
          {gridCells.map((cell, i) => (
            <div
              key={`cell-r-${i}`}
              style={{
                position: 'absolute',
                left: cell.x,
                top: cell.y,
                width: cell.w,
                height: cell.h,
                border: '2px dashed #E0E0E0',
                borderRadius: 14,
              }}
            />
          ))}
        </div>
      )}

      {/* Swipe phase items */}
      <AnimatePresence>
        {gamePhase === 'swipe' && activeItems.filter(it => it.phase === 'swipe').map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 0.8, x: item.x, y: item.y, rotate: item.rotation }}
            animate={{ opacity: 1, scale: 1, x: item.x, y: item.y, rotate: item.rotation }}
            exit={{
              opacity: 0,
              transition: { duration: 0.3, ease: 'easeIn' },
            }}
            transition={{ delay: item.delay / 1000, duration: 0.4, ease: 'easeOut' }}
            drag
            dragMomentum={false}
            onDragEnd={(e, info) => handleDragEnd(item.id, e as PointerEvent, info)}
            style={{
              position: 'absolute',
              zIndex: item.zIndex,
              touchAction: 'none',
              cursor: 'grab',
              maxWidth: 200,
              ...DRAG_ITEM_STYLE,
            }}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
          >
            {renderItemContent(item)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Sort phase items */}
      {(gamePhase === 'sort' || gamePhase === 'reveal') && sortItems.map(item => {
        const isPlaced = item.phase === 'placed';
        return (
          <motion.div
            key={item.id}
            initial={gamePhase === 'sort' ? { scale: 1 } : false}
            animate={{
              x: item.x,
              y: item.y,
              rotate: item.rotation,
              scale: isPlaced ? 1 : [1, 1.05, 1],
              opacity: itemsOpacity,
            }}
            transition={isPlaced
              ? { type: 'spring', stiffness: 300, damping: 25, opacity: { duration: 0.4, ease: 'easeOut' } }
              : { scale: { duration: 0.4, repeat: 0 }, opacity: { duration: 0.4, ease: 'easeOut' } }
            }
            drag={!isPlaced && gamePhase === 'sort'}
            dragMomentum={false}
            onDragEnd={(e, info) => handleSortDragEnd(item.id, e as PointerEvent, info)}
            style={{
              position: 'absolute',
              zIndex: isPlaced ? 5 : item.zIndex + 20,
              touchAction: 'none',
              cursor: isPlaced ? 'default' : 'grab',
              maxWidth: 200,
              ...DRAG_ITEM_STYLE,
            }}
            whileDrag={!isPlaced ? { scale: 1.05, cursor: 'grabbing' } : undefined}
          >
            {renderItemContent(item)}
          </motion.div>
        );
      })}

      {/* Final notification */}
      <AnimatePresence>
        {showFinalNotif && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              zIndex: 30,
              padding: 32,
              pointerEvents: 'none',
            }}
          >
            <div style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: 16,
              boxShadow: '0 8px 30px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              maxWidth: 'calc(100vw - 64px)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#28C840', flexShrink: 0 }} />
              <span style={{ fontSize: 15, color: '#1A1A1A', fontWeight: 500, whiteSpace: 'nowrap' }}>
                new message: hey, you free?
              </span>
            </div>
            {showFinalText && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: '#999',
                  fontWeight: 400,
                  fontStyle: 'italic',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                now close this app too.
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
