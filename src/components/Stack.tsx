import { motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { useState, useCallback, useRef } from 'react';

interface CardRotateProps {
  children: React.ReactNode;
  onSendToBack: () => void;
  sensitivity: number;
  tapThreshold: number;
  sendToBackOnTap: boolean;
  onTap?: () => void;
}

function CardRotate({
  children,
  onSendToBack,
  sensitivity,
  tapThreshold,
  sendToBackOnTap,
  onTap,
}: CardRotateProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [30, -30]);
  const rotateY = useTransform(x, [-100, 100], [-30, 30]);
  const pointerDownRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);

  function handleTapAction() {
    if (sendToBackOnTap) {
      onSendToBack();
    } else {
      onTap?.();
    }
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      pointerId: event.pointerId,
    };
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const pointerDown = pointerDownRef.current;
    pointerDownRef.current = null;
    if (!pointerDown || pointerDown.pointerId !== event.pointerId) return;

    const dx = event.clientX - pointerDown.x;
    const dy = event.clientY - pointerDown.y;
    const distance = Math.hypot(dx, dy);
    const elapsed = performance.now() - pointerDown.time;

    if (distance <= tapThreshold && elapsed <= 320) {
      handleTapAction();
    }
  }

  function handleDragEnd(_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);

    if (absX > sensitivity || absY > sensitivity) {
      onSendToBack();
    }
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        cursor: 'grab',
        touchAction: 'none',
        x,
        y,
        rotateX,
        rotateY,
      }}
      drag
      dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
      dragElastic={0.6}
      whileTap={{ cursor: 'grabbing' }}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        pointerDownRef.current = null;
      }}
    >
      {children}
    </motion.div>
  );
}

interface StackProps {
  cards: React.ReactNode[];
  cardWidth: number;
  cardHeight: number;
  randomRotation?: boolean;
  sensitivity?: number;
  sendToBackOnClick?: boolean;
  tapThreshold?: number;
  animationConfig?: { stiffness: number; damping: number };
  onCardChange?: (topIndex: number) => void;
  onCardTap?: (cardIndex: number) => void;
}

function seededOffset(id: number): number {
  const seed = Math.sin(id * 999.91) * 10000;
  return (seed - Math.floor(seed)) * 10 - 5;
}

export default function Stack({
  cards = [],
  cardWidth,
  cardHeight,
  randomRotation = false,
  sensitivity = 100,
  animationConfig = { stiffness: 300, damping: 20 },
  sendToBackOnClick = false,
  tapThreshold = 18,
  onCardChange,
  onCardTap,
}: StackProps) {
  const [stack, setStack] = useState<{ id: number; content: React.ReactNode }[]>(() =>
    cards.map((content, index) => ({ id: index + 1, content }))
  );
  const [randomOffsets] = useState<Map<number, number>>(() => {
    const offsets = new Map<number, number>();
    cards.forEach((_, index) => {
      const id = index + 1;
      offsets.set(id, randomRotation ? seededOffset(id) : 0);
    });
    return offsets;
  });
  const sendToBack = useCallback((id: number) => {
    setStack((prev) => {
      const newStack = [...prev];
      const index = newStack.findIndex((card) => card.id === id);
      if (index < 0) return prev;
      const [card] = newStack.splice(index, 1);
      newStack.unshift(card);
      const newTopId = newStack[newStack.length - 1].id - 1;
      setTimeout(() => onCardChange?.(newTopId), 0);
      return newStack;
    });
  }, [onCardChange]);

  return (
    <div
      style={{
        position: 'relative',
        width: cardWidth,
        height: cardHeight,
        perspective: 600,
        margin: '0 auto',
      }}
    >
      {stack.map((card, index) => {
        const randomOffset = randomOffsets.get(card.id) ?? 0;
        return (
          <CardRotate
            key={card.id}
            onSendToBack={() => sendToBack(card.id)}
            sensitivity={sensitivity}
            tapThreshold={tapThreshold}
            sendToBackOnTap={sendToBackOnClick}
            onTap={() => onCardTap?.(card.id - 1)}
          >
            <motion.div
              style={{
                borderRadius: 20,
                overflow: 'hidden',
                width: '100%',
                height: '100%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              animate={{
                rotateZ: (stack.length - index - 1) * 4 + randomOffset,
                scale: 1 + index * 0.06 - stack.length * 0.06,
                transformOrigin: '90% 90%',
              }}
              initial={false}
              transition={{
                type: 'spring',
                stiffness: animationConfig.stiffness,
                damping: animationConfig.damping,
              }}
            >
              {card.content}
            </motion.div>
          </CardRotate>
        );
      })}
    </div>
  );
}
