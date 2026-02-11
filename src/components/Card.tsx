import type { CardData } from '../data/cards';

// SVG patterns — each card gets a unique geometric pattern
const patterns: Record<string, React.ReactNode> = {
  "1": ( // Diagonal lines
    <g>
      {Array.from({ length: 20 }, (_, i) => (
        <line key={i} x1={i * 30 - 100} y1={0} x2={i * 30 + 260} y2={360} stroke="white" strokeWidth="2" />
      ))}
    </g>
  ),
  "2": ( // Circles grid
    <g>
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={col * 60 + 20} cy={row * 60 + 80} r="18" fill="none" stroke="white" strokeWidth="1.5" />
        ))
      )}
    </g>
  ),
  "3": ( // Chevrons
    <g>
      {Array.from({ length: 8 }, (_, i) => (
        <polyline key={i} points={`20,${i * 45 + 40} 140,${i * 45 + 10} 260,${i * 45 + 40}`} fill="none" stroke="white" strokeWidth="2" />
      ))}
    </g>
  ),
  "4": ( // Cross-hatch
    <g>
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <line x1={i * 25} y1={0} x2={i * 25} y2={360} stroke="white" strokeWidth="1" />
          <line x1={0} y1={i * 30} x2={280} y2={i * 30} stroke="white" strokeWidth="1" />
        </g>
      ))}
    </g>
  ),
  "5": ( // Concentric rectangles
    <g>
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={20 + i * 20} y={100 + i * 20} width={240 - i * 40} height={200 - i * 40} fill="none" stroke="white" strokeWidth="1.5" rx="4" />
      ))}
    </g>
  ),
  "6": ( // Dots grid
    <g>
      {Array.from({ length: 10 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <circle key={`${row}-${col}`} cx={col * 35 + 15} cy={row * 36 + 20} r="4" fill="white" />
        ))
      )}
    </g>
  ),
  "7": ( // Triangles
    <g>
      {Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const x = col * 60 + (row % 2 === 0 ? 10 : 40);
          const y = row * 55 + 60;
          return (
            <polygon key={`${row}-${col}`} points={`${x},${y - 20} ${x + 25},${y + 15} ${x - 25},${y + 15}`} fill="none" stroke="white" strokeWidth="1.5" />
          );
        })
      )}
    </g>
  ),
  "8": ( // Horizontal waves
    <g>
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M0,${i * 36 + 20} Q70,${i * 36} 140,${i * 36 + 20} T280,${i * 36 + 20}`} fill="none" stroke="white" strokeWidth="1.5" />
      ))}
    </g>
  ),
};

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
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
      }}
    >
      {/* Top label, like the \"X\" in reference */}
      <div
        style={{
          padding: '18px 22px',
          color: 'white',
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}
      >
        {card.label}
      </div>

      {/* Pattern fills the rest of the card, similar to graphic tiles */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          minHeight: 0,
        }}
      >
        {card.image ? (
          <img
            src={card.image}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 280 360"
            preserveAspectRatio="xMidYMid slice"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.22,
              pointerEvents: 'none',
            }}
          >
            <defs>
              <clipPath id={`clip-${card.id}`}>
                <rect x="0" y="0" width="280" height="360" />
              </clipPath>
            </defs>
            <g clipPath={`url(#clip-${card.id})`}>
              {patterns[card.id]}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
