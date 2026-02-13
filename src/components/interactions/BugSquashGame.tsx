import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { soundSystem } from '../../design/sounds';
import rocketImg from '../../assets/rocket.svg';

interface BugSquashGameProps {
  onClose: () => void;
  onComplete?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────

const GAME_DURATION = 30; // seconds
const PLAYER_SIZE = 28;
const BULLET_SPEED = 10;
const BULLET_SIZE = 4;
const MAX_BULLETS = 3;
const BULLET_COOLDOWN = 200; // ms
const BUG_WIDTH = 90;
const BUG_HEIGHT = 28;
const BUG_BASE_SPEED = 1.2;
const SPAWN_INTERVAL_START = 1200; // ms
const SPAWN_INTERVAL_MIN = 400; // ms
const PARTICLE_COUNT = 8;
const PARTICLE_LIFE = 30; // frames
const FONT = "'SF Mono', 'Fira Code', Consolas, monospace";
const GAME_CHROME_COLOR = '#000000';

const BUG_TEXTS = [
  'NaN',
  'undefined',
  'null ref',
  'seg fault',
  'stack overflow',
  'mem leak',
  'type error',
  'off by 1',
  'race cond',
  '404',
  'CORS',
  'timeout',
  'deadlock',
  'inf loop',
  'heap OOM',
  'div by 0',
  'syntax err',
  'logic bug',
  'edge case',
  'prod down',
];

// ── Types ────────────────────────────────────────────────────────────────

interface Player {
  x: number;
  y: number;
  targetX: number;
}

interface Bullet {
  x: number;
  y: number;
  active: boolean;
}

interface Bug {
  x: number;
  y: number;
  speed: number;
  text: string;
  wobbleOffset: number;
  wobbleSpeed: number;
  active: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface GameState {
  player: Player;
  bullets: Bullet[];
  bugs: Bug[];
  particles: Particle[];
  score: number;
  timeLeft: number;
  lastBulletTime: number;
  lastSpawnTime: number;
  flashAlpha: number;
  flashColor: string;
  frame: number;
  started: boolean;
  gameOver: boolean;
}

// ── Sound helpers ────────────────────────────────────────────────────────

function playHitSound(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 800 + Math.random() * 400;
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch { /* noop */ }
}

function playBugReachSound(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  } catch { /* noop */ }
}

function playShootSound(ctx: AudioContext) {
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  } catch { /* noop */ }
}

// ── Component ────────────────────────────────────────────────────────────

export default function BugSquashGame({ onClose, onComplete }: BugSquashGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const rafRef = useRef(0);
  const timerRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rocketImgRef = useRef<HTMLImageElement | null>(null);

  const [phase, setPhase] = useState<'playing' | 'results'>('playing');
  const [resultLines, setResultLines] = useState<string[]>([]);
  const [showCloseBtn, setShowCloseBtn] = useState(false);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Exit fullscreen when leaving game mode.
  useEffect(() => {
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => undefined);
      }
    };
  }, []);

  // Keep browser chrome/background black while game mode is active.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const previousHtmlBg = html.style.backgroundColor;
    const previousBodyBg = body.style.backgroundColor;
    html.style.backgroundColor = GAME_CHROME_COLOR;
    body.style.backgroundColor = GAME_CHROME_COLOR;

    type MetaState = {
      element: HTMLMetaElement;
      existed: boolean;
      previousContent: string | null;
    };

    const upsertMeta = (name: string, content: string): MetaState => {
      let element = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      const existed = !!element;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute('name', name);
        document.head.appendChild(element);
      }
      const previousContent = element.getAttribute('content');
      element.setAttribute('content', content);
      return { element, existed, previousContent };
    };

    const restoreMeta = ({ element, existed, previousContent }: MetaState) => {
      if (!existed) {
        element.remove();
        return;
      }
      if (previousContent === null) {
        element.removeAttribute('content');
      } else {
        element.setAttribute('content', previousContent);
      }
    };

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    const themeMetaState = upsertMeta('theme-color', GAME_CHROME_COLOR);
    const appleStatusMetaState = upsertMeta(
      'apple-mobile-web-app-status-bar-style',
      isStandalone ? 'black' : 'black-translucent'
    );

    return () => {
      html.style.backgroundColor = previousHtmlBg;
      body.style.backgroundColor = previousBodyBg;
      restoreMeta(themeMetaState);
      restoreMeta(appleStatusMetaState);
    };
  }, []);

  // ── Init game state ──────────────────────────────────────────────────

  const initGame = useCallback((w: number, h: number): GameState => ({
    player: { x: w / 2, y: h * 0.9, targetX: w / 2 },
    bullets: [],
    bugs: [],
    particles: [],
    score: 0,
    timeLeft: GAME_DURATION,
    lastBulletTime: 0,
    lastSpawnTime: 0,
    flashAlpha: 0,
    flashColor: '#FF0000',
    frame: 0,
    started: true,
    gameOver: false,
  }), []);

  // ── Main effect ──────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    // Load rocket image
    const img = new Image();
    img.src = rocketImg;
    rocketImgRef.current = img;

    // Init audio
    try { audioCtxRef.current = new AudioContext(); } catch { /* noop */ }

    // Size canvas
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx2d.scale(dpr, dpr);

    const game = initGame(w, h);
    gameRef.current = game;

    // Timer
    timerRef.current = window.setInterval(() => {
      if (!gameRef.current || gameRef.current.gameOver) return;
      gameRef.current.timeLeft--;
      if (gameRef.current.timeLeft <= 0) {
        gameRef.current.gameOver = true;
      }
    }, 1000);

    // ── Input ──────────────────────────────────────────────────────────

    function handleInput(clientX: number) {
      const g = gameRef.current;
      if (!g || g.gameOver) return;

      // Move ship toward tap X
      g.player.targetX = Math.max(PLAYER_SIZE, Math.min(w - PLAYER_SIZE, clientX));

      // Shoot
      const now = performance.now();
      const activeBullets = g.bullets.filter(b => b.active).length;
      if (activeBullets < MAX_BULLETS && now - g.lastBulletTime > BULLET_COOLDOWN) {
        g.lastBulletTime = now;
        g.bullets.push({
          x: g.player.x,
          y: g.player.y - PLAYER_SIZE,
          active: true,
        });
        if (audioCtxRef.current) playShootSound(audioCtxRef.current);
      }
    }

    function handleTouches(touches: TouchList) {
      for (let i = 0; i < touches.length; i++) {
        handleInput(touches[i].clientX);
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      handleTouches(e.touches);
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      handleTouches(e.touches);
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
    }

    function onClick(e: MouseEvent) {
      handleInput(e.clientX);
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    canvas.addEventListener('click', onClick);

    // ── Spawn ──────────────────────────────────────────────────────────

    function spawnBug(g: GameState) {
      const elapsed = GAME_DURATION - g.timeLeft;
      const speedMultiplier = 1 + elapsed * 0.04;
      g.bugs.push({
        x: BUG_WIDTH / 2 + Math.random() * (w - BUG_WIDTH),
        y: -BUG_HEIGHT,
        speed: BUG_BASE_SPEED * speedMultiplier * (0.8 + Math.random() * 0.4),
        text: BUG_TEXTS[Math.floor(Math.random() * BUG_TEXTS.length)],
        wobbleOffset: Math.random() * Math.PI * 2,
        wobbleSpeed: 2 + Math.random() * 3,
        active: true,
      });
    }

    // ── Game loop ──────────────────────────────────────────────────────

    function loop() {
      const g = gameRef.current;
      if (!g) return;

      g.frame++;
      const now = performance.now();

      // ── Spawn bugs ───────────────────────────────────────────────────
      if (!g.gameOver) {
        const elapsed = GAME_DURATION - g.timeLeft;
        const interval = Math.max(
          SPAWN_INTERVAL_MIN,
          SPAWN_INTERVAL_START - elapsed * 30
        );
        if (now - g.lastSpawnTime > interval) {
          g.lastSpawnTime = now;
          spawnBug(g);
        }
      }

      // ── Update player position (lerp toward targetX) ─────────────────
      const lerpSpeed = 0.15; // ~150ms to reach target at 60fps
      g.player.x += (g.player.targetX - g.player.x) * lerpSpeed;

      // ── Update bullets ───────────────────────────────────────────────
      for (const b of g.bullets) {
        if (!b.active) continue;
        b.y -= BULLET_SPEED;
        if (b.y < -10) b.active = false;
      }

      // ── Update bugs ──────────────────────────────────────────────────
      for (const bug of g.bugs) {
        if (!bug.active) continue;
        bug.y += bug.speed;
        bug.x += Math.sin(g.frame * 0.05 * bug.wobbleSpeed + bug.wobbleOffset) * 0.8;

        // Bug reached bottom
        if (bug.y > h - 40) {
          bug.active = false;
          g.score = Math.max(0, g.score - 5);
          g.flashAlpha = 0.3;
          g.flashColor = '#FF0000';
          if (audioCtxRef.current) playBugReachSound(audioCtxRef.current);
          try { navigator.vibrate(30); } catch { /* noop */ }
        }
      }

      // ── Collision detection ──────────────────────────────────────────
      for (const b of g.bullets) {
        if (!b.active) continue;
        for (const bug of g.bugs) {
          if (!bug.active) continue;
          // AABB
          if (
            b.x > bug.x - BUG_WIDTH / 2 &&
            b.x < bug.x + BUG_WIDTH / 2 &&
            b.y > bug.y - BUG_HEIGHT / 2 &&
            b.y < bug.y + BUG_HEIGHT / 2
          ) {
            b.active = false;
            bug.active = false;
            g.score += 10;

            // Particles
            const colors = ['#28C840', '#DCDCAA', '#4EC9B0', '#CE9178'];
            for (let p = 0; p < PARTICLE_COUNT; p++) {
              const angle = (Math.PI * 2 * p) / PARTICLE_COUNT + Math.random() * 0.5;
              g.particles.push({
                x: bug.x,
                y: bug.y,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(angle) * (2 + Math.random() * 3),
                life: PARTICLE_LIFE,
                color: colors[p % colors.length],
              });
            }

            if (audioCtxRef.current) playHitSound(audioCtxRef.current);
            try { navigator.vibrate(5); } catch { /* noop */ }
          }
        }
      }

      // ── Update particles ─────────────────────────────────────────────
      for (const p of g.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // gravity
        p.life--;
      }

      // ── Cleanup ──────────────────────────────────────────────────────
      g.bullets = g.bullets.filter(b => b.active);
      g.bugs = g.bugs.filter(b => b.active);
      g.particles = g.particles.filter(p => p.life > 0);

      // Flash decay
      if (g.flashAlpha > 0) g.flashAlpha -= 0.015;

      // ── Draw ─────────────────────────────────────────────────────────
      draw(ctx2d, g, w, h);

      // ── Game over check ──────────────────────────────────────────────
      if (g.gameOver && g.bugs.length === 0 && g.particles.length === 0) {
        endGame(g);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    function draw(c: CanvasRenderingContext2D, g: GameState, cw: number, ch: number) {
      // Background
      c.fillStyle = '#0a0a0a';
      c.fillRect(0, 0, cw, ch);

      // Grid lines (subtle)
      c.strokeStyle = 'rgba(40, 200, 64, 0.06)';
      c.lineWidth = 1;
      for (let gx = 0; gx < cw; gx += 40) {
        c.beginPath();
        c.moveTo(gx, 0);
        c.lineTo(gx, ch);
        c.stroke();
      }
      for (let gy = 0; gy < ch; gy += 40) {
        c.beginPath();
        c.moveTo(0, gy);
        c.lineTo(cw, gy);
        c.stroke();
      }

      // ── Player ship (rocket image) ──────────────────────────────────
      const rImg = rocketImgRef.current;
      if (rImg && rImg.complete && rImg.naturalWidth > 0) {
        c.shadowColor = '#28C840';
        c.shadowBlur = 12;
        c.drawImage(rImg, g.player.x - 16, g.player.y - 20, 32, 40);
        c.shadowBlur = 0;
      } else {
        // Fallback triangle while image loads
        c.fillStyle = '#28C840';
        c.beginPath();
        c.moveTo(g.player.x, g.player.y - PLAYER_SIZE);
        c.lineTo(g.player.x - PLAYER_SIZE * 0.7, g.player.y + PLAYER_SIZE * 0.3);
        c.lineTo(g.player.x + PLAYER_SIZE * 0.7, g.player.y + PLAYER_SIZE * 0.3);
        c.closePath();
        c.fill();
      }

      // ── Bullets ────────────────────────────────────────────────────
      c.fillStyle = '#DCDCAA';
      for (const b of g.bullets) {
        c.shadowColor = '#DCDCAA';
        c.shadowBlur = 6;
        c.fillRect(b.x - BULLET_SIZE / 2, b.y - BULLET_SIZE, BULLET_SIZE, BULLET_SIZE * 2);
        c.shadowBlur = 0;
      }

      // ── Bugs ───────────────────────────────────────────────────────
      for (const bug of g.bugs) {
        // Bug body
        c.fillStyle = 'rgba(255, 50, 50, 0.15)';
        c.strokeStyle = '#FF3232';
        c.lineWidth = 1.5;
        const bx = bug.x - BUG_WIDTH / 2;
        const by = bug.y - BUG_HEIGHT / 2;
        c.fillRect(bx, by, BUG_WIDTH, BUG_HEIGHT);
        c.strokeRect(bx, by, BUG_WIDTH, BUG_HEIGHT);

        // Bug text
        c.fillStyle = '#FF6464';
        c.font = `bold 12px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(bug.text, bug.x, bug.y);
      }

      // ── Particles ──────────────────────────────────────────────────
      for (const p of g.particles) {
        const alpha = p.life / PARTICLE_LIFE;
        c.globalAlpha = alpha;
        c.fillStyle = p.color;
        const size = 3 + alpha * 3;
        c.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      c.globalAlpha = 1;

      // ── Flash overlay ──────────────────────────────────────────────
      if (g.flashAlpha > 0) {
        c.fillStyle = g.flashColor;
        c.globalAlpha = g.flashAlpha;
        c.fillRect(0, 0, cw, ch);
        c.globalAlpha = 1;
      }

      // ── Scanlines ──────────────────────────────────────────────────
      c.fillStyle = 'rgba(0, 0, 0, 0.04)';
      for (let sy = 0; sy < ch; sy += 3) {
        c.fillRect(0, sy, cw, 1);
      }

      // ── CRT vignette ──────────────────────────────────────────────
      const grad = c.createRadialGradient(cw / 2, ch / 2, cw * 0.3, cw / 2, ch / 2, cw * 0.8);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.4)');
      c.fillStyle = grad;
      c.fillRect(0, 0, cw, ch);

      // ── HUD ────────────────────────────────────────────────────────
      c.font = `bold 14px ${FONT}`;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillStyle = '#28C840';
      c.fillText(`SCORE: ${g.score}`, 16, 50);

      c.textAlign = 'right';
      c.fillStyle = g.timeLeft <= 5 ? '#FF3232' : '#28C840';
      c.fillText(`TIME: ${g.timeLeft}s`, cw - 16, 50);

      // "PRODUCTION DOWN" flash text
      if (g.flashAlpha > 0.1) {
        c.font = `bold 18px ${FONT}`;
        c.textAlign = 'center';
        c.fillStyle = '#FF3232';
        c.globalAlpha = Math.min(1, g.flashAlpha * 3);
        c.fillText('PRODUCTION DOWN', cw / 2, ch / 2);
        c.globalAlpha = 1;
      }
    }

    // ── End game ─────────────────────────────────────────────────────

    function endGame(g: GameState) {
      clearInterval(timerRef.current);
      setPhase('results');

      // Type out results
      const lines = [
        `> session complete`,
        `> bugs squashed: ${Math.floor(g.score / 10)}`,
        `> score: ${g.score}`,
        `> rating: ${g.score >= 200 ? '10x engineer' : g.score >= 100 ? 'senior dev' : g.score >= 50 ? 'mid level' : 'intern'}`,
        '',
        g.score >= 100 ? '✓ promoted.' : '✓ survived.',
      ];

      let lineIdx = 0;
      function typeLine() {
        if (lineIdx >= lines.length) {
          // Confetti + close button
          soundSystem.reveal();
          try { navigator.vibrate([50, 30, 100]); } catch { /* noop */ }
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.5, x: 0.5 },
            colors: ['#28C840', '#DCDCAA', '#4EC9B0', '#CE9178', '#C586C0'],
          });
          onCompleteRef.current?.();
          setTimeout(() => setShowCloseBtn(true), 800);
          return;
        }

        const line = lines[lineIdx];
        lineIdx++;

        if (line === '') {
          setResultLines(prev => [...prev, '']);
          setTimeout(typeLine, 300);
          return;
        }

        // Type char by char
        let ci = 0;
        setResultLines(prev => [...prev, '']);
        function typeChar() {
          ci++;
          setResultLines(prev => {
            const next = [...prev];
            next[next.length - 1] = line.slice(0, ci);
            return next;
          });
          if (ci < line.length) {
            setTimeout(typeChar, 20);
          } else {
            setTimeout(typeLine, 400);
          }
        }
        setTimeout(typeChar, 20);
      }

      setTimeout(typeLine, 600);
    }

    // Start
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(timerRef.current);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      canvas.removeEventListener('click', onClick);
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, [initGame]);

  return (
    <motion.div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        backgroundColor: '#0a0a0a',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {phase === 'playing' && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            touchAction: 'none',
          }}
        />
      )}

      <AnimatePresence>
        {phase === 'results' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 32,
            }}
          >
            <div
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: '#28C840',
                textAlign: 'left',
                maxWidth: 340,
                width: '100%',
              }}
            >
              {resultLines.map((line, i) => (
                <div
                  key={i}
                  style={{
                    height: 24,
                    lineHeight: '24px',
                    whiteSpace: 'pre',
                    color: line.startsWith('✓') ? '#4EC9B0' :
                           line.startsWith('> rating') ? '#C586C0' :
                           '#28C840',
                    fontWeight: line.startsWith('✓') ? 600 : 400,
                    fontSize: line.startsWith('✓') ? 16 : 14,
                  }}
                >
                  {line}
                  {i === resultLines.length - 1 && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 2,
                        height: 16,
                        backgroundColor: '#28C840',
                        animation: 'bug-cursor-blink 1s step-end infinite',
                        verticalAlign: 'text-bottom',
                        marginLeft: 2,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {showCloseBtn && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                onClick={onClose}
                style={{
                  marginTop: 40,
                  background: 'none',
                  border: '1px solid #28C840',
                  color: '#28C840',
                  fontFamily: FONT,
                  fontSize: 14,
                  padding: '8px 24px',
                  cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                [ close ]
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanline overlay for results too */}
      {phase === 'results' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 1px, transparent 1px, transparent 3px)',
          }}
        />
      )}

      <style>{`
        @keyframes bug-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
}
