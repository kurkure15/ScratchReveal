import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Stack from './components/Stack';
import Card from './components/Card';
import ScratchInteraction from './components/interactions/ScratchInteraction';
import ComingSoonInteraction from './components/interactions/ComingSoonInteraction';
import TouchGrassInteraction from './components/interactions/TouchGrassInteraction';
import VibeCodingInteraction from './components/interactions/VibeCodingInteraction';
import ReorganizeInteraction from './components/interactions/ReorganizeInteraction';
import { cards, type CardData } from './data/cards';

const SOLVED_STORAGE_KEY = 'solvedCards';

// Match React Bits Stack demo card footprint.
function useCardSize() {
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 375));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return useMemo(() => ({
    width: 300,
    height: 380,
  }), [vw]);
}

function App() {
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
  const cardSize = useCardSize();

  // Only show a subset in the fanned stack (exclude visually white/neutral cards).
  const stackCards = useMemo(
    () => cards.filter((card) => card.includeInStack !== false),
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

  // Remaining = only cards that are actually in the visible stack
  const remainingCount = useMemo(() => {
    const stackIds = new Set(stackCards.map((card) => card.id));
    let solvedInStack = 0;
    solvedCardIds.forEach((id) => {
      if (stackIds.has(id)) solvedInStack += 1;
    });
    return Math.max(stackCards.length - solvedInStack, 0);
  }, [stackCards, solvedCardIds]);

  const cardElements = useMemo(
    () => stackCards.map((card) => <Card key={card.id} card={card} />),
    [stackCards]
  );

  return (
    <div
      style={{
        height: '100%',
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'visible',
        backgroundColor: '#fff',
      }}
    >
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          margin: '0 auto',
          padding: 24,
          position: 'relative',
          overflow: 'visible',
          visibility: activeScratchCard ? 'hidden' : 'visible',
          pointerEvents: activeScratchCard ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            textAlign: 'left',
          }}
        >
          <motion.div
            key={remainingCount}
            style={{
              fontSize: 120,
              fontWeight: 700,
              lineHeight: 1,
              color: '#D1D1D1',
            }}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {remainingCount}
          </motion.div>
          <p
            style={{
              margin: 0,
              marginTop: 12,
              fontSize: 16,
              fontWeight: 600,
              color: '#D1d1d1',
              maxWidth: 280,
              lineHeight: 1.4,
            }}
          >
            Not everything satisfying is obvious.
          </p>
        </div>

        <div
          style={{
            marginTop: 60,
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
          {stackCards.map((card) => {
            const solved = solvedCardIds.has(card.id);
            return (
              <span
                key={card.id}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: solved ? card.color : 'transparent',
                  border: solved ? 'none' : '1px solid #EFEFEF',
                }}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {activeScratchCard && activeScratchCard.id === '1' && (
          <ScratchInteraction
            key="scratch"
            cardColor={activeScratchCard.color}
            revealText={activeScratchCard.reward}
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
