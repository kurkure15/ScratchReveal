import type { CardData } from '../data/cards';
import rocketIcon from '../assets/rocket.svg';
import vibeCodeBg from '../assets/Vibe Code.svg';
import eyeTrackingIcon from '../assets/eye_tracking.svg';

interface CardProps {
  card: CardData;
}

/** Vibe Coding card: pixel-accurate match to Figma "concepts" frame — same copy, spacing, colors, icon, button. */
const isVibeCodingCard = (card: CardData) => card.id === '2';
const isDoomscrollingCard = (card: CardData) => card.id === '3';
const isDiaryCard = (card: CardData) => card.id === '9';
const isBeingWatchedCard = (card: CardData) => card.id === '10';
const isMoreComingSoonCard = (card: CardData) => card.id === '11';

const VIBE_TEXT_COLOR = '#E55342';
const VIBE_ACCENT = '#A09DFF';
const VIBE_BG = '#2F2E5C';
const CLEAN_BG = '#F6EBD9';
const CLEAN_ACCENT = '#AF9771';

const CLEAN_EVERYTHING_LETTERS: { char: string; left: string; top: number; color: string }[] = [
  { char: 'E', left: 'calc(50% - 132.3px)', top: 27.69, color: CLEAN_ACCENT },
  { char: 'V', left: 'calc(50% - 83.81px)', top: 57.69, color: CLEAN_ACCENT },
  { char: 'E', left: 'calc(50% - 32.32px)', top: 27.69, color: CLEAN_ACCENT },
  { char: 'R', left: 'calc(50% + 19.91px)', top: 51.34, color: CLEAN_ACCENT },
  { char: 'Y', left: 'calc(50% + 77.59px)', top: 27.69, color: CLEAN_ACCENT },
  { char: 'T', left: 'calc(50% - 51.81px)', top: 124.83, color: CLEAN_ACCENT },
  { char: 'H', left: 'calc(50% - 10.82px)', top: 139.83, color: CLEAN_ACCENT },
  { char: 'I', left: 'calc(50% + 32.17px)', top: 124.83, color: CLEAN_ACCENT },
  { char: 'N', left: 'calc(50% + 62.41px)', top: 139.83, color: CLEAN_ACCENT },
  { char: 'G', left: 'calc(50% + 104.41px)', top: 154.83, color: CLEAN_ACCENT },
  { char: 'M', left: 'calc(50% - 121.08px)', top: 206.97, color: '#000000' },
  { char: 'E', left: 'calc(50% - 73.49px)', top: 233.99, color: '#000000' },
  { char: 'S', left: 'calc(50% - 35.58px)', top: 214.83, color: '#000000' },
  { char: 'S', left: 'calc(50% + 6.77px)', top: 236.97, color: '#000000' },
  { char: 'Y', left: 'calc(50% + 49.12px)', top: 221.97, color: '#000000' },
];

const CLEAN_DASH_BOXES = [
  { left: 21.17, top: 210.23 },
  { left: 101.51, top: 218.09 },
  { left: 187.87, top: 225.23 },
];

const DIARY_LINES: Array<{ text: string; left: number; top: number; opacity?: number }> = [
  { text: 'words|', left: 23.62, top: 36.02 },
  { text: 'that', left: 108.96, top: 122.02 },
  { text: 'fade', left: 108.96, top: 170.02, opacity: 0.3 },
  { text: 'away', left: 108.96, top: 212.02 },
];

function HouseholdSuppliesIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 3h7v2.1l-1.9 1.1V8l2.3 1.9c.5.4.8 1 .8 1.7V19a2 2 0 0 1-2 2H8.8a2 2 0 0 1-2-2v-7.4c0-.7.3-1.3.8-1.7L10 8V6.2L8 5.1V3Z"
        fill="#000000"
      />
      <path d="M13.8 5.1H18a1 1 0 0 1 0 2h-2.3l-1.9-2Z" fill="#000000" />
      <circle cx="18.3" cy="8.8" r="1" fill="#000000" />
    </svg>
  );
}

function DiaryCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: '#CFAB71',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        borderTop: '3px solid #FFFFFF',
        borderRight: '3px solid #FFFFFF',
      }}
    >
      {DIARY_LINES.map((line) => (
        <p
          key={line.text}
          style={{
            position: 'absolute',
            left: line.left,
            top: line.top,
            margin: 0,
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1.5,
            color: '#FFFCF8',
            opacity: line.opacity ?? 1,
          }}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}

function BeingWatchedCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: '#2E5284',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        borderRight: '3px solid #6B9DE4',
      }}
    >
      <img
        src={eyeTrackingIcon}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: '50%',
          top: 146,
          width: 24,
          height: 24,
          transform: 'translateX(-50%)',
          opacity: 0.3,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 'calc(50% + 1.5px)',
          top: 'calc(50% + 36px)',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          opacity: 0.3,
          color: '#FFFFFF',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 64,
            lineHeight: 1.5,
            fontWeight: 400,
            whiteSpace: 'nowrap',
          }}
        >
          {'You are '}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 32,
            lineHeight: 1.5,
            fontWeight: 400,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          being watched
        </p>
      </div>
    </div>
  );
}

function MoreComingSoonCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: '#E7E7E5',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#2E5284',
          width: '100%',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 64,
            lineHeight: 1.2,
            fontWeight: 400,
            whiteSpace: 'nowrap',
          }}
        >
          Building
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 64,
            lineHeight: 1.2,
            fontWeight: 400,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          more
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 64,
            lineHeight: 1.2,
            fontWeight: 400,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          stuff
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: 64,
            lineHeight: 1.2,
            fontWeight: 400,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          soon
        </p>
      </div>
    </div>
  );
}

function CleanEverythingCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: CLEAN_BG,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        borderTop: `3px solid ${CLEAN_ACCENT}`,
      }}
    >
      {CLEAN_EVERYTHING_LETTERS.map((letter, index) => (
        <p
          key={`${letter.char}-${index}`}
          style={{
            position: 'absolute',
            left: letter.left,
            top: letter.top,
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 900,
            fontSize: 40,
            lineHeight: 1.5,
            color: letter.color,
            margin: 0,
          }}
        >
          {letter.char}
        </p>
      ))}

      {CLEAN_DASH_BOXES.map((box, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: box.left,
            top: box.top,
            width: 53.503,
            height: 53.491,
            border: '1px dashed rgba(0, 0, 0, 0.5)',
            borderRadius: 8,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 156,
          top: 334.11,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 8,
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: 16,
            lineHeight: 1.5,
            color: '#000000',
          }}
        >
          CLEAN NOW
        </p>
        <div style={{ width: 24, height: 24 }}>
          <HouseholdSuppliesIcon />
        </div>
      </div>
    </div>
  );
}

function VibeCodingCard() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 24,
        backgroundColor: VIBE_BG,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        backgroundImage: `url("${vibeCodeBg}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderTop: `3px solid ${VIBE_ACCENT}`,
      }}
    >
      <p
        style={{
          position: 'absolute',
          left: 'calc(50% - 89px)',
          top: 44,
          fontFamily: "'Inter', 'Manrope', sans-serif",
          fontWeight: 700,
          fontSize: 24,
          lineHeight: 1.5,
          whiteSpace: 'nowrap',
          color: VIBE_TEXT_COLOR,
        }}
      >
        There might be
      </p>

      <p
        style={{
          position: 'absolute',
          left: 'calc(50% - 69.11px)',
          top: 89.81,
          fontFamily: "'Inter', 'Manrope', sans-serif",
          fontWeight: 900,
          fontSize: 40,
          lineHeight: 1.5,
          color: VIBE_TEXT_COLOR,
        }}
      >
        b
      </p>
      <p
        style={{
          position: 'absolute',
          left: 'calc(50% - 28.12px)',
          top: 104.81,
          fontFamily: "'Inter', 'Manrope', sans-serif",
          fontWeight: 900,
          fontSize: 40,
          lineHeight: 1.5,
          color: VIBE_TEXT_COLOR,
        }}
      >
        u
      </p>
      <p
        style={{
          position: 'absolute',
          left: 'calc(50% + 4.87px)',
          top: 80,
          fontFamily: "'Inter', 'Manrope', sans-serif",
          fontWeight: 900,
          fontSize: 40,
          lineHeight: 1.5,
          color: VIBE_TEXT_COLOR,
        }}
      >
        g
      </p>
      <p
        style={{
          position: 'absolute',
          left: 'calc(50% + 45.11px)',
          top: 104.81,
          fontFamily: "'Inter', 'Manrope', sans-serif",
          fontWeight: 900,
          fontSize: 40,
          lineHeight: 1.5,
          color: VIBE_TEXT_COLOR,
        }}
      >
        s
      </p>

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 238,
          width: 40,
          height: 40,
          transform: 'translateX(-50%)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 10.72,
            top: 1.5,
            width: 2.09,
            height: 6.87,
            borderRadius: 8,
            backgroundColor: VIBE_ACCENT,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 18.95,
            top: 4.93,
            width: 2.09,
            height: 6.87,
            borderRadius: 8,
            backgroundColor: VIBE_ACCENT,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 27.19,
            top: 1.5,
            width: 2.09,
            height: 6.87,
            borderRadius: 8,
            backgroundColor: VIBE_ACCENT,
          }}
        />
        <img
          src={rocketIcon}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: 8,
            top: 15.06,
            width: 24,
            height: 24,
            display: 'block',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 110,
          top: 293,
          width: 80,
          height: 40,
          border: `1px solid ${VIBE_ACCENT}`,
          borderRadius: 16,
        }}
      >
        <span
          style={{
            position: 'absolute',
            left: 26.93,
            top: 5,
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1.5,
            color: VIBE_TEXT_COLOR,
            letterSpacing: '0.02em',
          }}
        >
          &gt;
        </span>
        <span
          style={{
            position: 'absolute',
            left: 43.07,
            top: 5,
            fontFamily: "'Inter', 'Manrope', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1.5,
            color: VIBE_TEXT_COLOR,
          }}
        >
          _
        </span>
      </div>
    </div>
  );
}

export default function Card({ card }: CardProps) {
  const isVibe = isVibeCodingCard(card);
  const isDoomscrolling = isDoomscrollingCard(card);
  const isDiary = isDiaryCard(card);
  const isBeingWatched = isBeingWatchedCard(card);
  const isMoreComingSoon = isMoreComingSoonCard(card);

  if (isVibe) {
    return <VibeCodingCard />;
  }
  if (isDoomscrolling) {
    return <CleanEverythingCard />;
  }
  if (isDiary) {
    return <DiaryCard />;
  }
  if (isBeingWatched) {
    return <BeingWatchedCard />;
  }
  if (isMoreComingSoon) {
    return <MoreComingSoonCard />;
  }

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
