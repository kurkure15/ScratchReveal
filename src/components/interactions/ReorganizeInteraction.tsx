import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'motion/react';
import poemBgTexture from '../../assets/PoemBG.svg';

// ── Types ────────────────────────────────────────────────────────────────

interface ReorganizeProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

type ItemPhase = 'swipe' | 'sort' | 'placed' | 'dismissed';
type ItemType = 'notification' | 'tab' | 'social' | 'loose' | 'clothes' | 'papers';

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
];

const TAB_TEXTS = [
  'how to center a div',
  'am I lactose intolerant quiz',
  'flights to bali one way',
];

const SOCIAL_TEXTS = [
  'liked your photo from 2019',
  'your ex started a podcast',
  'new follower: your_mom_42',
];

const CLOTHES_COLORS = {
  tshirt: ['#4A90D9', '#E63946', '#2D6A4F', '#FFB366'],
  sock: ['#FFFFFF', '#333333', '#FF6B8A', '#4A90D9'],
};
const STICKY_COLORS = ['#FFF9C4', '#FFCCBC', '#C8E6C9', '#BBDEFB'];
const STICKY_TEXTS = ['remember!', 'call back', 'buy milk', '!!!'];

const DOT_COLORS = ['#FF5F57', '#4A90D9', '#28C840', '#FFB366'];
const AVATAR_COLORS = ['#FF6B8A', '#4A90D9', '#28C840', '#FFB366'];

const SWIPE_THRESHOLD_VELOCITY = 300;
const SWIPE_THRESHOLD_OFFSET = 80;
const ITEM_FRAME_SIZE = 104;
const SNAP_DISTANCE = 84;
const SNAP_MARGIN_X = 28;
const SNAP_MARGIN_Y = 32;
const GRID_ZONE_FALLBACK_MARGIN = 84;
const ITEMS_BEFORE_SORT = 12;
const POEM_BG = '#F6EBD9';
const POEM_TEXT = '#766E60';
const POEM_DIVIDER = '#CAB78E';
const POEM_TITLE = 'A Noiseless Patient Spider';
const POEM_AUTHOR = 'Walt Whitman';
const POEM_BODY = `A noiseless patient spider,
I mark’d where on a little promontory it stood isolated,
Mark’d how to explore the vacant vast surrounding,
It launch’d forth filament, filament, filament, out of itself,
Ever unreeling them, ever tirelessly speeding them.

And you O my soul where you stand,
Surrounded, detached, in measureless oceans of space,
Ceaselessly musing, venturing, throwing, seeking the spheres
to connect them,
Till the bridge you will need be form’d, till the ductile anchor hold,
Till the gossamer thread you fling catch somewhere, O my
soul`;

// ── Helpers ──────────────────────────────────────────────────────────────

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function bgForProgress(cleared: number, total: number): string {
  void cleared;
  void total;
  return POEM_BG;
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
  const usableW = vw - padX * 2 - ITEM_FRAME_SIZE;
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
      x: Math.max(padX, Math.min(vw - ITEM_FRAME_SIZE - padX, padX + slot.col * cellW + randRange(-jitter, jitter))),
      y: Math.max(padTop, Math.min(vh - padBottom, padTop + slot.row * cellH + randRange(-jitter, jitter))),
    };
  }

  // Notifications (4)
  for (let i = 0; i < 4; i++) {
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

  // Tabs (3)
  for (let i = 0; i < 3; i++) {
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

  // Social (3)
  for (let i = 0; i < 3; i++) {
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

  // Clothes (4)
  const clothesSubtypes = ['tshirt', 'sock', 'pants', 'hat'] as const;
  for (let i = 0; i < 4; i++) {
    const pos = nextPos();
    const subtype = clothesSubtypes[i];
    let color: string;
    if (subtype === 'tshirt') color = CLOTHES_COLORS.tshirt[Math.floor(Math.random() * CLOTHES_COLORS.tshirt.length)];
    else if (subtype === 'sock') color = CLOTHES_COLORS.sock[Math.floor(Math.random() * CLOTHES_COLORS.sock.length)];
    else if (subtype === 'pants') color = '#2C3E6B';
    else color = '#333333';
    items.push({
      id: id++,
      type: 'clothes',
      subtype,
      text: '',
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color,
    });
  }

  // Papers (4)
  const papersSubtypes = ['crumpled', 'receipt', 'envelope', 'sticky'] as const;
  for (let i = 0; i < 4; i++) {
    const pos = nextPos();
    const subtype = papersSubtypes[i];
    let color: string;
    if (subtype === 'sticky') color = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
    else if (subtype === 'crumpled') color = '#FFF9C4';
    else if (subtype === 'envelope') color = '#F5F0EB';
    else color = '#FFFFFF';
    items.push({
      id: id++,
      type: 'papers',
      subtype,
      text: subtype === 'sticky' ? STICKY_TEXTS[Math.floor(Math.random() * STICKY_TEXTS.length)] : '',
      x: pos.x,
      y: pos.y,
      rotation: randRange(-15, 15),
      zIndex: Math.floor(randRange(1, 20)),
      phase: 'swipe',
      delay: randRange(0, 800),
      color,
    });
  }

  return items;
}

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
  const [showPoem, setShowPoem] = useState(false);
  const [occupiedCells, setOccupiedCells] = useState<(number | null)[]>([null, null, null, null, null, null]);
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [swipeHintFading, setSwipeHintFading] = useState(false);
  const [showSortHeading, setShowSortHeading] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const dismissedCountRef = useRef(0);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;
  const revealTimersRef = useRef<number[]>([]);
  const sortItemRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const swipeHintDismissedRef = useRef(false);

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

  // ── Theme-color helper ───────────────────────────────────────────────
  const origThemeRef = useRef<string | null>(null);
  const origDocBgRef = useRef<string>('');
  const themeMetaRef = useRef<HTMLMetaElement | null>(null);

  const updateThemeColor = useCallback((color: string) => {
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
      || document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', color);
    if (!meta.parentNode) document.head.appendChild(meta);
    themeMetaRef.current = meta;
  }, []);

  // ── Status bar bleed: mount/unmount ──────────────────────────────────
  useEffect(() => {
    origDocBgRef.current = document.documentElement.style.backgroundColor;
    const existingMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    origThemeRef.current = existingMeta?.getAttribute('content') ?? null;

    document.documentElement.style.backgroundColor = POEM_BG;
    updateThemeColor(POEM_BG);

    return () => {
      document.documentElement.style.backgroundColor = origDocBgRef.current;
      if (origThemeRef.current !== null) {
        updateThemeColor(origThemeRef.current);
      } else if (themeMetaRef.current?.parentNode) {
        themeMetaRef.current.parentNode.removeChild(themeMetaRef.current);
      }
    };
  }, [updateThemeColor]);

  // ── Swipe hint timer ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!swipeHintDismissedRef.current) {
        setShowSwipeHint(true);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showPoem) return;
    updateThemeColor(POEM_BG);
  }, [showPoem, updateThemeColor]);

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
  const isDesktopLayout = typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;

  // ── Grid cell positions ──────────────────────────────────────────────

  const dragLayout = useMemo(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 375;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
    const desktop = vw >= 1024;
    const colGap = 40;
    const rowGap = 32;
    const cols = desktop ? 3 : 2;
    const rows = desktop ? 2 : 3;
    const cellSize = desktop ? 200 : ITEM_FRAME_SIZE;
    const radius = desktop ? 30.822 : 16;
    const borderWidth = desktop ? 2.89 : 1.5;
    const plusSize = desktop ? 46.232 : 24;
    const totalW = cols * cellSize + (cols - 1) * colGap;
    const totalH = rows * cellSize + (rows - 1) * rowGap;
    const startX = (vw - totalW) / 2;
    const startY = (vh - totalH) / 2;

    const cells: Array<{ x: number; y: number; w: number; h: number; radius: number }> = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        cells.push({
          x: startX + col * (cellSize + colGap),
          y: startY + row * (cellSize + rowGap),
          w: cellSize,
          h: cellSize,
          radius,
        });
      }
    }
    return {
      desktop,
      cells,
      borderWidth,
      plusSize,
      footerBottom: desktop ? 109.52 : 69,
      footerWidth: desktop ? 288 : 153,
      footerTitleSize: desktop ? 29.737 : 16,
      footerSubtitleSize: desktop ? 18.586 : 10,
      poemBodySize: desktop ? 25 : 18,
      poemPanelWidth: desktop ? 559 : 352,
      poemTitleSize: 24,
      poemAuthorSize: 12,
      dividerWidths: desktop ? [68, 94, 32] : [44, 88, 44],
    };
  }, [isDesktopLayout]);

  const gridCells = dragLayout.cells;

  // ── Phase transitions ────────────────────────────────────────────────

  useEffect(() => {
    if (gamePhase === 'swipe' && dismissedCount >= ITEMS_BEFORE_SORT) {
      // Transition remaining items to sort phase — position them above the grid
      const gridTopY = gridCells.length > 0 ? Math.min(...gridCells.map(cell => cell.y)) : 200;
      const gridLeftX = gridCells.length > 0 ? Math.min(...gridCells.map(cell => cell.x)) : 24;
      const gridRightX = gridCells.length > 0 ? Math.max(...gridCells.map(cell => cell.x + cell.w)) : 351;
      const columns = 3;
      const itemGap = 20;
      const itemBandWidth = columns * ITEM_FRAME_SIZE + (columns - 1) * itemGap;
      const startX = gridLeftX + Math.max(0, (gridRightX - gridLeftX - itemBandWidth) / 2);
      const aboveY = Math.max(72, gridTopY - (dragLayout.desktop ? 168 : 122));
      let sortIdx = 0;
      setItems(prev => prev.map(it => {
        if (it.phase !== 'swipe') return it;
        const col = sortIdx % columns;
        const row = Math.floor(sortIdx / columns);
        const xPos = startX + col * (ITEM_FRAME_SIZE + itemGap) + randRange(-6, 6);
        const yPos = aboveY - row * (dragLayout.desktop ? 76 : 66) + randRange(-6, 6);
        sortIdx++;
        return { ...it, phase: 'sort' as const, x: xPos, y: yPos, rotation: randRange(-8, 8) };
      }));
      setGamePhase('sort');
      updateThemeColor(POEM_BG);
      setTimeout(() => {
        setGridVisible(true);
        setShowSortHeading(true);
      }, 200);
    }
  }, [gamePhase, dismissedCount, gridCells, dragLayout.desktop, updateThemeColor]);

  useEffect(() => {
    if (gamePhase === 'sort' && placedCount === 6) {
      // Start reveal sequence
      setGamePhase('reveal');
      setShowPoem(false);
      setShowSortHeading(false);
      updateThemeColor(POEM_BG);
      document.documentElement.style.backgroundColor = POEM_BG;
      const t1 = setTimeout(() => setItemsOpacity(0.5), 0);
      const t2 = setTimeout(() => setGridOpacity(0), 500);
      const t3 = setTimeout(() => setItemsOpacity(0), 800);
      const t4 = setTimeout(() => {
        setShowPoem(true);
        playRevealChord();
        try { navigator.vibrate([50, 30, 100]); } catch { /* noop */ }
        onRevealRef.current?.();
      }, 1400);
      revealTimersRef.current.push(t1, t2, t3, t4);
    }
  }, [gamePhase, placedCount, playRevealChord, updateThemeColor]);

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

      // Dismiss swipe hint after 2 swipes
      if (count + 1 >= 2 && !swipeHintDismissedRef.current) {
        swipeHintDismissedRef.current = true;
        setSwipeHintFading(true);
        setTimeout(() => setShowSwipeHint(false), 300);
      }

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
    if (gridCells.length === 0) return;

    const curX = item.x + info.offset.x;
    const curY = item.y + info.offset.y;
    const itemRect = sortItemRefs.current[itemId]?.getBoundingClientRect();
    const itemWidth = itemRect?.width ?? ITEM_FRAME_SIZE;
    const itemHeight = itemRect?.height ?? ITEM_FRAME_SIZE;
    const centerX = curX + itemWidth / 2;
    const centerY = curY + itemHeight / 2;

    const emptyCells = gridCells
      .map((cell, index) => ({ cell, index }))
      .filter(({ index }) => occupiedCells[index] === null);
    if (emptyCells.length === 0) return;

    const snapDistance = Math.max(SNAP_DISTANCE, Math.round((gridCells[0]?.w ?? ITEM_FRAME_SIZE) * 0.75));
    const gridZoneMargin = Math.max(GRID_ZONE_FALLBACK_MARGIN, Math.round((gridCells[0]?.h ?? ITEM_FRAME_SIZE) * 0.6));
    const gridTop = Math.min(...gridCells.map(cell => cell.y));
    const gridBottom = Math.max(...gridCells.map(cell => cell.y + cell.h));
    const isNearGridZone = centerY >= gridTop - gridZoneMargin &&
      centerY <= gridBottom + gridZoneMargin;

    let expandedCandidate: { index: number; centerDist: number } | null = null;
    let nearestByEdge: { index: number; edgeDist: number } | null = null;
    let nearestByCenter: { index: number; centerDist: number } | null = null;

    for (const { cell, index } of emptyCells) {
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;

      const dx = Math.abs(centerX - cx);
      const dy = Math.abs(centerY - cy);
      const centerDist = Math.hypot(dx, dy);

      const expandedDx = Math.max(dx - (cell.w / 2 + SNAP_MARGIN_X), 0);
      const expandedDy = Math.max(dy - (cell.h / 2 + SNAP_MARGIN_Y), 0);
      const withinExpandedBounds = expandedDx === 0 && expandedDy === 0;

      const edgeDx = Math.max(dx - cell.w / 2, 0);
      const edgeDy = Math.max(dy - cell.h / 2, 0);
      const edgeDist = Math.hypot(edgeDx, edgeDy);

      if (!nearestByCenter || centerDist < nearestByCenter.centerDist) {
        nearestByCenter = { index, centerDist };
      }
      if (!nearestByEdge || edgeDist < nearestByEdge.edgeDist) {
        nearestByEdge = { index, edgeDist };
      }
      if (withinExpandedBounds &&
        (!expandedCandidate || centerDist < expandedCandidate.centerDist)) {
        expandedCandidate = { index, centerDist };
      }
    }

    let targetCell = -1;
    if (expandedCandidate) {
      targetCell = expandedCandidate.index;
    } else if (nearestByEdge && nearestByEdge.edgeDist <= snapDistance) {
      targetCell = nearestByEdge.index;
    } else if (isNearGridZone && nearestByCenter) {
      // If the drop ends near the sorting grid, still attach to the nearest free cell.
      targetCell = nearestByCenter.index;
    }

    if (targetCell < 0) return;

    const cell = gridCells[targetCell];
    const snapX = cell.x + (cell.w - itemWidth) / 2;
    const snapY = cell.y + (cell.h - itemHeight) / 2;
    playClick();
    try { navigator.vibrate(3); } catch { /* noop */ }

    setOccupiedCells(prev => {
      const next = [...prev];
      next[targetCell] = itemId;
      return next;
    });
    setItems(prev => prev.map(it =>
      it.id === itemId
        ? { ...it, phase: 'placed' as const, x: snapX, y: snapY, rotation: 0, snappedCell: targetCell }
        : it
    ));
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
          width: '100%',
          height: '100%',
          padding: '10px',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 8,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: '#1A1A1A', fontWeight: 500, lineHeight: 1.3, width: '100%', ...textClip }}>{item.text}</span>
        </div>
      );
    }

    if (item.type === 'tab') {
      return (
        <div style={{
          background: 'white',
          width: '100%',
          height: '100%',
          padding: '8px 10px',
          borderRadius: 16,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#4A90D9', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#666' }}>tab</span>
          </div>
          <span style={{ fontSize: 12, color: '#333', ...textClip, display: 'block', lineHeight: 1.3 }}>{item.text}</span>
        </div>
      );
    }

    if (item.type === 'social') {
      return (
        <div style={{
          background: `linear-gradient(to right, rgba(${item.color === '#FF6B8A' ? '255,107,138' : item.color === '#4A90D9' ? '74,144,217' : item.color === '#28C840' ? '40,200,64' : '255,179,102'}, 0.08), white)`,
          width: '100%',
          height: '100%',
          padding: '10px',
          borderRadius: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 8,
          boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
          border: borderStyle,
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#1A1A1A', ...textClip, lineHeight: 1.3, width: '100%' }}>{item.text}</span>
        </div>
      );
    }

    // ── Clothes ──────────────────────────────────────────────────────
    if (item.type === 'clothes') {
      if (item.subtype === 'tshirt') {
        return (
          <div style={{
            width: 82,
            height: 92,
            backgroundColor: item.color,
            clipPath: 'polygon(20% 0%, 0% 25%, 15% 25%, 15% 100%, 85% 100%, 85% 25%, 100% 25%, 80% 0%)',
            boxShadow: isPlaced ? 'none' : 'inset 0 2px 4px rgba(0,0,0,0.1)',
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }} />
        );
      }
      if (item.subtype === 'sock') {
        const stripeColor = item.color === '#FFFFFF' || item.color === '#FF6B8A' ? '#333333' : '#FFFFFF';
        return (
          <div style={{
            width: 45,
            height: 80,
            backgroundColor: item.color,
            borderRadius: '40% 40% 50% 50%',
            position: 'relative',
            overflow: 'hidden',
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }}>
            <div style={{ position: 'absolute', left: '10%', right: '10%', top: '30%', height: 2, backgroundColor: stripeColor, opacity: 0.5 }} />
            <div style={{ position: 'absolute', left: '10%', right: '10%', top: '50%', height: 2, backgroundColor: stripeColor, opacity: 0.5 }} />
          </div>
        );
      }
      if (item.subtype === 'pants') {
        return (
          <div style={{
            width: 78,
            height: 94,
            backgroundColor: item.color,
            clipPath: 'polygon(10% 0%, 90% 0%, 85% 100%, 55% 100%, 50% 60%, 45% 100%, 15% 100%)',
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }} />
        );
      }
      // hat
      return (
        <div style={{ position: 'relative', width: 74, height: 56, filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))' }}>
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 74,
            height: 18,
            borderRadius: '50%',
            backgroundColor: item.color,
          }} />
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            width: 56,
            height: 36,
            borderRadius: '50% 50% 0 0',
            backgroundColor: item.color,
          }} />
        </div>
      );
    }

    // ── Papers ─────────────────────────────────────────────────────
    if (item.type === 'papers') {
      if (item.subtype === 'crumpled') {
        return (
          <div style={{
            width: 80,
            height: 70,
            backgroundColor: '#FFF9C4',
            borderRadius: '30% 70% 60% 40% / 50% 40% 70% 60%',
            background: 'linear-gradient(135deg, rgba(0,0,0,0.05) 0%, transparent 50%, rgba(0,0,0,0.03) 100%), #FFF9C4',
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }} />
        );
      }
      if (item.subtype === 'receipt') {
        return (
          <div style={{
            width: 56,
            height: 94,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E0E0E0',
            borderBottom: '2px dashed #E0E0E0',
            padding: '8px 7px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }}>
            <div style={{ width: '90%', height: 2, backgroundColor: '#E0E0E0' }} />
            <div style={{ width: '70%', height: 2, backgroundColor: '#E0E0E0' }} />
            <div style={{ width: '85%', height: 2, backgroundColor: '#E0E0E0' }} />
            <div style={{ width: '60%', height: 2, backgroundColor: '#E0E0E0' }} />
            <div style={{ width: '75%', height: 2, backgroundColor: '#E0E0E0' }} />
          </div>
        );
      }
      if (item.subtype === 'envelope') {
        return (
          <div style={{
            width: 88,
            height: 62,
            backgroundColor: '#F5F0EB',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '2px solid rgba(0,0,0,0.06)',
            filter: isPlaced ? 'none' : 'drop-shadow(0 2px 8px rgba(0,0,0,0.12))',
          }}>
            {/* V-shape flap */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 0,
              height: 0,
              borderLeft: '44px solid #EBE5DD',
              borderRight: '44px solid #EBE5DD',
              borderBottom: '24px solid transparent',
            }} />
          </div>
        );
      }
      // sticky note
      return (
        <div style={{
          width: 80,
          height: 80,
          backgroundColor: item.color,
          position: 'relative',
          boxShadow: isPlaced ? 'none' : '3px 3px 6px rgba(0,0,0,0.1)',
        }}>
          <span style={{
            position: 'absolute',
            top: 12,
            left: 8,
            fontSize: 10,
            color: 'rgba(0,0,0,0.4)',
            fontStyle: 'italic',
          }}>
            {item.text}
          </span>
          {/* Curled corner */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.06) 50%)',
          }} />
        </div>
      );
    }

    // Fallback for any remaining loose items
    return (
      <div style={{
        background: 'white',
        width: '100%',
        height: '100%',
        padding: '10px',
        borderRadius: 16,
        fontSize: 12,
        color: '#1A1A1A',
        display: 'flex',
        alignItems: 'center',
        boxShadow: isPlaced ? 'none' : '0 2px 12px rgba(0,0,0,0.1)',
        border: borderStyle,
        boxSizing: 'border-box',
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
        zIndex: 1000,
        backgroundColor: bg,
        backgroundImage: `url(${poemBgTexture})`,
        backgroundSize: 'auto',
        backgroundPosition: 'top left',
        backgroundRepeat: 'repeat',
        transition: 'background-color 500ms ease',
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflow: 'hidden',
        overscrollBehavior: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        touchAction: gamePhase === 'reveal' ? 'pan-y' : 'none',
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
          top: 'max(env(safe-area-inset-top), 16px)',
          right: 'max(env(safe-area-inset-right), 16px)',
          zIndex: 1020,
          width: 40,
          height: 40,
          borderRadius: '50%',
          backgroundColor: showPoem ? 'rgba(246, 235, 217, 0.88)' : 'white',
          border: showPoem ? '1px solid rgba(118,110,96,0.24)' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          color: showPoem ? POEM_TEXT : '#666',
          cursor: 'pointer',
          boxShadow: showPoem ? 'none' : '0 4px 15px rgba(0,0,0,0.15)',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Sort footer copy */}
      {showSortHeading && gamePhase === 'sort' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            bottom: `calc(${dragLayout.footerBottom}px + env(safe-area-inset-bottom))`,
            left: '50%',
            transform: 'translateX(-50%)',
            width: dragLayout.footerWidth,
            textAlign: 'center',
            color: '#AF9771',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span
            style={{
              fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif",
              fontSize: dragLayout.footerTitleSize,
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            drag and drop items
          </span>
          <span
            style={{
              fontSize: dragLayout.footerSubtitleSize,
              lineHeight: 1.5,
              fontWeight: 400,
            }}
          >
            Let&apos;s clean up
          </span>
        </motion.div>
      )}

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
                border: occupiedCells[i] !== null
                  ? `${dragLayout.borderWidth}px solid rgba(118,110,96,0.2)`
                  : `${dragLayout.borderWidth}px dashed rgba(118,110,96,0.3)`,
                borderRadius: cell.radius,
                backgroundColor: 'transparent',
                transition: 'border-color 300ms ease',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              {occupiedCells[i] === null && (
                <span
                  style={{
                    fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif",
                    fontSize: dragLayout.plusSize,
                    lineHeight: 1,
                    fontWeight: 400,
                    color: 'rgba(118,110,96,0.3)',
                  }}
                >
                  +
                </span>
              )}
            </div>
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
                border: `${dragLayout.borderWidth}px dashed rgba(118,110,96,0.3)`,
                borderRadius: cell.radius,
                backgroundColor: 'transparent',
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
              width: ITEM_FRAME_SIZE,
              height: ITEM_FRAME_SIZE,
              overflow: 'hidden',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...DRAG_ITEM_STYLE,
            }}
            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
          >
            {renderItemContent(item)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Swipe to clear hint */}
      {showSwipeHint && gamePhase === 'swipe' && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 14,
            fontWeight: 400,
            color: '#AAA',
            letterSpacing: 0.5,
            zIndex: 25,
            pointerEvents: 'none',
            opacity: swipeHintFading ? 0 : undefined,
            transition: swipeHintFading ? 'opacity 300ms ease' : undefined,
            animation: swipeHintFading ? undefined : 'swipe-hint-fadein 600ms ease forwards, swipe-hint-sway 2s 600ms ease-in-out infinite',
          }}
        >
          swipe to clear
        </div>
      )}

      {/* Sort phase items */}
      {(gamePhase === 'sort' || gamePhase === 'reveal') && sortItems.map(item => {
        const isPlaced = item.phase === 'placed';
        return (
          <motion.div
            key={item.id}
            ref={(node) => {
              sortItemRefs.current[item.id] = node;
            }}
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
              width: ITEM_FRAME_SIZE,
              height: ITEM_FRAME_SIZE,
              overflow: 'hidden',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              ...DRAG_ITEM_STYLE,
            }}
            whileDrag={!isPlaced ? { scale: 1.05, cursor: 'grabbing' } : undefined}
          >
            {renderItemContent(item)}
          </motion.div>
        );
      })}

      {/* Closing note reveal */}
      <AnimatePresence>
        {showPoem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'stretch',
              justifyContent: 'center',
              zIndex: 30,
              backgroundColor: POEM_BG,
              backgroundImage: `url(${poemBgTexture})`,
              backgroundSize: 'auto',
              backgroundPosition: 'top left',
              backgroundRepeat: 'repeat',
              overflowY: 'auto',
              touchAction: 'pan-y',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: dragLayout.desktop ? 'none' : 393,
                margin: '0 auto',
                textAlign: 'center',
                color: POEM_TEXT,
                paddingTop: dragLayout.desktop
                  ? 'max(env(safe-area-inset-top), 24px)'
                  : 'max(env(safe-area-inset-top), 44px)',
                paddingRight: dragLayout.desktop
                  ? 'max(env(safe-area-inset-right), 24px)'
                  : 'max(env(safe-area-inset-right), 20px)',
                paddingBottom: dragLayout.desktop
                  ? 'max(env(safe-area-inset-bottom), 24px)'
                  : 'max(env(safe-area-inset-bottom), 28px)',
                paddingLeft: dragLayout.desktop
                  ? 'max(env(safe-area-inset-left), 24px)'
                  : 'max(env(safe-area-inset-left), 20px)',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: dragLayout.desktop ? 'center' : 'space-between',
                minHeight: '100dvh',
              }}
            >
              <div
                style={dragLayout.desktop
                  ? {
                    width: dragLayout.poemPanelWidth,
                    margin: '0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 32,
                    alignItems: 'center',
                  }
                  : { width: '100%' }}
              >
                <div
                  style={dragLayout.desktop
                    ? {
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 64,
                      alignItems: 'center',
                    }
                    : { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 28 }}
                >
                  <p
                    style={{
                      margin: 0,
                      width: '100%',
                      maxWidth: dragLayout.poemPanelWidth,
                      fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif",
                      fontSize: dragLayout.poemBodySize,
                      lineHeight: 1.5,
                      fontWeight: 400,
                      whiteSpace: 'pre-line',
                      textAlign: 'center',
                    }}
                  >
                    {POEM_BODY}
                  </p>
                  {dragLayout.desktop && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                      {dragLayout.dividerWidths.map((w, idx) => (
                        <span key={`poem-divider-desktop-${idx}`} style={{ width: w, height: 1, backgroundColor: POEM_DIVIDER, opacity: 0.9 }} />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ width: dragLayout.desktop ? 207 : '100%', paddingTop: dragLayout.desktop ? 0 : 24 }}>
                  {!dragLayout.desktop && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, marginBottom: 18 }}>
                      {dragLayout.dividerWidths.map((w, idx) => (
                        <span key={`poem-divider-mobile-${idx}`} style={{ width: w, height: 1, backgroundColor: POEM_DIVIDER, opacity: 0.9 }} />
                      ))}
                    </div>
                  )}
                  <p
                    style={{
                      margin: 0,
                      fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif",
                      fontSize: dragLayout.poemTitleSize,
                      lineHeight: 1.2,
                      color: '#151515',
                    }}
                  >
                    {POEM_TITLE}
                  </p>
                  <p
                    style={{
                      margin: '2px 0 0',
                      fontFamily: "'Instrument Serif', 'Iowan Old Style', Georgia, serif",
                      fontSize: dragLayout.poemAuthorSize,
                      lineHeight: 1.4,
                      color: '#151515',
                    }}
                  >
                    {POEM_AUTHOR}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes swipe-hint-fadein {
          from { opacity: 0; }
          to { opacity: 0.5; }
        }
        @keyframes swipe-hint-sway {
          0%, 100% { transform: translateX(-50%); }
          50% { transform: translateX(calc(-50% + 5px)); }
        }
      `}</style>
    </motion.div>
  );
}
