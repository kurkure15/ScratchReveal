import { useState, useCallback, useMemo, useEffect, useRef, type WheelEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Stack from './components/Stack';
import Card from './components/Card';
import ScrollInteraction from './components/interactions/ScrollInteraction';
import ComingSoonInteraction from './components/interactions/ComingSoonInteraction';
import VibeCodingInteraction from './components/interactions/VibeCodingInteraction';
import ReorganizeInteraction from './components/interactions/ReorganizeInteraction';
import { cards, type CardData } from './data/cards';
import scrollPreviewBg from './assets/Scroll.svg';

const SOLVED_STORAGE_KEY = 'solvedCards';
const DESKTOP_BREAKPOINT = 1024;
const DESKTOP_CARD_WIDTH = 300;
const DESKTOP_CARD_HEIGHT = 380;
const DESKTOP_CARD_GAP = 24;
const DESKTOP_CARD_SPACING = DESKTOP_CARD_WIDTH + DESKTOP_CARD_GAP;
const DESKTOP_HOVER_SCALE = 1.18;
const DESKTOP_DEFAULT_TOP_RATIO = 628 / 1024;
const DESKTOP_FEATURED_CARD_IDS = ['3', '2', '1'] as const;

type DesktopRailItem = { kind: 'card'; id: string; card: CardData };

const SCROLL_LETTERS = [
  { char: 'S', top: 9.02, left: 26.12 },
  { char: 'C', top: 71.02, left: 24.12 },
  { char: 'R', top: 133.02, left: 26.12 },
  { char: 'O', top: 195.02, left: 23.62 },
  { char: 'L', top: 257.02, left: 27.12 },
  { char: 'L', top: 319.02, left: 27.12 },
];

function useCardSize() {
  return useMemo(
    () => ({
      width: DESKTOP_CARD_WIDTH,
      height: DESKTOP_CARD_HEIGHT,
    }),
    []
  );
}

function useViewportSize() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 1024,
  }));

  useEffect(() => {
    const onResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

function ScrollPreviewCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'transparent',
        borderTop: '3px solid #2E84FF',
        userSelect: 'none',
      }}
    >
      <img
        src={scrollPreviewBg}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      {SCROLL_LETTERS.map((letter, index) => (
        <p
          key={`${letter.char}-${index}`}
          style={{
            position: 'absolute',
            left: letter.left,
            top: letter.top,
            margin: 0,
            color: '#FFFFFF',
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1.5,
            textShadow: '0px 3px 10px rgba(0,0,0,0.37)',
          }}
        >
          {letter.char}
        </p>
      ))}
    </div>
  );
}

function App() {
  const viewport = useViewportSize();
  const isDesktop = viewport.width >= DESKTOP_BREAKPOINT;
  const cardSize = useCardSize();

  const [activeScratchCard, setActiveScratchCard] = useState<CardData | null>(null);
  const [solvedCardIds, setSolvedCardIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(SOLVED_STORAGE_KEY);
      if (!stored) return new Set();

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return new Set();

      const validCardIds = new Set(cards.map((card) => card.id));
      const restored = new Set<string>();
      parsed.forEach((id) => {
        if (typeof id === 'string' && validCardIds.has(id)) {
          restored.add(id);
        }
      });
      return restored;
    } catch {
      return new Set();
    }
  });

  const [desktopOffset, setDesktopOffset] = useState(0);
  const [desktopPointer, setDesktopPointer] = useState<{ x: number; y: number } | null>(null);
  const [isDesktopWheelActive, setIsDesktopWheelActive] = useState(false);
  const wheelRafRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const wheelIdleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      if (wheelIdleTimeoutRef.current !== null) {
        window.clearTimeout(wheelIdleTimeoutRef.current);
        wheelIdleTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || activeScratchCard) {
      setDesktopPointer(null);
      setIsDesktopWheelActive(false);
    }
  }, [isDesktop, activeScratchCard]);

  const cardById = useMemo(() => {
    const map = new Map<string, CardData>();
    cards.forEach((card) => map.set(card.id, card));
    return map;
  }, []);

  const desktopCards = useMemo(() => {
    const visibleMobileCards = cards;
    const visibleIds = visibleMobileCards.map((card) => card.id);
    const extras = visibleIds.filter((id) => !DESKTOP_FEATURED_CARD_IDS.includes(id as typeof DESKTOP_FEATURED_CARD_IDS[number]));
    const leftExtras = extras.filter((_, index) => index % 2 === 0);
    const rightExtras = extras.filter((_, index) => index % 2 === 1);
    const orderedIds = [...leftExtras.reverse(), ...DESKTOP_FEATURED_CARD_IDS, ...rightExtras];

    return orderedIds
      .map((id) => cardById.get(id))
      .filter((card): card is CardData => Boolean(card));
  }, [cardById]);

  const desktopRail = useMemo<DesktopRailItem[]>(() => {
    const rail: DesktopRailItem[] = [];
    desktopCards.forEach((card) => rail.push({ kind: 'card', id: card.id, card }));
    return rail;
  }, [desktopCards]);

  const desktopCenterIndex = useMemo(() => {
    const vibeIndex = desktopRail.findIndex((entry) => entry.kind === 'card' && entry.id === '2');
    return vibeIndex >= 0 ? vibeIndex : 0;
  }, [desktopRail]);

  const desktopLoopSpan = desktopRail.length * DESKTOP_CARD_SPACING;

  const handleDesktopWheel = useCallback((event: WheelEvent<HTMLDivElement>) => {
    if (!isDesktop || desktopLoopSpan === 0 || activeScratchCard) return;

    event.preventDefault();

    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;
    if (!Number.isFinite(dominantDelta) || dominantDelta === 0) return;

    setDesktopPointer(null);
    if (!isDesktopWheelActive) {
      setIsDesktopWheelActive(true);
    }
    if (wheelIdleTimeoutRef.current !== null) {
      window.clearTimeout(wheelIdleTimeoutRef.current);
    }
    wheelIdleTimeoutRef.current = window.setTimeout(() => {
      setIsDesktopWheelActive(false);
      wheelIdleTimeoutRef.current = null;
    }, 120);

    wheelDeltaRef.current += dominantDelta * 0.85;

    if (wheelRafRef.current !== null) return;
    wheelRafRef.current = requestAnimationFrame(() => {
      const delta = wheelDeltaRef.current;
      wheelDeltaRef.current = 0;
      setDesktopOffset((prev) => {
        const next = prev + delta;
        const twoLoops = desktopLoopSpan * 2;
        if (next > twoLoops) return next - desktopLoopSpan;
        if (next < -twoLoops) return next + desktopLoopSpan;
        return next;
      });
      wheelRafRef.current = null;
    });
  }, [isDesktop, desktopLoopSpan, activeScratchCard, isDesktopWheelActive]);

  // Only show a subset in the fanned stack (exclude visually white/neutral cards).
  const stackCards = useMemo(
    () => {
      const visibleCards = cards.filter((card) => card.includeInStack !== false);

      const extractCard = (id: string) => {
        const index = visibleCards.findIndex((card) => card.id === id);
        if (index < 0) return null;
        const [card] = visibleCards.splice(index, 1);
        return card;
      };

      const doomscrollingCard = extractCard('3');
      const vibeCard = extractCard('2');

      if (doomscrollingCard) visibleCards.push(doomscrollingCard);
      if (vibeCard) visibleCards.push(vibeCard);

      return visibleCards;
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(Array.from(solvedCardIds)));
    } catch {
      // ignore storage failures
    }
  }, [solvedCardIds]);

  const topCardIndexRef = useRef(stackCards.length - 1);

  const handleCardChange = useCallback((topIndex: number) => {
    topCardIndexRef.current = topIndex;
  }, []);

  const openScratchForCard = useCallback((card: CardData) => {
    setActiveScratchCard(card);
  }, []);

  const handleCardTap = useCallback(() => {
    const tappedCard = stackCards[topCardIndexRef.current];
    if (!tappedCard) return;
    openScratchForCard(tappedCard);
  }, [openScratchForCard, stackCards]);

  const handleCardSolved = useCallback((cardId: string) => {
    setSolvedCardIds((previous) => {
      if (previous.has(cardId)) return previous;
      const next = new Set(previous);
      next.add(cardId);
      return next;
    });
  }, []);

  const cardElements = useMemo(
    () => stackCards.map((card) => (
      card.id === '1'
        ? <ScrollPreviewCard key={card.id} />
        : <Card key={card.id} card={card} />
    )),
    [stackCards]
  );

  const desktopRenderCards = useMemo(() => {
    if (!isDesktop || desktopRail.length === 0) return [];

    const spacing = DESKTOP_CARD_SPACING;
    const wrappedOffset = ((desktopOffset % spacing) + spacing) % spacing;
    const wholeSteps = Math.floor((desktopOffset - wrappedOffset) / spacing);
    const sideCutoff = Math.max(
      viewport.width / 2 + DESKTOP_CARD_WIDTH * 2.5,
      DESKTOP_CARD_SPACING * 4
    );
    const maxVisibleSlot = Math.ceil(sideCutoff / spacing) + 2;

    const renderItems: Array<{
      instanceKey: string;
      slot: number;
      x: number;
      entry: DesktopRailItem;
    }> = [];

    for (let slot = -maxVisibleSlot; slot <= maxVisibleSlot; slot += 1) {
      const x = slot * spacing + wrappedOffset;
      if (x < -sideCutoff || x > sideCutoff) continue;
      const railIndex = ((desktopCenterIndex + slot - wholeSteps) % desktopRail.length + desktopRail.length) % desktopRail.length;
      const entry = desktopRail[railIndex];
      renderItems.push({
        instanceKey: `desktop-slot-${slot}`,
        slot,
        x,
        entry,
      });
    }

    return renderItems.sort((a, b) => a.x - b.x);
  }, [desktopRail, desktopCenterIndex, desktopOffset, isDesktop, viewport.width]);

  const desktopDefaultCardTop = Math.round(viewport.height * DESKTOP_DEFAULT_TOP_RATIO);
  const desktopHoverTop = desktopDefaultCardTop - 15;

  const hoveredDesktopSlot = useMemo(() => {
    if (!desktopPointer || isDesktopWheelActive) return null;
    const bandTop = desktopDefaultCardTop - 20;
    const bandBottom = desktopDefaultCardTop + DESKTOP_CARD_HEIGHT + 20;
    if (desktopPointer.y < bandTop || desktopPointer.y > bandBottom) return null;

    const cardItems = desktopRenderCards.filter((item) => {
      const left = item.x - DESKTOP_CARD_WIDTH / 2;
      const right = item.x + DESKTOP_CARD_WIDTH / 2;
      return desktopPointer.x >= left && desktopPointer.x <= right;
    });
    if (cardItems.length === 0) return null;

    let nearest = cardItems[0];
    let nearestDistance = Math.abs(nearest.x - desktopPointer.x);
    for (let index = 1; index < cardItems.length; index += 1) {
      const candidate = cardItems[index];
      const distance = Math.abs(candidate.x - desktopPointer.x);
      if (distance < nearestDistance) {
        nearest = candidate;
        nearestDistance = distance;
      }
    }

    return nearestDistance <= DESKTOP_CARD_WIDTH * 0.82 ? nearest.slot : null;
  }, [
    desktopPointer,
    desktopRenderCards,
    desktopDefaultCardTop,
    isDesktopWheelActive,
  ]);

  const homeHidden = Boolean(activeScratchCard);

  return (
    <div
      style={{
        height: '100%',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#fff',
      }}
      onWheel={isDesktop ? handleDesktopWheel : undefined}
    >
      {isDesktop ? (
        <div
          style={{
            position: 'relative',
            flex: 1,
            minHeight: '100dvh',
            overflow: 'hidden',
            visibility: homeHidden ? 'hidden' : 'visible',
            pointerEvents: homeHidden ? 'none' : 'auto',
            backgroundColor: '#fff',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 40,
              zIndex: 30,
              padding: '0 72px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              color: '#D1D1D1',
            }}
          >
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Manrope', sans-serif",
                fontWeight: 900,
                fontSize: 48,
                lineHeight: 1.5,
                color: '#D1D1D1',
                // textShadow: '0px 3px 0px rgba(0,0,0,0.16)',
              }}
            >
              Compulsions Gamified
            </motion.h1>

            <p
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Manrope', sans-serif",
                fontWeight: 600,
                fontSize: 36 / 2,
                lineHeight: 1.2,
                color: '#D1D1D1',
                maxWidth: 255,
                textAlign: 'left',
              }}
            >
              Every card is a behaviour you already know too well.
            </p>

            <p
              style={{
                margin: 0,
                fontFamily: "'Inter', 'Manrope', sans-serif",
                fontWeight: 400,
                fontSize: 12,
                lineHeight: 1.5,
                color: '#6b6b6b',
                textDecoration: 'underline',
                textDecorationSkipInk: 'none',
                textAlign: 'left',
                whiteSpace: 'pre-line',
              }}
            >
              VibeCoding{'\n'}Everything Messy{'\n'}Scroll
            </p>
          </div>

          <div
            style={{ position: 'absolute', inset: 0, pointerEvents: 'auto', overflow: 'hidden' }}
            onMouseMove={(event) => {
              const centerX = viewport.width / 2;
              setDesktopPointer({
                x: event.clientX - centerX,
                y: event.clientY,
              });
            }}
            onMouseLeave={() => setDesktopPointer(null)}
          >
            {desktopRenderCards.map((item) => {
              const hasHoveredCard = !isDesktopWheelActive && hoveredDesktopSlot !== null;
              const slotOffsetFromHovered = hasHoveredCard ? item.slot - hoveredDesktopSlot : 0;
              const isHoveredCard = hasHoveredCard && slotOffsetFromHovered === 0;
              const directionFromHovered = slotOffsetFromHovered < 0
                ? -1
                : slotOffsetFromHovered > 0
                  ? 1
                  : 0;
              const sideRank = Math.abs(slotOffsetFromHovered);

              const neighborTilt = sideRank === 0 ? 0 : Math.max(0, 4 - sideRank * 1.5);
              const neighborSink = sideRank === 0 ? 0 : Math.max(0, Math.round(8 / sideRank));
              const neighborPush = sideRank === 0 ? 0 : Math.max(3, Math.round(25 / sideRank));
              const neighborScale = sideRank === 0 ? 1 : Math.min(1, 1 - 0.03 / sideRank);

              const pushedX = item.x + directionFromHovered * neighborPush;
              let top = desktopDefaultCardTop;
              let rotation = 0;
              let scale = 1;

              if (isHoveredCard) {
                scale = DESKTOP_HOVER_SCALE;
                top = desktopHoverTop;
              } else if (hasHoveredCard && sideRank > 0) {
                rotation = directionFromHovered < 0 ? -neighborTilt : neighborTilt;
                top = desktopDefaultCardTop + neighborSink;
                scale = neighborScale;
              }

              const transition = isDesktopWheelActive
                ? 'none'
                : isHoveredCard
                  ? 'transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : hasHoveredCard
                    ? 'transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                    : 'transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';

              let zIndex = Math.max(1, 120 + Math.round(220 - Math.abs(item.x)));
              if (isHoveredCard) {
                zIndex = 700;
              }

              return (
                <div
                  key={item.instanceKey}
                  onClick={() => {
                    if (item.entry.kind === 'card') {
                      openScratchForCard(item.entry.card);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top,
                    width: DESKTOP_CARD_WIDTH,
                    height: DESKTOP_CARD_HEIGHT,
                    marginLeft: -(DESKTOP_CARD_WIDTH / 2),
                    transform: `translate3d(${pushedX}px, 0px, 0px) rotate(${rotation}deg) scale(${scale}) translateZ(0)`,
                    transformOrigin: '50% 100%',
                    transition,
                    boxShadow: isHoveredCard && !isDesktopWheelActive ? '0 12px 40px rgba(0,0,0,0.2)' : undefined,
                    background: 'transparent',
                    overflow: 'hidden',
                    borderRadius: 24,
                    backgroundColor: 'transparent',
                    zIndex,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                  }}
                >
                  {item.entry.id === '1' ? (
                    <ScrollPreviewCard />
                  ) : (
                    <Card card={item.entry.card} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          style={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '100%',
            margin: '0 auto',
            paddingTop: 'max(env(safe-area-inset-top), 24px)',
            paddingRight: 'max(env(safe-area-inset-right), 24px)',
            paddingLeft: 'max(env(safe-area-inset-left), 24px)',
            paddingBottom: 0,
            position: 'relative',
            overflow: 'visible',
            visibility: homeHidden ? 'hidden' : 'visible',
            pointerEvents: homeHidden ? 'none' : 'auto',
          }}
        >
          <div
            style={{
              flexShrink: 0,
              textAlign: 'left',
            }}
          >
            <motion.div
              style={{
                fontSize: 48,
                fontWeight: 700,
                lineHeight: 1.15,
                color: '#d1d1d1',
                maxWidth: 320,
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              Compulsions. Gamified.
            </motion.div>
            <div
              style={{
                marginTop: 12,
                maxWidth: 360,
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#d1d1d1',
                  lineHeight: 1.4,
                }}
              >
                Every card is a behavior you already know too well
              </p>
            </div>
          </div>

          <div
            style={{
              marginTop: 96,
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-start',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-start',
                overflow: 'visible',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: cardSize.width,
                  height: cardSize.height,
                  touchAction: 'none',
                  overflow: 'visible',
                }}
              >
                <Stack
                  cards={cardElements}
                  cardWidth={cardSize.width}
                  cardHeight={cardSize.height}
                  randomRotation
                  sensitivity={100}
                  onCardTap={handleCardTap}
                  onCardChange={handleCardChange}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              flexShrink: 0,
              marginTop: 32,
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {[...stackCards].reverse().map((card) => {
              const solved = solvedCardIds.has(card.id);
              const usesCardColorOutline = card.id === '2' || card.id === '3';
              return (
                <span
                  key={card.id}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: solved ? card.color : 'transparent',
                    border: solved
                      ? usesCardColorOutline
                        ? `1px solid ${card.color}`
                        : 'none'
                      : `1px solid ${usesCardColorOutline ? card.color : '#EFEFEF'}`,
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {activeScratchCard && activeScratchCard.id === '1' && (
          <ScrollInteraction
            key="scroll"
            cardColor={activeScratchCard.color}
            onReveal={() => handleCardSolved(activeScratchCard.id)}
            onClose={() => setActiveScratchCard(null)}
          />
        )}
        {activeScratchCard && activeScratchCard.id === '2' && (
          <VibeCodingInteraction
            key="vibecoding"
            cardColor={activeScratchCard.color}
            onReveal={() => handleCardSolved(activeScratchCard.id)}
            onClose={() => setActiveScratchCard(null)}
          />
        )}
        {activeScratchCard && activeScratchCard.id === '3' && (
          <ReorganizeInteraction
            key="reorganize"
            cardColor={activeScratchCard.color}
            onReveal={() => handleCardSolved(activeScratchCard.id)}
            onClose={() => setActiveScratchCard(null)}
          />
        )}
        {activeScratchCard && !['1', '2', '3'].includes(activeScratchCard.id) && (
          <ComingSoonInteraction
            key="comingsoon"
            cardColor={activeScratchCard.color}
            onClose={() => setActiveScratchCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
