import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

interface VibeCodingProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

const FONT = "'SF Mono', 'Fira Code', Consolas, monospace";

const INITIAL_CODE = [
  '// TODO: fix this before demo day',
  'const vibes = await fetchVibes();',
  '',
  'if (vibes.check() === "immaculate") {',
  '  ship(everything);',
  '  return feelings;',
  '}',
  '',
  '// this worked on my machine',
  'const bugs = features.filter(',
  '  f => f.works === "sometimes"',
  ');',
  '',
  'try {',
  '  deployToProduction();',
  '} catch (error) {',
  '  console.log("its fine");',
  '  deployToProduction(); // just try again',
  '}',
  '',
  '// mass approved by copilot',
  'function reviewCode(pr) {',
  '  return "lgtm";',
  '}',
  '',
  '// do NOT delete this',
  '// nobody knows what it does',
  '// but everything breaks without it',
  'const magic = 0xff + undefined;',
].join('\n');

const TAP_SNIPPETS = [
  "// I mass mass mass ship\nconst deadline = new Date('yesterday');",
  "// AI wrote this. I mass reviewed it.\nif (Math.random() > 0.5) fix(bug);",
  "// Stack Overflow said this works\neval('trust me bro');",
  "sleep(until_it_works);",
  "// mass mass mass mass\ngit.push('--force', '--no-questions');",
  "const salary = 'enough'.repeat(999);",
  "// written at 3am\nconst coffee = await brew.map(c => c.drink());",
  "// this is fine. do not touch\nwhile(true) { hope(); }",
  "return null ?? undefined ?? 'vibes';",
  "// mass mass ship ship ship\nconsole.log('we are so back');",
];

const TAPS_TO_REVEAL = 6;

const KEYWORDS = new Set([
  'const', 'let', 'var', 'if', 'else', 'return', 'try', 'catch',
  'function', 'await', 'async', 'import', 'export', 'new', 'while', 'for',
]);
const SPECIALS = new Set(['true', 'false', 'null', 'undefined']);

function highlightLine(line: string, overrideColor?: string | null): React.ReactNode[] {
  if (overrideColor) {
    return [<span key={0} style={{ color: overrideColor }}>{line}</span>];
  }

  const result: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < line.length) {
    if (line[i] === ' ' || line[i] === '\t') {
      let j = i;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
      result.push(<span key={key++}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    if (line[i] === '/' && line[i + 1] === '/') {
      result.push(
        <span key={key++} style={{ color: '#6A9955', fontStyle: 'italic' }}>
          {line.slice(i)}
        </span>
      );
      break;
    }

    if (line[i] === "'" || line[i] === '"') {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === '\\') j++;
        j++;
      }
      if (j < line.length) j++;
      result.push(<span key={key++} style={{ color: '#CE9178' }}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    if (/\d/.test(line[i])) {
      let j = i;
      if (line[i] === '0' && (line[i + 1] === 'x' || line[i + 1] === 'X')) {
        j += 2;
        while (j < line.length && /[0-9a-fA-F]/.test(line[j])) j++;
      } else {
        while (j < line.length && /[\d.]/.test(line[j])) j++;
      }
      result.push(<span key={key++} style={{ color: '#B5CEA8' }}>{line.slice(i, j)}</span>);
      i = j;
      continue;
    }

    if (line[i] === '.') {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      if (j > i + 1) {
        let k = j;
        while (k < line.length && line[k] === ' ') k++;
        const color = line[k] === '(' ? '#DCDCAA' : '#9CDCFE';
        result.push(<span key={key++} style={{ color }}>{line.slice(i, j)}</span>);
        i = j;
        continue;
      }
    }

    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let k = j;
      while (k < line.length && line[k] === ' ') k++;
      const followedByParen = line[k] === '(';
      let color = '#9CDCFE';
      if (KEYWORDS.has(word)) color = '#C586C0';
      else if (SPECIALS.has(word)) color = '#569CD6';
      else if (followedByParen) color = '#DCDCAA';
      result.push(<span key={key++} style={{ color }}>{word}</span>);
      i = j;
      continue;
    }

    const three = line.slice(i, i + 3);
    const two = line.slice(i, i + 2);
    if (three === '===' || three === '!==') {
      result.push(<span key={key++} style={{ color: '#D4D4D4' }}>{three}</span>);
      i += 3;
      continue;
    }
    if (two === '=>' || two === '&&' || two === '||' || two === '??') {
      result.push(<span key={key++} style={{ color: '#D4D4D4' }}>{two}</span>);
      i += 2;
      continue;
    }

    result.push(<span key={key++} style={{ color: '#D4D4D4' }}>{line[i]}</span>);
    i++;
  }

  return result;
}

export default function VibeCodingInteraction({
  onClose,
  onReveal,
}: VibeCodingProps) {
  const [displayedCode, setDisplayedCode] = useState('');
  const [phase, setPhase] = useState<'typing' | 'glitch' | 'fade' | 'reveal'>('typing');
  const [glitchColor, setGlitchColor] = useState<string | null>(null);
  const [revealLines, setRevealLines] = useState<string[]>([]);

  const fullCodeRef = useRef(INITIAL_CODE);
  const typedLenRef = useRef(0);
  const tapCountRef = useRef(0);
  const snippetPoolRef = useRef([...Array(TAP_SNIPPETS.length).keys()]);
  const phaseRef = useRef('typing');
  const typingActiveRef = useRef(false);
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const allTimersRef = useRef<number[]>([]);
  const allIntervalsRef = useRef<number[]>([]);
  const onRevealRef = useRef(onReveal);
  onRevealRef.current = onReveal;

  const typeNextRef = useRef<() => void>(() => {});
  const triggerRevealRef = useRef<() => void>(() => {});

  useEffect(() => {
    function sched(fn: () => void, ms: number) {
      const id = window.setTimeout(fn, ms);
      allTimersRef.current.push(id);
      return id;
    }

    function typeNext() {
      const full = fullCodeRef.current;
      if (typedLenRef.current >= full.length) {
        typingActiveRef.current = false;
        return;
      }

      typingActiveRef.current = true;
      typedLenRef.current++;
      const display = full.slice(0, typedLenRef.current);
      setDisplayedCode(display);

      if (typedLenRef.current > INITIAL_CODE.length) {
        try { navigator.vibrate(1); } catch { /* noop */ }
      }

      requestAnimationFrame(() => {
        if (codeAreaRef.current) {
          codeAreaRef.current.scrollTop = codeAreaRef.current.scrollHeight;
        }
      });

      const ch = full[typedLenRef.current - 1];
      const isTap = typedLenRef.current > INITIAL_CODE.length;
      let delay = isTap ? 25 : 35;

      if (ch === '\n') {
        const lines = display.split('\n');
        const done = lines.length >= 2 ? lines[lines.length - 2] : '';
        if (done.trim().startsWith('//')) delay = 400;
        else if (done.trim() === '') delay = 300;
        else delay = 200;
      }

      sched(typeNext, delay);
    }

    function triggerReveal() {
      phaseRef.current = 'glitch';
      setPhase('glitch');
      typingActiveRef.current = false;

      const colors = ['#D4D4D4', '#FF0000', '#00FF00', '#0000FF'];
      let ci = 0;
      const flickerId = window.setInterval(() => {
        ci = (ci + 1) % colors.length;
        setGlitchColor(colors[ci]);
      }, 60);
      allIntervalsRef.current.push(flickerId);

      sched(() => {
        window.clearInterval(flickerId);
        setGlitchColor(null);
        phaseRef.current = 'fade';
        setPhase('fade');

        sched(() => {
          phaseRef.current = 'reveal';
          setPhase('reveal');
          typeReveal();
        }, 300);
      }, 500);
    }

    function typeReveal() {
      const l1 = '> it compiled.';
      const l2 = '> ship it.';
      let idx = 0;

      function step1() {
        if (idx < l1.length) {
          idx++;
          setRevealLines([l1.slice(0, idx)]);
          sched(step1, 50);
        } else {
          idx = 0;
          sched(step2, 400);
        }
      }

      function step2() {
        if (idx < l2.length) {
          idx++;
          setRevealLines([l1, l2.slice(0, idx)]);
          sched(step2, 50);
        } else {
          try { navigator.vibrate([50, 30, 80]); } catch { /* noop */ }
          onRevealRef.current?.();
        }
      }

      setRevealLines(['']);
      sched(step1, 50);
    }

    typeNextRef.current = typeNext;
    triggerRevealRef.current = triggerReveal;
    typeNext();

    return () => {
      allTimersRef.current.forEach(id => window.clearTimeout(id));
      allIntervalsRef.current.forEach(id => window.clearInterval(id));
    };
  }, []);

  const handleTap = () => {
    if (phaseRef.current !== 'typing') return;
    tapCountRef.current++;

    if (tapCountRef.current >= TAPS_TO_REVEAL) {
      triggerRevealRef.current();
      return;
    }

    if (snippetPoolRef.current.length === 0) {
      snippetPoolRef.current = [...Array(TAP_SNIPPETS.length).keys()];
    }
    const pi = Math.floor(Math.random() * snippetPoolRef.current.length);
    const si = snippetPoolRef.current[pi];
    snippetPoolRef.current.splice(pi, 1);

    fullCodeRef.current += '\n\n' + TAP_SNIPPETS[si];
    if (!typingActiveRef.current) {
      typeNextRef.current();
    }
  };

  const lines = displayedCode.split('\n');
  const showCursor = phase === 'typing';

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#1E1E1E',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 36,
          backgroundColor: '#323233',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 12,
          paddingRight: 12,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FF5F57' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#FEBC2E' }} />
          <span style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#28C840' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#858585',
            fontSize: 13,
          }}
        >
          vibe.js
        </div>
      </div>

      {/* Editor body */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          opacity: phase === 'fade' || phase === 'reveal' ? 0 : 1,
          transition: 'opacity 300ms ease',
          animation: phase === 'glitch' ? 'glitch-shake 80ms linear infinite' : undefined,
        }}
        {...(phase === 'glitch' ? { 'data-glitch': '' } : {})}
      >
        <div
          ref={codeAreaRef}
          className="vibe-code-area"
          style={{
            height: '100%',
            overflowY: 'auto',
            display: 'flex',
            padding: '8px 0',
            touchAction: 'pan-y',
            color: glitchColor || undefined,
          }}
          onClick={handleTap}
        >
          {/* Line numbers */}
          <div
            style={{
              width: 50,
              flexShrink: 0,
              borderRight: '1px solid #2D2D2D',
              userSelect: 'none',
            }}
          >
            {lines.map((_, i) => (
              <div
                key={i}
                style={{
                  height: 22,
                  lineHeight: '22px',
                  textAlign: 'right',
                  paddingRight: 12,
                  color: glitchColor || '#858585',
                  fontSize: 13,
                }}
              >
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code */}
          <div style={{ flex: 1, paddingLeft: 16, minWidth: 0 }}>
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  height: 22,
                  lineHeight: '22px',
                  fontSize: 14,
                  whiteSpace: 'pre',
                }}
              >
                {highlightLine(line, glitchColor)}
                {i === lines.length - 1 && showCursor && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 2,
                      height: 18,
                      backgroundColor: '#AEAFAD',
                      animation: 'cursor-blink 1s step-end infinite',
                      verticalAlign: 'text-bottom',
                      marginLeft: 1,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Reveal */}
      {phase === 'reveal' && (
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {revealLines.map((line, i) => (
            <div
              key={i}
              style={{
                fontSize: 20,
                fontFamily: FONT,
                color: i === 0 ? '#28C840' : '#C586C0',
                minHeight: 28,
              }}
            >
              {line}
              {i === revealLines.length - 1 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 18,
                    backgroundColor: '#AEAFAD',
                    animation: 'cursor-blink 1s step-end infinite',
                    verticalAlign: 'text-bottom',
                    marginLeft: 1,
                  }}
                />
              )}
            </div>
          ))}
        </motion.div>
      )}

      {/* Close button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="vibe-close-btn"
        style={{
          position: 'fixed',
          top: 10,
          right: 12,
          zIndex: 1020,
          background: 'none',
          border: 'none',
          color: '#858585',
          fontSize: 18,
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes glitch-shake {
          0%, 100% { transform: translateX(0) skewX(0); }
          20% { transform: translateX(2px) skewX(0.5deg); }
          40% { transform: translateX(-2px) skewX(-0.5deg); }
          60% { transform: translateX(0) skewX(0); }
          80% { transform: translateX(-1px) skewX(0.3deg); }
        }
        [data-glitch] span {
          color: inherit !important;
        }
        .vibe-code-area::-webkit-scrollbar {
          width: 6px;
        }
        .vibe-code-area::-webkit-scrollbar-track {
          background: transparent;
        }
        .vibe-code-area::-webkit-scrollbar-thumb {
          background: #3E3E3E;
          border-radius: 4px;
        }
        .vibe-close-btn:hover {
          color: #FFFFFF !important;
        }
      `}</style>
    </motion.div>
  );
}
