import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

interface ScrollProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

type GamePhase = 'instructions' | 'countdown' | 'playing' | 'roundEnd' | 'gameOver';
type RoundWinner = 'ai' | 'user' | 'draw' | null;

const GOAL_LEFT_RATIO = 268 / 1440;
const GOAL_RIGHT_RATIO = 1169 / 1440;
const ROPE_LEFT_RATIO = 500 / 1440;
const ROPE_RIGHT_RATIO = 940 / 1440;
const ROPE_CENTER_Y_RATIO = 520 / 1024;
const MOBILE_BREAKPOINT = 900;
const MOBILE_ROPE_X_RATIO = 196.5 / 393;
const MOBILE_ROPE_TOP_RATIO = 311.750244140625 / 852;
const MOBILE_ROPE_BOTTOM_RATIO = 559.9998779296875 / 852;
const MOBILE_GOAL_TOP_CENTER_RATIO = 156 / 852;
const MOBILE_GOAL_BOTTOM_CENTER_RATIO = 712 / 852;
const CROSS_ICON_SRC = '/src/assets/Cross.svg';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function baseAiForceForRound(round: number) {
  if (round === 1) return 0.3;
  if (round === 2) return 0.5;
  return 0.7;
}

export default function ScrollInteraction({ onClose, cardColor, onReveal }: ScrollProps) {
  void cardColor;

  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [roundNumber, setRoundNumber] = useState<1 | 2 | 3>(1);
  const [aiScore, setAiScore] = useState(0);
  const [userScore, setUserScore] = useState(0);
  const [roundWinner, setRoundWinner] = useState<RoundWinner>(null);
  const [crossIconFailed, setCrossIconFailed] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= MOBILE_BREAKPOINT;
  });

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const gameElementsRef = useRef<HTMLDivElement | null>(null);
  const bgTintRef = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);

  const ropeRef = useRef<HTMLDivElement | null>(null);
  const ropeLeftTintRef = useRef<HTMLDivElement | null>(null);
  const ropeRightTintRef = useRef<HTMLDivElement | null>(null);

  const yellowKnotRef = useRef<HTMLDivElement | null>(null);
  const redDotRef = useRef<HTMLDivElement | null>(null);
  const blueDotRef = useRef<HTMLDivElement | null>(null);

  const countdownTextRef = useRef<HTMLDivElement | null>(null);

  const gameOverWrapRef = useRef<HTMLDivElement | null>(null);
  const gameOverLine1Ref = useRef<HTMLDivElement | null>(null);
  const gameOverLine2Ref = useRef<HTMLDivElement | null>(null);
  const gameOverLine3Ref = useRef<HTMLDivElement | null>(null);

  const rafRef = useRef<number | null>(null);
  const timeoutIdsRef = useRef<number[]>([]);

  const ropeOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragLastXRef = useRef(0);
  const currentDragXRef = useRef(0);
  const aiForceRef = useRef(0);
  const elapsedTimeRef = useRef(0);

  const roundNumberRef = useRef<1 | 2 | 3>(1);
  const aiScoreRef = useRef(0);
  const userScoreRef = useRef(0);
  const phaseRef = useRef<GamePhase>('instructions');

  const lastFrameTsRef = useRef<number | null>(null);
  const lastCreakTsRef = useRef(0);
  const roundResolvedRef = useRef(false);
  const onRevealCalledRef = useRef(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioMasterRef = useRef<GainNode | null>(null);

  const queueTimeout = useCallback((fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeoutIdsRef.current.push(id);
    return id;
  }, []);

  const clearQueuedTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  const ensureAudioContext = useCallback(() => {
    if (audioCtxRef.current) return audioCtxRef.current;

    const AudioCtor = window.AudioContext
      || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtor) return null;

    const ctx = new AudioCtor();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    audioCtxRef.current = ctx;
    audioMasterRef.current = master;

    return ctx;
  }, []);

  const playTone = useCallback((frequency: number, durationMs: number, peakGain: number, delayMs = 0) => {
    const ctx = ensureAudioContext();
    const master = audioMasterRef.current;
    if (!ctx || !master) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const start = ctx.currentTime + delayMs / 1000;
    const end = start + durationMs / 1000;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.02, durationMs / 1000 / 2));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.connect(gain);
    gain.connect(master);

    osc.start(start);
    osc.stop(end + 0.02);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  }, [ensureAudioContext]);

  const playNoiseBurst = useCallback((durationMs: number, frequency: number, peakGain: number) => {
    const ctx = ensureAudioContext();
    const master = audioMasterRef.current;
    if (!ctx || !master) return;

    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * (durationMs / 1000)));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;

    gain.gain.value = peakGain;

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);

    source.start();
    source.stop(ctx.currentTime + durationMs / 1000 + 0.01);

    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }, [ensureAudioContext]);

  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const setBlueGrabbedVisual = useCallback((grabbed: boolean) => {
    const blue = blueDotRef.current;
    if (!blue) return;

    if (grabbed) {
      blue.style.background = '#2E84FF';
      blue.style.transform = 'translate(-50%, -50%) scale(1.3)';
      blue.style.boxShadow = '0 0 12px rgba(46,132,255,0.6)';
    } else {
      blue.style.background = '#FFFFFF';
      blue.style.transform = 'translate(-50%, -50%) scale(1)';
      blue.style.boxShadow = 'none';
    }
  }, []);

  const getRopeMetrics = useCallback((ropeOffset: number) => {
    if (isMobileLayout) {
      const ropeBaseTop = window.innerHeight * MOBILE_ROPE_TOP_RATIO;
      const ropeBaseBottom = window.innerHeight * MOBILE_ROPE_BOTTOM_RATIO;
      const ropeCenterY = (ropeBaseTop + ropeBaseBottom) / 2;
      const ropeHalfLength = (ropeBaseBottom - ropeBaseTop) / 2;
      const ropeCenterX = window.innerWidth * MOBILE_ROPE_X_RATIO;

      const goalTop = window.innerHeight * MOBILE_GOAL_TOP_CENTER_RATIO;
      const goalBottom = window.innerHeight * MOBILE_GOAL_BOTTOM_CENTER_RATIO;

      const ropeStart = ropeCenterY - ropeHalfLength + ropeOffset;
      const ropeEnd = ropeCenterY + ropeHalfLength + ropeOffset;

      const aiWinOffset = goalTop - (ropeCenterY - ropeHalfLength);
      const userWinOffset = goalBottom - (ropeCenterY + ropeHalfLength);
      const span = userWinOffset - aiWinOffset;
      const normalized = span === 0 ? 0.5 : clamp((ropeOffset - aiWinOffset) / span, 0, 1);

      return {
        isMobile: true as const,
        ropeCenterX,
        ropeCenterY,
        ropeStart,
        ropeEnd,
        goalMin: goalTop,
        goalMax: goalBottom,
        aiWinOffset,
        userWinOffset,
        normalized,
      };
    }

    const ropeBaseLeft = window.innerWidth * ROPE_LEFT_RATIO;
    const ropeBaseRight = window.innerWidth * ROPE_RIGHT_RATIO;
    const ropeCenterX = (ropeBaseLeft + ropeBaseRight) / 2;
    const ropeHalfLength = (ropeBaseRight - ropeBaseLeft) / 2;
    const ropeCenterY = window.innerHeight * ROPE_CENTER_Y_RATIO;

    const goalLeft = window.innerWidth * GOAL_LEFT_RATIO;
    const goalRight = window.innerWidth * GOAL_RIGHT_RATIO;

    const ropeStart = ropeCenterX - ropeHalfLength + ropeOffset;
    const ropeEnd = ropeCenterX + ropeHalfLength + ropeOffset;

    const aiWinOffset = goalLeft - (ropeCenterX - ropeHalfLength);
    const userWinOffset = goalRight - (ropeCenterX + ropeHalfLength);
    const span = userWinOffset - aiWinOffset;
    const normalized = span === 0 ? 0.5 : clamp((ropeOffset - aiWinOffset) / span, 0, 1);

    return {
      isMobile: false as const,
      ropeCenterX,
      ropeCenterY,
      ropeStart,
      ropeEnd,
      goalMin: goalLeft,
      goalMax: goalRight,
      aiWinOffset,
      userWinOffset,
      normalized,
    };
  }, [isMobileLayout]);

  const updateVisualsFromOffset = useCallback((ropeOffset: number) => {
    const metrics = getRopeMetrics(ropeOffset);

    if (ropeRef.current) {
      if (metrics.isMobile) {
        ropeRef.current.style.left = `${metrics.ropeCenterX}px`;
        ropeRef.current.style.top = `${metrics.ropeStart}px`;
        ropeRef.current.style.width = '8px';
        ropeRef.current.style.height = `${metrics.ropeEnd - metrics.ropeStart}px`;
        ropeRef.current.style.right = 'auto';
      } else {
        ropeRef.current.style.left = `${metrics.ropeStart}px`;
        ropeRef.current.style.top = `${metrics.ropeCenterY}px`;
        ropeRef.current.style.width = `${metrics.ropeEnd - metrics.ropeStart}px`;
        ropeRef.current.style.height = '8px';
        ropeRef.current.style.right = 'auto';
      }
    }

    if (yellowKnotRef.current) {
      yellowKnotRef.current.style.left = `${metrics.ropeCenterX}px`;
      yellowKnotRef.current.style.top = `${metrics.ropeCenterY}px`;

      if (isDraggingRef.current) {
        yellowKnotRef.current.style.boxShadow = '0 0 16px rgba(255,217,61,0.7)';
      } else {
        yellowKnotRef.current.style.boxShadow = '0 0 8px rgba(255,217,61,0.3)';
      }
    }

    if (redDotRef.current) {
      redDotRef.current.style.left = `${metrics.isMobile ? metrics.ropeCenterX : metrics.ropeStart}px`;
      redDotRef.current.style.top = `${metrics.isMobile ? metrics.ropeStart : metrics.ropeCenterY}px`;
      redDotRef.current.style.boxShadow = 'none';
    }

    if (blueDotRef.current) {
      blueDotRef.current.style.left = `${metrics.isMobile ? metrics.ropeCenterX : metrics.ropeEnd}px`;
      blueDotRef.current.style.top = `${metrics.isMobile ? metrics.ropeEnd : metrics.ropeCenterY}px`;
    }

    if (ropeLeftTintRef.current) {
      const leftOpacity = metrics.normalized < 0.4 ? clamp((0.4 - metrics.normalized) / 0.4 * 0.3, 0, 0.3) : 0;
      ropeLeftTintRef.current.style.opacity = `${leftOpacity}`;
    }

    if (ropeRightTintRef.current) {
      const rightOpacity = metrics.normalized > 0.6 ? clamp((metrics.normalized - 0.6) / 0.4 * 0.3, 0, 0.3) : 0;
      ropeRightTintRef.current.style.opacity = `${rightOpacity}`;
    }

    if (bgTintRef.current) {
      if (metrics.normalized < 0.4) {
        const alpha = (0.4 - metrics.normalized) * 0.15;
        bgTintRef.current.style.background = `rgba(230,57,70,${alpha})`;
      } else if (metrics.normalized > 0.6) {
        const alpha = (metrics.normalized - 0.6) * 0.15;
        bgTintRef.current.style.background = `rgba(74,144,217,${alpha})`;
      } else {
        bgTintRef.current.style.background = 'rgba(0,0,0,0)';
      }
    }
  }, [getRopeMetrics]);

  const resetRoundPhysics = useCallback(() => {
    ropeOffsetRef.current = 0;
    elapsedTimeRef.current = 0;
    aiForceRef.current = 0;
    isDraggingRef.current = false;
    dragLastXRef.current = 0;
    currentDragXRef.current = 0;
    roundResolvedRef.current = false;
    lastFrameTsRef.current = null;
    lastCreakTsRef.current = 0;
    setBlueGrabbedVisual(false);
    if (ropeRef.current) {
      ropeRef.current.style.transform = isMobileLayout ? 'translateX(0px)' : 'translateY(0px)';
    }
    updateVisualsFromOffset(0);
  }, [isMobileLayout, setBlueGrabbedVisual, updateVisualsFromOffset]);

  const flashScreen = useCallback((color: string, duration = 200) => {
    const flash = flashRef.current;
    if (!flash) return;

    flash.style.background = color;
    flash.style.opacity = '1';
    queueTimeout(() => {
      flash.style.opacity = '0';
    }, duration);
  }, [queueTimeout]);

  const revealGameOverLine = useCallback((node: HTMLDivElement | null, text: string) => {
    if (!node) return;
    node.textContent = text;
    node.style.opacity = '0';
    node.style.transform = 'translateY(10px)';
    node.style.transition = 'none';

    requestAnimationFrame(() => {
      node.style.transition = 'opacity 600ms ease, transform 600ms ease';
      node.style.opacity = '1';
      node.style.transform = 'translateY(0)';
    });
  }, []);

  const startGameOver = useCallback((winner: 'ai' | 'user') => {
    setGamePhase('gameOver');

    if (gameElementsRef.current) {
      gameElementsRef.current.style.transition = 'opacity 500ms ease';
      gameElementsRef.current.style.opacity = '0';
    }

    if (bgTintRef.current) {
      bgTintRef.current.style.background = 'rgba(0,0,0,0)';
    }
    if (flashRef.current) {
      flashRef.current.style.opacity = '0';
      flashRef.current.style.background = 'transparent';
    }

    const lines = winner === 'ai'
      ? [
          "hahahha, and I don't even have hands",
          'You lose!',
          'tell your friends',
        ]
      : [
          'Congratulations!',
          'You Win.',
          'tell your friends',
        ];

    const topSize = isMobileLayout ? 16 : 20;
    const headlineSize = isMobileLayout ? 32 : 40;
    const ctaSize = isMobileLayout ? 16 : 20;

    if (gameOverLine1Ref.current) {
      gameOverLine1Ref.current.style.color = winner === 'user' ? '#19C189' : '#FFFFFF';
      gameOverLine1Ref.current.style.fontSize = `${topSize}px`;
      gameOverLine1Ref.current.style.fontStyle = 'normal';
      gameOverLine1Ref.current.style.marginTop = '0px';
      gameOverLine1Ref.current.style.textDecoration = 'none';
    }

    if (gameOverLine2Ref.current) {
      gameOverLine2Ref.current.style.color = winner === 'user' ? '#D1D1D1' : '#C1191C';
      gameOverLine2Ref.current.style.fontSize = `${headlineSize}px`;
      gameOverLine2Ref.current.style.fontStyle = 'normal';
      gameOverLine2Ref.current.style.marginTop = '0px';
      gameOverLine2Ref.current.style.textDecoration = 'none';
    }

    if (gameOverLine3Ref.current) {
      gameOverLine3Ref.current.style.color = '#D1D1D1';
      gameOverLine3Ref.current.style.fontSize = `${ctaSize}px`;
      gameOverLine3Ref.current.style.fontStyle = 'normal';
      gameOverLine3Ref.current.style.marginTop = `${isMobileLayout ? 24 : 48}px`;
      gameOverLine3Ref.current.style.textDecoration = 'underline';
      gameOverLine3Ref.current.style.textUnderlineOffset = '3px';
    }

    if (gameOverWrapRef.current) {
      gameOverWrapRef.current.style.opacity = '1';
    }

    queueTimeout(() => revealGameOverLine(gameOverLine1Ref.current, lines[0]), 500);
    queueTimeout(() => revealGameOverLine(gameOverLine2Ref.current, lines[1]), 2000);
    queueTimeout(() => revealGameOverLine(gameOverLine3Ref.current, lines[2]), 3000);

    playTone(330, 400, 0.05);
    vibrate([40, 30, 60]);

    if (!onRevealCalledRef.current) {
      onRevealCalledRef.current = true;
      onReveal?.();
    }
  }, [isMobileLayout, onReveal, playTone, queueTimeout, revealGameOverLine, vibrate]);

  const startCountdown = useCallback((round: 1 | 2 | 3) => {
    setRoundWinner(null);
    setGamePhase('countdown');

    resetRoundPhysics();

    queueTimeout(() => {
      const countdownNode = countdownTextRef.current;
      if (!countdownNode) return;

      const steps = [
        { label: '3', frequency: 440, color: '#FFFFFF' },
        { label: '2', frequency: 550, color: '#FFFFFF' },
        { label: '1', frequency: 660, color: '#FFFFFF' },
        { label: 'PULL!', frequency: 880, color: '#4A90D9' },
      ];

      steps.forEach((step, index) => {
        queueTimeout(() => {
          if (!countdownTextRef.current) return;
          const node = countdownTextRef.current;
          node.textContent = step.label;
          node.style.color = step.color;
          node.style.opacity = '1';
          node.style.transform = 'translate(-50%, -50%) scale(1.5)';
          node.style.transition = 'none';

          requestAnimationFrame(() => {
            node.style.transition = 'opacity 800ms ease, transform 800ms ease';
            node.style.opacity = '0.5';
            node.style.transform = 'translate(-50%, -50%) scale(1)';
          });

          playTone(step.frequency, 100, 0.06);
          vibrate(10);
        }, index * 800);
      });

      queueTimeout(() => {
        if (countdownTextRef.current) {
          countdownTextRef.current.style.opacity = '0';
        }

        setGamePhase('playing');
        setRoundWinner(null);
        ropeOffsetRef.current = 0;
        elapsedTimeRef.current = 0;
        aiForceRef.current = 0;
        isDraggingRef.current = false;
        setBlueGrabbedVisual(false);
        updateVisualsFromOffset(ropeOffsetRef.current);
      }, steps.length * 800 + 400);
    }, 30);

    roundNumberRef.current = round;
  }, [playTone, queueTimeout, resetRoundPhysics, setBlueGrabbedVisual, updateVisualsFromOffset, vibrate]);

  const endRound = useCallback((winner: 'ai' | 'user' | 'draw') => {
    if (roundResolvedRef.current) return;
    roundResolvedRef.current = true;

    isDraggingRef.current = false;
    setBlueGrabbedVisual(false);

    setRoundWinner(winner);
    setGamePhase('roundEnd');

    const metrics = getRopeMetrics(ropeOffsetRef.current);

    if (winner === 'ai') {
      ropeOffsetRef.current = metrics.aiWinOffset;
      updateVisualsFromOffset(ropeOffsetRef.current);
      flashScreen('rgba(230,57,70,0.15)', 200);
      playTone(80, 200, 0.1);
      vibrate([50, 30, 80]);
    } else if (winner === 'user') {
      ropeOffsetRef.current = metrics.userWinOffset;
      updateVisualsFromOffset(ropeOffsetRef.current);
      flashScreen('rgba(74,144,217,0.15)', 200);
      playTone(523, 150, 0.08);
      playTone(659, 150, 0.08, 150);
      vibrate([30, 20, 50]);
    }

    if (winner === 'draw') {
      queueTimeout(() => {
        startCountdown(roundNumberRef.current);
      }, 1000);
      return;
    }

    const nextAi = winner === 'ai' ? aiScoreRef.current + 1 : aiScoreRef.current;
    const nextUser = winner === 'user' ? userScoreRef.current + 1 : userScoreRef.current;

    aiScoreRef.current = nextAi;
    userScoreRef.current = nextUser;

    setAiScore(nextAi);
    setUserScore(nextUser);

    queueTimeout(() => {
      if (nextAi >= 2 || nextUser >= 2) {
        startGameOver(nextAi >= 2 ? 'ai' : 'user');
        return;
      }

      const nextRound = ((roundNumberRef.current + 1) as 2 | 3);
      roundNumberRef.current = nextRound;
      setRoundNumber(nextRound);
      startCountdown(nextRound);
    }, 1500);
  }, [flashScreen, getRopeMetrics, playTone, queueTimeout, setBlueGrabbedVisual, startCountdown, startGameOver, updateVisualsFromOffset, vibrate]);

  const startFromInstructions = useCallback(() => {
    ensureAudioContext();
    startCountdown(roundNumberRef.current);
  }, [ensureAudioContext, startCountdown]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (phaseRef.current === 'instructions') {
      startFromInstructions();
      return;
    }

    if (phaseRef.current !== 'playing') return;

    if (isMobileLayout) {
      if (event.clientY < window.innerHeight * 0.5) return;
      dragLastXRef.current = event.clientY;
      currentDragXRef.current = event.clientY;
    } else {
      if (event.clientX < window.innerWidth * 0.5) return;
      dragLastXRef.current = event.clientX;
      currentDragXRef.current = event.clientX;
    }

    isDraggingRef.current = true;

    setBlueGrabbedVisual(true);
    playTone(600, 30, 0.04);

    event.currentTarget.setPointerCapture(event.pointerId);
  }, [isMobileLayout, playTone, setBlueGrabbedVisual, startFromInstructions]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (phaseRef.current !== 'playing' || !isDraggingRef.current) return;
    currentDragXRef.current = isMobileLayout ? event.clientY : event.clientX;
  }, [isMobileLayout]);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (phaseRef.current !== 'playing') return;
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    setBlueGrabbedVisual(false);
    playTone(150, 60, 0.04);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [playTone, setBlueGrabbedVisual]);

  useEffect(() => {
    phaseRef.current = gamePhase;
  }, [gamePhase]);

  useEffect(() => {
    roundNumberRef.current = roundNumber;
  }, [roundNumber]);

  useEffect(() => {
    aiScoreRef.current = aiScore;
  }, [aiScore]);

  useEffect(() => {
    userScoreRef.current = userScore;
  }, [userScore]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const createdMeta = !themeMeta;
    const previousTheme = themeMeta?.getAttribute('content') ?? null;

    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.setAttribute('name', 'theme-color');
      document.head.appendChild(themeMeta);
    }

    themeMeta.setAttribute('content', '#000000');

    return () => {
      document.body.style.overflow = previousOverflow;

      if (themeMeta) {
        if (createdMeta) {
          themeMeta.remove();
        } else if (previousTheme !== null) {
          themeMeta.setAttribute('content', previousTheme);
        } else {
          themeMeta.removeAttribute('content');
        }
      }
    };
  }, []);

  useEffect(() => {
    updateVisualsFromOffset(ropeOffsetRef.current);

    const onResize = () => {
      setIsMobileLayout(window.innerWidth <= MOBILE_BREAKPOINT);
      updateVisualsFromOffset(ropeOffsetRef.current);
    };

    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [updateVisualsFromOffset]);

  useEffect(() => {
    if (gamePhase === 'instructions' || gamePhase === 'gameOver') {
      if (bgTintRef.current) {
        bgTintRef.current.style.background = 'rgba(0,0,0,0)';
      }
      if (flashRef.current) {
        flashRef.current.style.opacity = '0';
      }
      return;
    }

    const raf = requestAnimationFrame(() => {
      updateVisualsFromOffset(ropeOffsetRef.current);
    });

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [gamePhase, updateVisualsFromOffset]);

  useEffect(() => {
    if (gamePhase !== 'playing') {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    roundResolvedRef.current = false;
    elapsedTimeRef.current = 0;
    lastFrameTsRef.current = null;

    const loop = (timestamp: number) => {
      if (phaseRef.current !== 'playing') return;

      const lastTs = lastFrameTsRef.current;
      lastFrameTsRef.current = timestamp;

      const dtMs = lastTs === null ? 16.667 : Math.min(50, Math.max(8, timestamp - lastTs));
      const dtFrames = dtMs / (1000 / 60);

      elapsedTimeRef.current += dtMs / 1000;
      const elapsed = elapsedTimeRef.current;

      const aiForce = baseAiForceForRound(roundNumberRef.current);
      const metricsBefore = getRopeMetrics(ropeOffsetRef.current);
      let aiMultiplier = userScoreRef.current >= 1 ? 1.35 : 1;
      if (metricsBefore.normalized >= 0.6) {
        aiMultiplier *= 1.5;
      }
      const scaledAiForce = aiForce * aiMultiplier;
      aiForceRef.current = scaledAiForce;

      if (isDraggingRef.current) {
        const fingerDelta = currentDragXRef.current - dragLastXRef.current;
        dragLastXRef.current = currentDragXRef.current;
        ropeOffsetRef.current += fingerDelta * 0.15;

        if (timestamp - lastCreakTsRef.current >= 200) {
          playNoiseBurst(30, 400, 0.02);
          lastCreakTsRef.current = timestamp;
        }
      }

      ropeOffsetRef.current -= scaledAiForce * dtFrames;
      const metrics = getRopeMetrics(ropeOffsetRef.current);
      const winOffsetSpan = metrics.userWinOffset - metrics.aiWinOffset;
      const nearGoal = ropeOffsetRef.current <= metrics.aiWinOffset + winOffsetSpan * 0.2
        || ropeOffsetRef.current >= metrics.userWinOffset - winOffsetSpan * 0.2;
      if (ropeRef.current) {
        if (isDraggingRef.current && scaledAiForce > 0) {
          const intensity = nearGoal ? 2 : 1;
          if (metrics.isMobile) {
            ropeRef.current.style.transform = `translateX(${(Math.random() * 2 - 1) * intensity}px)`;
          } else {
            ropeRef.current.style.transform = `translateY(${(Math.random() * 2 - 1) * intensity}px)`;
          }
        } else {
          ropeRef.current.style.transform = metrics.isMobile ? 'translateX(0px)' : 'translateY(0px)';
        }
      }

      updateVisualsFromOffset(ropeOffsetRef.current);

      const userWinThreshold = metrics.isMobile
        ? metrics.ropeCenterY
        : metrics.ropeCenterX;

      if (metrics.ropeStart <= metrics.goalMin) {
        endRound('ai');
        return;
      }

      if (metrics.ropeStart >= userWinThreshold) {
        endRound('user');
        return;
      }

      if (elapsed >= 12) {
        endRound('draw');
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [endRound, gamePhase, getRopeMetrics, playNoiseBurst, updateVisualsFromOffset]);

  useEffect(() => {
    return () => {
      clearQueuedTimeouts();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      try {
        audioMasterRef.current?.disconnect();
      } catch {
        // no-op
      }

      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
      }
    };
  }, [clearQueuedTimeouts]);

  const isInstructions = gamePhase === 'instructions';
  const isCountdown = gamePhase === 'countdown';
  const isRoundEnd = gamePhase === 'roundEnd';

  return (
    <div
      ref={overlayRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#000000',
        touchAction: 'none',
        overscrollBehavior: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        data-close="true"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'fixed',
          top: isMobileLayout ? 40 : 80,
          right: isMobileLayout ? 15 : 48,
          width: 48,
          height: 48,
          borderRadius: 0,
          border: 'none',
          background: 'transparent',
          color: '#2D3034',
          fontSize: 40,
          fontWeight: 300,
          lineHeight: '48px',
          textAlign: 'center',
          padding: 0,
          zIndex: 1020,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!crossIconFailed && (
          <img
            src={CROSS_ICON_SRC}
            alt=""
            aria-hidden="true"
            onError={() => setCrossIconFailed(true)}
            style={{
              width: 40,
              height: 40,
              display: 'block',
            }}
          />
        )}
        {crossIconFailed && <span style={{ display: 'block', width: 40, height: 40, lineHeight: '40px' }}>×</span>}
      </button>

      <div ref={bgTintRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      <div ref={gameElementsRef} style={{ position: 'absolute', inset: 0, opacity: 1 }}>
        {isInstructions ? (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: isMobileLayout ? 298 : 372,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 24,
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div style={{ width: '100%' }}>
              <div
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: isMobileLayout ? 16 : 20,
                  lineHeight: 1.5,
                  color: '#D1D1D1',
                  fontWeight: 400,
                  fontStyle: 'normal',
                }}
              >
                <span style={{ color: '#C1191C' }}>Scroll</span>
                {' '}
                <span style={{ color: '#2E84FF' }}>war</span>
              </div>
              <div
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: isMobileLayout ? 32 : 40,
                  lineHeight: 1.5,
                  color: '#D1D1D1',
                  fontWeight: 400,
                  fontStyle: 'normal',
                }}
              >
                drag the blue handle to win
              </div>
            </div>
            <div
              style={{
                width: '100%',
                fontFamily: "'Instrument Serif', serif",
                fontSize: 20,
                lineHeight: 1.5,
                color: '#D1D1D1',
                fontWeight: 400,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                animation: 'scroll-war-pulse 1.2s ease-in-out infinite',
              }}
            >
              {isMobileLayout ? 'ready' : 'ready?'}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                position: 'fixed',
                top: isMobileLayout ? 40 : 80,
                left: isMobileLayout ? 24 : 80,
                zIndex: 1010,
                pointerEvents: 'none',
                fontFamily: "'Instrument Serif', serif",
                fontSize: 32,
                lineHeight: 1.5,
                color: '#484848',
                fontWeight: 400,
              }}
            >
              {userScore}:{aiScore}
            </div>

            <div
              ref={ropeRef}
              style={{
                position: 'absolute',
                left: isMobileLayout ? `${MOBILE_ROPE_X_RATIO * 100}%` : `${ROPE_LEFT_RATIO * 100}%`,
                right: isMobileLayout ? 'auto' : `${(1 - ROPE_RIGHT_RATIO) * 100}%`,
                top: isMobileLayout ? `${MOBILE_ROPE_TOP_RATIO * 100}%` : `${ROPE_CENTER_Y_RATIO * 100}%`,
                width: isMobileLayout ? 8 : undefined,
                height: isMobileLayout ? `${(MOBILE_ROPE_BOTTOM_RATIO - MOBILE_ROPE_TOP_RATIO) * 100}%` : 8,
                marginTop: isMobileLayout ? 0 : -4,
                marginLeft: isMobileLayout ? -4 : 0,
                background: '#FFFFFF',
                borderRadius: 999,
                overflow: 'hidden',
                willChange: 'transform',
              }}
            >
              <div
                ref={ropeLeftTintRef}
                style={{
                  position: 'absolute',
                  left: isMobileLayout ? 0 : 0,
                  top: 0,
                  right: isMobileLayout ? 0 : undefined,
                  bottom: isMobileLayout ? undefined : 0,
                  width: isMobileLayout ? '100%' : '50%',
                  height: isMobileLayout ? '50%' : undefined,
                  background: 'rgba(230,57,70,0.35)',
                  opacity: 0,
                }}
              />
              <div
                ref={ropeRightTintRef}
                style={{
                  position: 'absolute',
                  right: isMobileLayout ? 0 : 0,
                  top: isMobileLayout ? undefined : 0,
                  left: isMobileLayout ? 0 : undefined,
                  bottom: 0,
                  width: isMobileLayout ? '100%' : '50%',
                  height: isMobileLayout ? '50%' : undefined,
                  background: 'rgba(74,144,217,0.35)',
                  opacity: 0,
                }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                left: isMobileLayout ? `${MOBILE_ROPE_X_RATIO * 100}%` : `${GOAL_LEFT_RATIO * 100}%`,
                top: isMobileLayout ? `${MOBILE_GOAL_TOP_CENTER_RATIO * 100}%` : `${ROPE_CENTER_Y_RATIO * 100}%`,
                width: isMobileLayout ? 64.5 : 8,
                height: isMobileLayout ? 8 : 64,
                transform: 'translate(-50%, -50%)',
                background: '#C1191C',
                borderRadius: 32,
              }}
            />

            <div
              style={{
                position: 'absolute',
                left: isMobileLayout ? `${MOBILE_ROPE_X_RATIO * 100}%` : `${GOAL_RIGHT_RATIO * 100}%`,
                top: isMobileLayout ? `${MOBILE_GOAL_BOTTOM_CENTER_RATIO * 100}%` : `${ROPE_CENTER_Y_RATIO * 100}%`,
                width: isMobileLayout ? 64.5 : 8,
                height: isMobileLayout ? 8 : 64,
                transform: 'translate(-50%, -50%)',
                background: '#2E84FF',
                borderRadius: 32,
              }}
            />

            <div
              ref={yellowKnotRef}
              style={{
                position: 'absolute',
                width: 24,
                height: 24,
                borderRadius: 8,
                background: '#FFE374',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 10px rgba(255,217,61,0.4)',
                willChange: 'left, top, box-shadow',
              }}
            />

            <div
              ref={redDotRef}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 17.716,
                height: 17.716,
                borderRadius: '50%',
                background: '#FFFFFF',
                border: '3px solid #FF2B2B',
                transform: 'translate(-50%, -50%)',
                willChange: 'left, top, box-shadow',
                zIndex: 6,
                pointerEvents: 'none',
              }}
            />

            <div
              ref={blueDotRef}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 17.716,
                height: 17.716,
                borderRadius: '50%',
                border: '3px solid #2E84FF',
                background: '#FFFFFF',
                transform: 'translate(-50%, -50%)',
                transition: 'transform 120ms ease, box-shadow 120ms ease, background 120ms ease',
                willChange: 'left, top, transform, box-shadow',
                zIndex: 6,
              }}
            />

            {isCountdown && (
              <div
                ref={countdownTextRef}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%) scale(1)',
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 48,
                  fontWeight: 400,
                  color: '#FFFFFF',
                  lineHeight: 1.2,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
            )}

            {isRoundEnd && roundWinner && (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontFamily: "'Instrument Serif', serif",
                  fontSize: 20,
                  fontWeight: 400,
                  color: roundWinner === 'ai' ? '#E63946' : roundWinner === 'user' ? '#4A90D9' : '#FFFFFF',
                  lineHeight: 1.5,
                  pointerEvents: 'none',
                  opacity: 0,
                  animation: 'scroll-war-round-fade 300ms ease forwards',
                }}
              >
                {roundWinner === 'ai' ? 'AI WINS' : roundWinner === 'user' ? 'YOU WIN' : 'DRAW'}
              </div>
            )}
          </>
        )}
      </div>

      <div
        ref={gameOverWrapRef}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'min(82vw, 298px)',
          textAlign: 'center',
          opacity: 0,
          pointerEvents: 'none',
        }}
      >
        <div
          ref={gameOverLine1Ref}
          style={{
            fontFamily: "'Instrument Serif', serif",
            fontSize: isMobileLayout ? 16 : 20,
            fontWeight: 400,
            color: '#FFFFFF',
            lineHeight: 1.5,
            opacity: 0,
            transform: 'translateY(10px)',
          }}
        />
        <div
          ref={gameOverLine2Ref}
          style={{
            marginTop: 0,
            fontFamily: "'Instrument Serif', serif",
            fontSize: isMobileLayout ? 32 : 40,
            fontWeight: 400,
            color: '#D1D1D1',
            lineHeight: 1.5,
            opacity: 0,
            transform: 'translateY(10px)',
          }}
        />
        <div
          ref={gameOverLine3Ref}
          style={{
            marginTop: isMobileLayout ? 24 : 48,
            fontFamily: "'Instrument Serif', serif",
            fontSize: isMobileLayout ? 16 : 20,
            fontWeight: 400,
            color: '#D1D1D1',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            lineHeight: 1.5,
            opacity: 0,
            transform: 'translateY(10px)',
          }}
        />
      </div>

      <div
        ref={flashRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          opacity: 0,
          transition: 'opacity 120ms ease',
          pointerEvents: 'none',
          zIndex: 1005,
        }}
      />

      <style>{`
        @keyframes scroll-war-pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @keyframes scroll-war-round-fade {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
}
