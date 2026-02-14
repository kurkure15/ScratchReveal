import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import BugSquashGame from './BugSquashGame';

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
  '// approved by mass copilot',
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
  "// I mass ship things\nconst deadline = new Date('yesterday');",
  "// AI wrote this. I mass approved it.\nif (Math.random() > 0.5) fix(bug);",
  "// Stack Overflow said this works\neval('trust me bro');",
  "sleep(until_it_works);",
  "// no diff too small to approve\ngit.push('--force', '--yolo');",
  "const salary = 'enough'.repeat(0);",
  "// written at 3am, shipped at 4am\nconst coffee = await brew();",
  "// this is fine. do not touch\nwhile(true) { hope(); }",
  "return null ?? undefined ?? 'vibes';",
  "// pressed merge before tests finished\nconsole.log('we are so back');",
];

const TAPS_TO_REVEAL = 3;

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

// ── Deploy line type ──────────────────────────────────────────────────

interface DeployLine {
  text: string;
  color: string;
  fontSize?: number;
  fontWeight?: number;
}

async function enterFullscreenIfAvailable() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };

  if (doc.fullscreenElement || doc.webkitFullscreenElement) return;

  try {
    if (root.requestFullscreen) {
      await root.requestFullscreen({ navigationUI: 'hide' });
      return;
    }
    if (root.webkitRequestFullscreen) {
      root.webkitRequestFullscreen();
    }
  } catch {
    // Browser/user settings may block fullscreen. Game still opens normally.
  }
}

// ── Component ─────────────────────────────────────────────────────────

export default function VibeCodingInteraction({
  onClose,
  onReveal,
}: VibeCodingProps) {
  const [displayedCode, setDisplayedCode] = useState('');
  const [phase, setPhase] = useState<'typing' | 'glitch' | 'fade' | 'deploy'>('typing');
  const [glitchColor, setGlitchColor] = useState<string | null>(null);
  const [deployLines, setDeployLines] = useState<DeployLine[]>([]);
  const [shaking, setShaking] = useState(false);
  const [bgColor, setBgColor] = useState('#2F2E5C');
  const [showGame, setShowGame] = useState(false);
  const [showTapHint, setShowTapHint] = useState(false);
  const [tapHintFading, setTapHintFading] = useState(false);
  const [showRedFlash, setShowRedFlash] = useState(false);
  const [showDefendButton, setShowDefendButton] = useState(false);

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
  const tapHintDismissedRef = useRef(false);

  const typeNextRef = useRef<() => void>(() => {});
  const triggerRevealRef = useRef<() => void>(() => {});
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    function sched(fn: () => void, ms: number) {
      const id = window.setTimeout(fn, ms);
      allTimersRef.current.push(id);
      return id;
    }

    function autoScroll() {
      requestAnimationFrame(() => {
        if (codeAreaRef.current) {
          codeAreaRef.current.scrollTop = codeAreaRef.current.scrollHeight;
        }
      });
    }

    // ── Sound helpers ───────────────────────────────────────────────

    function playBlip(freq: number, durationMs: number, gain: number) {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        vol.gain.setValueAtTime(gain, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + durationMs / 1000 + 0.01);
      } catch { /* noop */ }
    }

    function playChime() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      try {
        const osc1 = ctx.createOscillator();
        const vol1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.value = 523;
        vol1.gain.setValueAtTime(0.1, ctx.currentTime);
        vol1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc1.connect(vol1);
        vol1.connect(ctx.destination);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.16);

        const osc2 = ctx.createOscillator();
        const vol2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = 659;
        vol2.gain.setValueAtTime(0.1, ctx.currentTime + 0.15);
        vol2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc2.connect(vol2);
        vol2.connect(ctx.destination);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.31);
      } catch { /* noop */ }
    }

    // ── Warning sequence (after deploy) ────────────────────────────

    function playWarningSound() {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      try {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.type = 'square';
        osc.frequency.value = 200;
        vol.gain.setValueAtTime(0.08, ctx.currentTime);
        vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(vol);
        vol.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.21);
      } catch { /* noop */ }
    }

    function typeWarningLine(text: string, color: string) {
      setDeployLines(prev => [...prev, { text: '', color }]);
      let charIdx = 0;
      function typeChar() {
        charIdx++;
        setDeployLines(prev => {
          const next = [...prev];
          const last = next.length - 1;
          next[last] = { ...next[last], text: text.slice(0, charIdx) };
          return next;
        });
        autoScroll();
        if (charIdx < text.length) {
          sched(typeChar, 25);
        }
      }
      sched(typeChar, 25);
    }

    function runWarningSequence() {
      setShowRedFlash(true);
      playWarningSound();
      sched(() => setShowRedFlash(false), 150);

      sched(() => {
        typeWarningLine('> WARNING: bugs detected in production', '#FF5555');
      }, 200);

      sched(() => {
        typeWarningLine('> threat level: absolutely critical', '#FF5555');
      }, 1500);

      sched(() => {
        setShowDefendButton(true);
        try { navigator.vibrate([20, 10, 20]); } catch { /* noop */ }
      }, 2500);
    }

    // ── Code auto-type (unchanged) ──────────────────────────────────

    function typeNext() {
      const full = fullCodeRef.current;
      if (typedLenRef.current >= full.length) {
        typingActiveRef.current = false;
        if (tapCountRef.current === 0 && !tapHintDismissedRef.current) {
          sched(() => {
            if (!tapHintDismissedRef.current) {
              setShowTapHint(true);
            }
          }, 2000);
        }
        return;
      }

      typingActiveRef.current = true;
      typedLenRef.current++;
      const display = full.slice(0, typedLenRef.current);
      setDisplayedCode(display);

      if (typedLenRef.current > INITIAL_CODE.length) {
        try { navigator.vibrate(1); } catch { /* noop */ }
      }

      autoScroll();

      const ch = full[typedLenRef.current - 1];
      const isTap = typedLenRef.current > INITIAL_CODE.length;
      let delay = isTap ? 18 : 25;

      if (ch === '\n') {
        const lines = display.split('\n');
        const done = lines.length >= 2 ? lines[lines.length - 2] : '';
        if (done.trim().startsWith('//')) delay = 200;
        else if (done.trim() === '') delay = 100;
        else delay = 100;
      }

      sched(typeNext, delay);
    }

    // ── Deploy sequence ─────────────────────────────────────────────

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

      // Phase 1: Glitch 400ms
      sched(() => {
        window.clearInterval(flickerId);
        setGlitchColor(null);
        phaseRef.current = 'fade';
        setPhase('fade');

        // Phase 2: Fade 200ms then deploy
        sched(() => {
          phaseRef.current = 'deploy';
          setPhase('deploy');
          setDeployLines([]);
          runDeploySequence();
        }, 200);
      }, 400);
    }

    function runDeploySequence() {
      interface Step {
        text: string;
        color: string;
        speed: number;
        pause: number;
        fontSize?: number;
        fontWeight?: number;
        isProgressBar?: boolean;
        effectOnEnd?: string;
      }

      const steps: Step[] = [
        { text: '> compiling...', color: '#28C840', speed: 15, pause: 400 },
        { text: '> bundling dependencies...', color: '#28C840', speed: 15, pause: 300 },
        { text: '', color: '#28C840', speed: 0, pause: 100 },
        { text: '', color: '#28C840', speed: 30, pause: 400, isProgressBar: true },
        { text: '', color: '#28C840', speed: 0, pause: 100 },
        { text: '> deploying to production...', color: '#28C840', speed: 15, pause: 600 },
        { text: '> propagating to 142 edge nodes...', color: '#28C840', speed: 15, pause: 700 },
        { text: '', color: '#28C840', speed: 0, pause: 200 },
        { text: '\u2713 deployed. zero downtime.', color: '#4EC9B0', speed: 12, pause: 150, effectOnEnd: 'shake' },
        { text: '\u2713 0 tests passed (0 tests found)', color: '#4EC9B0', speed: 12, pause: 150 },
        { text: '\u2713 shipped to 12M users', color: '#4EC9B0', speed: 12, pause: 300 },
        { text: '', color: '#4EC9B0', speed: 0, pause: 400 },
        { text: 'shipped. lets go.', color: '#C586C0', speed: 30, pause: 0, fontSize: 18, fontWeight: 600, effectOnEnd: 'confetti' },
      ];

      let stepIdx = 0;

      function nextStep() {
        if (stepIdx >= steps.length) return;
        const step = steps[stepIdx];
        stepIdx++;

        // Progress bar — special
        if (step.isProgressBar) {
          typeProgressBar(step.color, step.pause);
          return;
        }

        // Empty line
        if (step.text === '') {
          setDeployLines(prev => [...prev, { text: '', color: step.color }]);
          autoScroll();
          sched(nextStep, step.pause);
          return;
        }

        // Regular deploy line
        typeDeployLine(step);
      }

      function typeDeployLine(step: Step) {
        // Sound at start of line
        if (step.text.startsWith('>')) playBlip(440, 60, 0.06);
        else if (step.text.startsWith('\u2713')) playBlip(660, 80, 0.08);

        // Add empty entry
        setDeployLines(prev => [...prev, {
          text: '',
          color: step.color,
          fontSize: step.fontSize,
          fontWeight: step.fontWeight,
        }]);

        let charIdx = 0;
        function typeChar() {
          charIdx++;
          setDeployLines(prev => {
            const next = [...prev];
            const last = next.length - 1;
            next[last] = { ...next[last], text: step.text.slice(0, charIdx) };
            return next;
          });
          autoScroll();

          if (charIdx < step.text.length) {
            sched(typeChar, step.speed);
          } else {
            onLineComplete(step);
          }
        }

        sched(typeChar, step.speed);
      }

      function typeProgressBar(color: string, pauseAfter: number) {
        const BLOCKS = 20;
        const prefix = '  [';
        const suffix = '] 100%';

        setDeployLines(prev => [...prev, { text: '', color }]);

        let pi = 0;
        let bi = 0;
        let si = 0;
        let barPhase: 'prefix' | 'blocks' | 'suffix' = 'prefix';

        function tick() {
          if (barPhase === 'prefix') {
            pi++;
            updateLast(prefix.slice(0, pi));
            if (pi < prefix.length) sched(tick, 20);
            else { barPhase = 'blocks'; sched(tick, 30); }
          } else if (barPhase === 'blocks') {
            bi++;
            playBlip(800 + (bi - 1) * 20, 30, 0.04);
            updateLast(prefix + '\u2588'.repeat(bi));
            if (bi < BLOCKS) sched(tick, 30);
            else { barPhase = 'suffix'; sched(tick, 20); }
          } else {
            si++;
            updateLast(prefix + '\u2588'.repeat(BLOCKS) + suffix.slice(0, si));
            if (si < suffix.length) sched(tick, 20);
            else sched(nextStep, pauseAfter);
          }
          autoScroll();
        }

        sched(tick, 20);
      }

      function updateLast(text: string) {
        setDeployLines(prev => {
          const next = [...prev];
          const last = next.length - 1;
          next[last] = { ...next[last], text };
          return next;
        });
      }

      function onLineComplete(step: Step) {
        if (step.effectOnEnd === 'shake') {
          setShaking(true);
          setBgColor('#1a2e1a');
          sched(() => setBgColor('#2F2E5C'), 150);
          sched(() => setShaking(false), 300);
        }

        if (step.effectOnEnd === 'confetti') {
          playChime();
          try { navigator.vibrate([50, 30, 80]); } catch { /* noop */ }
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6, x: 0.5 },
            colors: ['#28C840', '#C586C0', '#DCDCAA', '#CE9178'],
            startVelocity: 30,
          });
          onRevealRef.current?.();
          sched(() => runWarningSequence(), 1000);
        }

        if (step.pause > 0) sched(nextStep, step.pause);
        else nextStep();
      }

      nextStep();
    }

    typeNextRef.current = typeNext;
    triggerRevealRef.current = triggerReveal;
    typeNext();

    return () => {
      allTimersRef.current.forEach(id => window.clearTimeout(id));
      allIntervalsRef.current.forEach(id => window.clearInterval(id));
    };
  }, []);

  // ── Full-bleed: theme-color + document background ──────────────────
  useEffect(() => {
    const origBg = document.documentElement.style.backgroundColor;
    document.documentElement.style.backgroundColor = '#1E1E1E';

    const existingMeta = document.querySelector('meta[name="theme-color"]');
    const origTheme = existingMeta?.getAttribute('content') ?? null;
    const meta = existingMeta || document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', '#1E1E1E');
    if (!meta.parentNode) document.head.appendChild(meta);

    return () => {
      document.documentElement.style.backgroundColor = origBg;
      if (origTheme !== null) {
        meta.setAttribute('content', origTheme);
      } else if (meta.parentNode) {
        meta.parentNode.removeChild(meta);
      }
    };
  }, []);

  const handleTap = () => {
    // Init AudioContext on first user gesture
    if (!audioCtxRef.current) {
      try { audioCtxRef.current = new AudioContext(); } catch { /* noop */ }
    }

    // Dismiss tap hint on first tap
    if (!tapHintDismissedRef.current) {
      tapHintDismissedRef.current = true;
      setTapHintFading(true);
      setTimeout(() => setShowTapHint(false), 200);
    }

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

  const codeLines = displayedCode.split('\n');
  const showCodeCursor = phase === 'typing';
  const isDeploy = phase === 'deploy';

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        zIndex: 1000,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Inner wrapper for shake + bg color */}
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: bgColor,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONT,
          animation: shaking ? 'deploy-shake 300ms ease' : undefined,
        }}
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
            paddingTop: 'env(safe-area-inset-top)',
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
            opacity: phase === 'fade' ? 0 : 1,
            transition: phase === 'fade' ? 'opacity 200ms ease' : 'opacity 0ms',
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
            {/* Code / deploy content */}
            <div style={{ flex: 1, padding: '0 16px', minWidth: 0 }}>
              {isDeploy
                ? <>
                    {deployLines.map((dl, i) => (
                      <div
                        key={i}
                        style={{
                          height: dl.fontSize ? dl.fontSize + 8 : 22,
                          lineHeight: dl.fontSize ? `${dl.fontSize + 8}px` : '22px',
                          fontSize: dl.fontSize || 14,
                          fontWeight: dl.fontWeight || 400,
                          whiteSpace: 'pre',
                          color: dl.color,
                        }}
                      >
                        {dl.text}
                        {i === deployLines.length - 1 && !showDefendButton && (
                          <span
                            style={{
                              display: 'inline-block',
                              width: 2,
                              height: dl.fontSize ? dl.fontSize + 2 : 18,
                              backgroundColor: '#AEAFAD',
                              animation: 'cursor-blink 1s step-end infinite',
                              verticalAlign: 'text-bottom',
                              marginLeft: 1,
                            }}
                          />
                        )}
                      </div>
                    ))}
                    {showDefendButton && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: 24,
                      }}>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            void enterFullscreenIfAvailable();
                            setShowGame(true);
                          }}
                          style={{
                            color: '#28C840',
                            fontSize: 18,
                            fontFamily: FONT,
                            fontWeight: 600,
                            border: '2px solid #28C840',
                            borderRadius: 8,
                            padding: '12px 32px',
                            cursor: 'pointer',
                            animation: 'defend-glow 1s ease-in-out infinite',
                          }}
                        >
                          [ DEFEND ]
                        </div>
                      </div>
                    )}
                  </>
                : <>
                    {codeLines.map((line, i) => (
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
                        {i === codeLines.length - 1 && showCodeCursor && (
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
                    {showTapHint && (
                      <div
                        style={{
                          textAlign: 'center',
                          marginTop: 24,
                          fontSize: 12,
                          fontWeight: 400,
                          color: '#858585',
                          letterSpacing: 1,
                          fontFamily: FONT,
                          animation: tapHintFading
                            ? 'tap-hint-fadeout 200ms ease forwards'
                            : 'tap-hint-fadein 800ms ease forwards, tap-hint-pulse 2s 800ms ease-in-out infinite',
                          opacity: 0,
                        }}
                      >
                        tap anywhere
                      </div>
                    )}
                  </>}
            </div>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="vibe-close-btn"
          style={{
            position: 'absolute',
            top: 'max(env(safe-area-inset-top), 10px)',
            right: 'max(env(safe-area-inset-right), 12px)',
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
      </div>

      {/* Red flash overlay */}
      {showRedFlash && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(255,0,0,0.15)',
          pointerEvents: 'none',
          zIndex: 1010,
        }} />
      )}

      {/* Bug Squash Game overlay */}
      <AnimatePresence>
        {showGame && (
          <BugSquashGame
            key="bugsquash"
            onClose={onClose}
            onComplete={() => {}}
          />
        )}
      </AnimatePresence>

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
        @keyframes deploy-shake {
          0% { transform: translateX(0); }
          20% { transform: translateX(3px); }
          40% { transform: translateX(-3px); }
          60% { transform: translateX(2px); }
          80% { transform: translateX(-2px); }
          100% { transform: translateX(0); }
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
        @keyframes tap-hint-fadein {
          from { opacity: 0; }
          to { opacity: 0.6; }
        }
        @keyframes tap-hint-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.4; }
        }
        @keyframes tap-hint-fadeout {
          from { opacity: 0.6; }
          to { opacity: 0; }
        }
        @keyframes defend-glow {
          0%, 100% { box-shadow: 0 0 10px rgba(40,200,64,0.3); }
          50% { box-shadow: 0 0 25px rgba(40,200,64,0.6); }
        }
      `}</style>
    </motion.div>
  );
}
