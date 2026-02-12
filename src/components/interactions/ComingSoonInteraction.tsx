import { useCallback } from 'react';
import { motion, type PanInfo } from 'motion/react';

interface ComingSoonInteractionProps {
  cardColor: string;
  onClose: () => void;
}

export default function ComingSoonInteraction({
  cardColor,
  onClose,
}: ComingSoonInteractionProps) {
  const handleCardDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  }, [onClose]);

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        height: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        touchAction: 'manipulation',
        overscrollBehavior: 'none',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
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
          border: 'none',
          borderRadius: '50%',
          background: '#FFFFFF',
          color: '#111111',
          fontSize: 24,
          lineHeight: 1,
          cursor: 'pointer',
          zIndex: 1020,
          boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
        }}
      >
        ×
      </button>

      <motion.div
        style={{
          position: 'relative',
          width: 'min(90vw, 420px)',
          height: 'min(60vh, 560px)',
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: cardColor,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
          willChange: 'transform',
          touchAction: 'manipulation',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        initial={{ opacity: 0, y: 20, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.25}
        onDragEnd={handleCardDragEnd}
      >
        <span
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: 32,
            fontWeight: 700,
            lineHeight: 1.2,
            textAlign: 'center',
          }}
        >
          Coming soon
        </span>
      </motion.div>
    </motion.div>
  );
}
