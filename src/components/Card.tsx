import type { CardData } from '../data/cards';

interface CardProps {
  card: CardData;
}

export default function Card({ card }: CardProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 20,
        backgroundColor: card.color,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top 55% — Media area */}
      <div
        style={{
          flex: '0 0 55%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {card.video ? (
          <video
            src={card.video}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        ) : card.image ? (
          <img
            src={card.image}
            alt=""
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: card.color,
            }}
          />
        )}
      </div>

      {/* Bottom 45% — Text area */}
      <div
        style={{
          flex: '0 0 45%',
          backgroundColor: card.color,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            color: '#FFFFFF',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.2,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            textAlign: 'left',
          }}
        >
          {card.headline}
        </div>
        {card.subtext && (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: 13,
              fontWeight: 400,
              lineHeight: 1.4,
              marginTop: 8,
              fontFamily: 'system-ui, -apple-system, sans-serif',
              textAlign: 'left',
            }}
          >
            {card.subtext}
          </div>
        )}
      </div>
    </div>
  );
}
