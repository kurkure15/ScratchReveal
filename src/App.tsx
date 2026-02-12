import { useState, useCallback, useMemo, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import Stack from './components/Stack';
import Card from './components/Card';
import ScratchInteraction from './components/interactions/ScratchInteraction';
import { cards, type CardData } from './data/cards';
import { initAudio, playCardTick } from './utils/sounds';

// Card size from vemula.me: Math.min(300, 0.7*vw), Math.min(400, 0.93*vw)
function useCardSize() {
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 375));
  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return useMemo(() => ({
    width: Math.min(300, 0.7 * vw),
    height: Math.min(400, 0.93 * vw),
  }), [vw]);
}

function App() {
  const [topIndex, setTopIndex] = useState(0);
  const [activeScratchCard, setActiveScratchCard] = useState<CardData | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const cardSize = useCardSize();

  const ensureAudio = useCallback(() => {
    if (!audioInitialized) {
      initAudio();
      setAudioInitialized(true);
    }
  }, [audioInitialized]);

  const handleCardChange = useCallback((newTopIndex: number) => {
    setTopIndex(newTopIndex);
    playCardTick();
  }, []);

  const openScratchForCard = useCallback((card: CardData) => {
    ensureAudio();
    setActiveScratchCard(card);
  }, [ensureAudio]);

  const handleCardTap = useCallback((cardIndex: number) => {
    const tappedCard = cards[cardIndex];
    if (!tappedCard) return;
    openScratchForCard(tappedCard);
  }, [openScratchForCard]);

  const handleOpenScratch = useCallback(() => {
    openScratchForCard(cards[topIndex]);
  }, [openScratchForCard, topIndex]);

  const currentCard = cards[topIndex];
  const cardElements = useMemo(
    () => cards.map((card) => <Card key={card.id} card={card} />),
    []
  );

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
      onClick={ensureAudio}
    >
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: '100%',
          margin: '0 auto',
          padding: '0 20px',
          position: 'relative',
        }}
      >
        <div
          style={{
            paddingTop: 24,
            paddingBottom: 16,
            flexShrink: 0,
            minHeight: 116,
          }}
        >
          <h1
            className="headline-serif"
            style={{
              fontSize: 27,
              fontWeight: 400,
              lineHeight: 1.22,
              color: '#000',
              letterSpacing: '-0.02em',
              margin: 0,
              maxWidth: 330,
            }}
          >
            Hey there, I am <img src="https://vemula.me/images/profile.jpeg" alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'inline-block', verticalAlign: '-0.3em', margin: '0 4px' }} /> Charmin.
            I work at STAX.AI and write software in SF
            <img src="https://vemula.me/images/shine.png" alt="" style={{ width: 19, height: 19, display: 'inline-block', verticalAlign: 'baseline', marginLeft: 6 }} />.
          </h1>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            lineHeight: 1.2,
            color: '#6B6B6B',
            paddingTop: 8,
            paddingBottom: 8,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#34C759',
              flexShrink: 0,
            }}
            aria-hidden
          />
          <span>Currently at</span>
          {currentCard.url ? (
            <a
              href={currentCard.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0d9488', fontWeight: 600, textDecoration: 'none' }}
            >
              {currentCard.label}
            </a>
          ) : (
            <span style={{ color: '#000', fontWeight: 600 }}>{currentCard.label}</span>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '65%',
              left: '42%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              height: '60vh',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                maxWidth: 300,
                pointerEvents: 'auto',
              }}
            >
              <div
                style={{
                  width: cardSize.width,
                  height: cardSize.height,
                  margin: '0 auto',
                  touchAction: 'none',
                }}
              >
                <Stack
                  cards={cardElements}
                  cardWidth={cardSize.width}
                  cardHeight={cardSize.height}
                  randomRotation
                  sensitivity={100}
                  onCardChange={handleCardChange}
                  onCardTap={handleCardTap}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            flexShrink: 0,
            paddingTop: 12,
            paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          }}
        >
          <button
            type="button"
            onClick={handleOpenScratch}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: '#000',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'underline',
              cursor: 'pointer',
            }}
          >
            Scratch to reveal →
          </button>
        </div>
      </div>

      <AnimatePresence>
        {activeScratchCard && (
          <ScratchInteraction
            cardColor={activeScratchCard.color}
            revealText={activeScratchCard.reward}
            onReveal={() => {}}
            onClose={() => setActiveScratchCard(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
