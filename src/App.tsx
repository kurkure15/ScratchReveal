import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Stack from './components/Stack';
import Card from './components/Card';
import ScratchOverlay from './components/ScratchOverlay';
import { cards } from './data/cards';
import { initAudio, playCardTick } from './utils/sounds';

function App() {
  const [topIndex, setTopIndex] = useState(0);
  const [showScratch, setShowScratch] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);

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
  const cardElements = cards.map((card) => <Card key={card.id} card={card} />);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 390,
        margin: '0 auto',
        padding: '48px 24px 32px',
        touchAction: 'pan-y',
      }}
      onClick={ensureAudio}
    >
      {/* Dynamic headline */}
      <div style={{ width: '100%', marginBottom: 40, minHeight: 70 }}>
        <AnimatePresence mode="wait">
          <motion.h1
            key={currentCard.id}
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: '#000',
              lineHeight: 1.3,
              textAlign: 'left',
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {currentCard.headline}
          </motion.h1>
        </AnimatePresence>
      </div>

      {/* Card stack */}
      <div
        style={{
          width: 280,
          height: 360,
          touchAction: 'none',
          marginBottom: 40,
        }}
      >
        <Stack
          cards={cardElements}
          randomRotation
          sendToBackOnClick
          sensitivity={150}
          onCardChange={handleCardChange}
        />
      </div>

      {/* Scratch to reveal button */}
      <button
        onClick={handleOpenScratch}
        style={{
          background: 'none',
          border: 'none',
          color: '#000',
          fontSize: 13,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          cursor: 'pointer',
          padding: '12px 0',
          marginBottom: 32,
          fontFamily: 'inherit',
        }}
      >
        SCRATCH TO REVEAL →
      </button>

      {/* Status line */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#4CAF50',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: '#888',
            fontSize: 13,
          }}
        >
          Currently viewing {currentCard.label}
        </span>
      </div>

      {/* Scratch overlay */}
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
