import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Stack from './components/Stack';
import Card from './components/Card';
import ScratchOverlay from './components/ScratchOverlay';
import { cards } from './data/cards';
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
  const [showScratch, setShowScratch] = useState(false);
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

  const handleOpenScratch = useCallback(() => {
    ensureAudio();
    setShowScratch(true);
  }, [ensureAudio]);

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
      {/* Container — spec: height 100%, margin 0 auto, padding 0 20px */}
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
        {/* Title container — spec: height auto, paddingTop 24px, paddingBottom 16px */}
        <div
          style={{
            height: 'auto',
            paddingTop: 24,
            paddingBottom: 16,
            flexShrink: 0,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.h1
              key={currentCard.id}
              className="headline-serif"
              style={{
                fontSize: 28,
                fontWeight: 400,
                lineHeight: 1.25,
                color: '#000',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {currentCard.headline}
            </motion.h1>
          </AnimatePresence>
        </div>

        {/* Subtitle — spec: flex, align center, gap 8px, fontSize 13, color #666, padding 8px 0 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            color: '#666',
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

        {/* Middle: flex 1, position relative — stack wrapper is absolute inside */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
          }}
        >
          {/* Stack wrapper — spec: position absolute, top 65%, left 42%, translate(-50%,-50%), width 100%, height 60vh, flex center */}
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
                  sendToBackOnClick
                  sensitivity={100}
                  onCardChange={handleCardChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Scratch CTA + bottom safe area */}
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
        {showScratch && (
          <ScratchOverlay
            card={currentCard}
            onClose={() => setShowScratch(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
