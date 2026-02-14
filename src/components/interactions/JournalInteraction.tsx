import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface JournalProps {
  onClose: () => void;
  cardColor: string;
  onReveal?: () => void;
}

type TextAlignMode = 'left' | 'center' | 'right';

type LetterRecord = {
  id: number;
  char: string;
  wordId: number | null;
  line: number;
  opacity: number;
  y: number;
  blur: number;
  dissolving: boolean;
  dissolveDelay: number;
  dissolveDrift: number;
  particlesSpawned: boolean;
  bold: boolean;
  italic: boolean;
  size: number;
  align: TextAlignMode;
};

type WordRecord = {
  id: number;
  letters: number[];
  completed: boolean;
  startedDissolvingAt: number | null;
  isDissolved: boolean;
};

type ParticleRecord = {
  id: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  dx: number;
  dy: number;
  opacity: number;
  startAt: number;
  duration: number;
};

type FormatSnapshot = {
  bold: boolean;
  italic: boolean;
  size: number;
  align: TextAlignMode;
};

const DISSOLVE_WORD_MS = 3000;
const DISSOLVE_FAST_WORD_MS = 1000;
const DISSOLVE_FAST_AFTER_MS = 2000;
const MAX_PARTICLES = 100;
const MAX_DISSOLVE_TICKS_PER_WINDOW = 8;
const DISSOLVE_TICK_WINDOW_MS = 100;
const SIZE_STEPS = [18, 24, 32] as const;
const PAPER_NOISE_BG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='%232C1810' fill-opacity='0.18'%3E%3Ccircle cx='6' cy='12' r='0.8'/%3E%3Ccircle cx='22' cy='34' r='0.9'/%3E%3Ccircle cx='48' cy='17' r='0.7'/%3E%3Ccircle cx='71' cy='29' r='0.9'/%3E%3Ccircle cx='90' cy='9' r='0.8'/%3E%3Ccircle cx='109' cy='22' r='0.8'/%3E%3Ccircle cx='13' cy='60' r='0.9'/%3E%3Ccircle cx='29' cy='79' r='0.7'/%3E%3Ccircle cx='52' cy='66' r='0.9'/%3E%3Ccircle cx='76' cy='92' r='0.8'/%3E%3Ccircle cx='95' cy='73' r='0.8'/%3E%3Ccircle cx='111' cy='54' r='0.9'/%3E%3Ccircle cx='8' cy='104' r='0.7'/%3E%3Ccircle cx='39' cy='109' r='0.9'/%3E%3Ccircle cx='62' cy='112' r='0.8'/%3E%3Ccircle cx='84' cy='106' r='0.9'/%3E%3Ccircle cx='104' cy='97' r='0.7'/%3E%3C/g%3E%3C/svg%3E\")";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeIn(progress: number) {
  return progress * progress;
}

function supportsVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function safeVibrate(pattern: number | number[]) {
  if (supportsVibrate()) navigator.vibrate(pattern);
}

export default function JournalInteraction({ onClose, cardColor, onReveal }: JournalProps) {
  const [fadeEnabled, setFadeEnabled] = useState(true);
  const [renderedLetters, setRenderedLetters] = useState<LetterRecord[]>([]);
  const [renderedParticles, setRenderedParticles] = useState<ParticleRecord[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [hasTypedOnce, setHasTypedOnce] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [formatBarBottom, setFormatBarBottom] = useState(20);
  const [activeWordId, setActiveWordId] = useState<number | null>(null);
  const [isDesktopLayout, setIsDesktopLayout] = useState(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  );

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(true);
  const [currentSize, setCurrentSize] = useState<number>(SIZE_STEPS[0]);
  const [textAlign, setTextAlign] = useState<TextAlignMode>('left');

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingAreaRef = useRef<HTMLDivElement | null>(null);
  const lettersRef = useRef<LetterRecord[]>([]);
  const wordsRef = useRef<WordRecord[]>([]);
  const particlesRef = useRef<ParticleRecord[]>([]);
  const letterElementRefs = useRef<Map<number, HTMLSpanElement>>(new Map());
  const inputValueRef = useRef('');
  const typingTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);
  const totalCharsTypedRef = useRef(0);
  const revealTriggeredRef = useRef(false);
  const letterIdRef = useRef(1);
  const wordIdRef = useRef(1);
  const particleIdRef = useRef(1);
  const currentWordIdRef = useRef<number | null>(null);
  const currentLineRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dissolveTickWindowRef = useRef({ start: 0, count: 0 });
  const dissolveActiveRef = useRef(false);
  const formatRef = useRef<FormatSnapshot>({
    bold: false,
    italic: true,
    size: SIZE_STEPS[0],
    align: 'left' as TextAlignMode,
  });

  const syncRenderState = useCallback(() => {
    setRenderedLetters([...lettersRef.current]);
    setRenderedParticles([...particlesRef.current]);
  }, []);

  useEffect(() => {
    formatRef.current = {
      bold: isBold,
      italic: isItalic,
      size: currentSize,
      align: textAlign,
    };
  }, [currentSize, isBold, isItalic, textAlign]);

  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextCtor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  }, []);

  const playSine = useCallback((frequency: number, durationMs: number, gainValue: number) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    gainNode.gain.setValueAtTime(gainValue, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }, [ensureAudioContext]);

  const playSweepSine = useCallback((
    startFrequency: number,
    endFrequency: number,
    durationMs: number,
    gainValue: number
  ) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    const duration = durationMs / 1000;

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    gainNode.gain.setValueAtTime(gainValue, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }, [ensureAudioContext]);

  const playNoise = useCallback((
    durationMs: number,
    gainValue: number,
    centerFrequency: number,
    q: number
  ) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;

    const duration = durationMs / 1000;
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < frameCount; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(centerFrequency, ctx.currentTime);
    filter.Q.setValueAtTime(q, ctx.currentTime);

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(gainValue, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }, [ensureAudioContext]);

  const playTypeSound = useCallback(() => {
    const center = 3500 + (Math.random() * 1000 - 500);
    playNoise(12, 0.02, center, 2);
    playSine(400, 8, 0.01);
  }, [playNoise, playSine]);

  const playSpaceSound = useCallback(() => {
    playNoise(20, 0.025, 1500, 1.6);
    playSine(300, 15, 0.015);
  }, [playNoise, playSine]);

  const playBackspaceSound = useCallback(() => {
    playSweepSine(500, 200, 40, 0.025);
  }, [playSweepSine]);

  const playDissolveStartSound = useCallback(() => {
    const center = 4000 + Math.random() * 4000;
    playNoise(600, 0.01, center, 0.8);
  }, [playNoise]);

  const playDissolveTickSound = useCallback((now: number) => {
    const windowState = dissolveTickWindowRef.current;
    if (now - windowState.start > DISSOLVE_TICK_WINDOW_MS) {
      windowState.start = now;
      windowState.count = 0;
    }
    if (windowState.count >= MAX_DISSOLVE_TICKS_PER_WINDOW) return;
    windowState.count += 1;
    playSine(800 + Math.random() * 1200, 10, 0.005);
  }, [playSine]);

  const createWord = useCallback(() => {
    const nextWord: WordRecord = {
      id: wordIdRef.current++,
      letters: [],
      completed: false,
      startedDissolvingAt: null,
      isDissolved: false,
    };
    wordsRef.current.push(nextWord);
    currentWordIdRef.current = nextWord.id;
    setActiveWordId(nextWord.id);
    return nextWord;
  }, []);

  const ensureCurrentWord = useCallback(() => {
    if (currentWordIdRef.current !== null) {
      const existing = wordsRef.current.find((word) => word.id === currentWordIdRef.current);
      if (existing) return existing;
    }
    return createWord();
  }, [createWord]);

  const createLetter = useCallback((char: string, wordId: number | null): LetterRecord => ({
    char,
    id: letterIdRef.current++,
    wordId,
    line: currentLineRef.current,
    opacity: 1,
    y: 0,
    blur: 0,
    dissolving: false,
    dissolveDelay: Math.random() * 400,
    dissolveDrift: 4 + Math.random() * 6,
    particlesSpawned: false,
    bold: formatRef.current.bold,
    italic: formatRef.current.italic,
    size: formatRef.current.size,
    align: formatRef.current.align,
  }), []);

  const restoreWordVisual = useCallback((wordId: number) => {
    lettersRef.current = lettersRef.current.map((letter) => {
      if (letter.wordId !== wordId) return letter;
      return {
        ...letter,
        opacity: 1,
        y: 0,
        blur: 0,
        dissolving: false,
        dissolveDelay: Math.random() * 400,
        dissolveDrift: 4 + Math.random() * 6,
        particlesSpawned: false,
      };
    });
  }, []);

  const startAnimationLoop = useCallback(() => {
    if (animationFrameRef.current !== null) return;

    const step = (now: number) => {
      let lettersChanged = false;
      let particlesChanged = false;

      if (fadeEnabled) {
        const lettersById = new Map(lettersRef.current.map((letter) => [letter.id, letter]));

        for (const word of wordsRef.current) {
          if (!word.completed || word.startedDissolvingAt === null) continue;
          let allDone = true;
          const wordAge = now - word.startedDissolvingAt;
          const duration = wordAge >= DISSOLVE_FAST_AFTER_MS ? DISSOLVE_FAST_WORD_MS : DISSOLVE_WORD_MS;

          for (const letterId of word.letters) {
            const letter = lettersById.get(letterId);
            if (!letter) continue;

            const elapsed = now - word.startedDissolvingAt - letter.dissolveDelay;
            if (elapsed <= 0) {
              allDone = false;
              continue;
            }

            const progress = clamp(elapsed / duration, 0, 1);
            const eased = easeIn(progress);
            const nextOpacity = 1 - eased;
            const nextY = letter.dissolveDrift * eased;
            const nextBlur = 2 * eased;

            if (
              Math.abs(nextOpacity - letter.opacity) > 0.002 ||
              Math.abs(nextY - letter.y) > 0.01 ||
              Math.abs(nextBlur - letter.blur) > 0.01 ||
              !letter.dissolving
            ) {
              letter.opacity = nextOpacity;
              letter.y = nextY;
              letter.blur = nextBlur;
              letter.dissolving = progress < 1;
              lettersChanged = true;
            }

            if (progress >= 0.5 && !letter.particlesSpawned && letter.char !== '\n') {
              const markerElement = letterElementRefs.current.get(letter.id);
              const container = typingAreaRef.current;
              if (markerElement && container) {
                const markerRect = markerElement.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const baseX = markerRect.left - containerRect.left + markerRect.width / 2;
                const baseY = markerRect.top - containerRect.top + markerRect.height / 2;
                const amount = 2 + Math.floor(Math.random() * 2);

                for (let index = 0; index < amount; index += 1) {
                  particlesRef.current.push({
                    id: particleIdRef.current++,
                    x: baseX,
                    y: baseY,
                    originX: baseX + (Math.random() * 6 - 3),
                    originY: baseY + (Math.random() * 6 - 3),
                    dx: Math.random() * 20 - 10,
                    dy: 5 + Math.random() * 10,
                    opacity: 0.3,
                    startAt: now,
                    duration: 600,
                  });
                }
                if (particlesRef.current.length > MAX_PARTICLES) {
                  particlesRef.current = particlesRef.current.slice(-MAX_PARTICLES);
                }
                particlesChanged = true;
              }
              playDissolveTickSound(now);
              letter.particlesSpawned = true;
            }

            if (progress < 1) {
              allDone = false;
            }
          }

          word.isDissolved = allDone;
        }
      }

      const beforeParticleCount = particlesRef.current.length;
      particlesRef.current = particlesRef.current
        .map((particle) => {
          const progress = (now - particle.startAt) / particle.duration;
          if (progress >= 1) return null;
          const boundedProgress = Math.max(0, progress);
          return {
            ...particle,
            x: particle.originX + particle.dx * boundedProgress,
            y: particle.originY + particle.dy * boundedProgress,
            opacity: Math.max(0, 0.3 * (1 - boundedProgress)),
          };
        })
        .filter((particle): particle is ParticleRecord => particle !== null);
      if (particlesRef.current.length !== beforeParticleCount) {
        particlesChanged = true;
      }

      const hasDissolvingWords =
        fadeEnabled &&
        wordsRef.current.some(
          (word) => word.completed && word.startedDissolvingAt !== null && !word.isDissolved
        );
      const hasActiveParticles = particlesRef.current.length > 0;

      dissolveActiveRef.current = hasDissolvingWords;

      if (lettersChanged || particlesChanged) {
        if (now - lastPaintRef.current >= 50) {
          syncRenderState();
          lastPaintRef.current = now;
        }
      }

      if (hasDissolvingWords || hasActiveParticles) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
        if (lettersChanged || particlesChanged) {
          syncRenderState();
        }
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, [fadeEnabled, playDissolveTickSound, syncRenderState]);

  const startWordDissolve = useCallback((word: WordRecord, now: number) => {
    if (!fadeEnabled || word.startedDissolvingAt !== null || word.letters.length === 0) return;

    word.startedDissolvingAt = now;
    word.isDissolved = false;
    const letterIdSet = new Set(word.letters);
    lettersRef.current = lettersRef.current.map((letter) => {
      if (!letterIdSet.has(letter.id)) return letter;
      return {
        ...letter,
        dissolving: true,
        dissolveDelay: Math.random() * 400,
        dissolveDrift: 4 + Math.random() * 6,
        particlesSpawned: false,
      };
    });

    playDissolveStartSound();
    safeVibrate(1);
    dissolveActiveRef.current = true;
    startAnimationLoop();
  }, [fadeEnabled, playDissolveStartSound, startAnimationLoop]);

  const ensureCompletedWordsDissolving = useCallback((now: number) => {
    if (!fadeEnabled) return;
    for (const word of wordsRef.current) {
      if (!word.completed || word.letters.length === 0 || word.startedDissolvingAt !== null) continue;
      if (word.id === currentWordIdRef.current) continue;
      startWordDissolve(word, now);
    }
  }, [fadeEnabled, startWordDissolve]);

  const completeCurrentWord = useCallback((now: number) => {
    const currentWord = wordsRef.current.find((word) => word.id === currentWordIdRef.current);
    if (!currentWord || currentWord.letters.length === 0) return null;

    currentWord.completed = true;
    currentWord.isDissolved = false;
    if (fadeEnabled) {
      startWordDissolve(currentWord, now);
    } else {
      currentWord.startedDissolvingAt = null;
    }
    return currentWord.id;
  }, [fadeEnabled, startWordDissolve]);

  const restoreAllLetters = useCallback(() => {
    lettersRef.current = lettersRef.current.map((letter) => ({
      ...letter,
      opacity: 1,
      y: 0,
      blur: 0,
      dissolving: false,
      particlesSpawned: false,
      dissolveDelay: Math.random() * 400,
      dissolveDrift: 4 + Math.random() * 6,
    }));
    wordsRef.current = wordsRef.current.map((word) => ({
      ...word,
      startedDissolvingAt: null,
      isDissolved: false,
    }));
    particlesRef.current = [];
    dissolveActiveRef.current = false;
    syncRenderState();
  }, [syncRenderState]);

  const appendCharacter = useCallback((char: string, silent = false, countTowardReveal = true) => {
    if (char === '\r') return;
    const now = performance.now();

    if (char === ' ' || char === '\n') {
      const completedWordId = completeCurrentWord(now);
      const separator = createLetter(char, completedWordId);
      lettersRef.current.push(separator);

      if (char === '\n') {
        currentLineRef.current += 1;
      }

      createWord();

      if (!silent) {
        playSpaceSound();
        safeVibrate(2);
      }
    } else {
      const currentWord = ensureCurrentWord();
      currentWord.completed = false;
      currentWord.startedDissolvingAt = null;
      currentWord.isDissolved = false;

      const letter = createLetter(char, currentWord.id);
      lettersRef.current.push(letter);
      currentWord.letters.push(letter.id);

      if (!silent) {
        playTypeSound();
        safeVibrate(1);
      }
    }

    if (countTowardReveal) {
      totalCharsTypedRef.current += 1;
      if (!revealTriggeredRef.current && totalCharsTypedRef.current >= 100) {
        revealTriggeredRef.current = true;
        onReveal?.();
      }
    }

    setHasTypedOnce(true);
    ensureCompletedWordsDissolving(now);
    syncRenderState();
    if (fadeEnabled) {
      startAnimationLoop();
    }
  }, [
    completeCurrentWord,
    createLetter,
    createWord,
    ensureCompletedWordsDissolving,
    ensureCurrentWord,
    fadeEnabled,
    onReveal,
    playSpaceSound,
    playTypeSound,
    startAnimationLoop,
    syncRenderState,
  ]);

  const removeLastCharacter = useCallback((silent = false) => {
    const removed = lettersRef.current.pop();
    if (!removed) return;

    const relatedWord = removed.wordId !== null
      ? wordsRef.current.find((word) => word.id === removed.wordId)
      : undefined;
    if (relatedWord) {
      relatedWord.letters = relatedWord.letters.filter((letterId) => letterId !== removed.id);
      relatedWord.isDissolved = false;
      relatedWord.startedDissolvingAt = null;
      relatedWord.completed = false;
    }

    if (removed.char === ' ' || removed.char === '\n') {
      const trailingWord = wordsRef.current[wordsRef.current.length - 1];
      if (trailingWord && trailingWord.letters.length === 0) {
        wordsRef.current.pop();
      }

      const previousWord = [...wordsRef.current].reverse().find((word) => word.letters.length > 0);
      if (previousWord) {
        previousWord.completed = false;
        previousWord.startedDissolvingAt = null;
        previousWord.isDissolved = false;
        restoreWordVisual(previousWord.id);
        currentWordIdRef.current = previousWord.id;
        setActiveWordId(previousWord.id);
      } else {
        const created = createWord();
        currentWordIdRef.current = created.id;
        setActiveWordId(created.id);
      }
    } else if (removed.wordId !== null) {
      const currentWord = wordsRef.current.find((word) => word.id === removed.wordId);
      if (currentWord) {
        currentWord.completed = false;
        currentWord.startedDissolvingAt = null;
        currentWord.isDissolved = false;
        currentWordIdRef.current = currentWord.id;
        setActiveWordId(currentWord.id);
      }
    }

    currentLineRef.current = lettersRef.current.filter((letter) => letter.char === '\n').length;

    if (!silent) {
      playBackspaceSound();
      safeVibrate(3);
    }

    syncRenderState();
  }, [createWord, playBackspaceSound, restoreWordVisual, syncRenderState]);

  const rebuildFromText = useCallback((nextValue: string) => {
    lettersRef.current = [];
    wordsRef.current = [];
    particlesRef.current = [];
    currentLineRef.current = 0;
    currentWordIdRef.current = null;

    createWord();
    for (const char of Array.from(nextValue)) {
      appendCharacter(char, true, false);
    }
    syncRenderState();
  }, [appendCharacter, createWord, syncRenderState]);

  const handleInput = useCallback((nextValue: string) => {
    const previousValue = inputValueRef.current;

    if (nextValue.length >= previousValue.length && nextValue.startsWith(previousValue)) {
      const inserted = nextValue.slice(previousValue.length);
      for (const char of Array.from(inserted)) {
        appendCharacter(char, false, true);
      }
    } else if (previousValue.length > nextValue.length && previousValue.startsWith(nextValue)) {
      const removedCount = previousValue.length - nextValue.length;
      for (let index = 0; index < removedCount; index += 1) {
        removeLastCharacter(false);
      }
    } else {
      rebuildFromText(nextValue);
    }

    inputValueRef.current = nextValue;
    setInputValue(nextValue);
    setIsTyping(true);
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
    }
    typingTimerRef.current = window.setTimeout(() => {
      setIsTyping(false);
      typingTimerRef.current = null;
    }, 260);

    if (fadeEnabled) {
      ensureCompletedWordsDissolving(performance.now());
      startAnimationLoop();
    }
  }, [appendCharacter, ensureCompletedWordsDissolving, fadeEnabled, rebuildFromText, removeLastCharacter, startAnimationLoop]);

  useEffect(() => {
    if (!currentWordIdRef.current) {
      const created = createWord();
      currentWordIdRef.current = created.id;
      setActiveWordId(created.id);
    }
  }, [createWord]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const metaTheme = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    const previousThemeContent = metaTheme?.getAttribute('content') ?? null;
    if (metaTheme) {
      metaTheme.setAttribute('content', '#FFFFFF');
    }

    const focusTimer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 500);

    const updateViewportInsets = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const nextInset = Math.max(0, window.innerHeight - viewportHeight + 10);
      setKeyboardInset(nextInset);
      setFormatBarBottom(Math.max(20, nextInset));
      setIsDesktopLayout(window.innerWidth >= 1024);
    };

    updateViewportInsets();
    window.addEventListener('resize', updateViewportInsets);

    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener('resize', updateViewportInsets);
      visualViewport.addEventListener('scroll', updateViewportInsets);
    }

    return () => {
      window.clearTimeout(focusTimer);
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }

      window.removeEventListener('resize', updateViewportInsets);
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateViewportInsets);
        visualViewport.removeEventListener('scroll', updateViewportInsets);
      }

      document.body.style.overflow = previousOverflow;
      if (metaTheme) {
        if (previousThemeContent === null) {
          metaTheme.removeAttribute('content');
        } else {
          metaTheme.setAttribute('content', previousThemeContent);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (fadeEnabled) {
      ensureCompletedWordsDissolving(performance.now());
      startAnimationLoop();
      return;
    }
    restoreAllLetters();
  }, [ensureCompletedWordsDissolving, fadeEnabled, restoreAllLetters, startAnimationLoop]);

  const focusInput = useCallback(() => {
    const element = textareaRef.current;
    if (!element) return;
    void ensureAudioContext();
    element.focus({ preventScroll: true });
    const caretAt = element.value.length;
    try {
      element.setSelectionRange(caretAt, caretAt);
    } catch {
      // Mobile browsers can throw while setting selection on fresh focus.
    }
  }, [ensureAudioContext]);

  const visibleLetters = useMemo(() => {
    if (!fadeEnabled) return renderedLetters;
    const dissolvedWordIds = new Set(
      wordsRef.current.filter((word) => word.isDissolved).map((word) => word.id)
    );
    return renderedLetters.filter((letter) => {
      if (letter.wordId === null) return true;
      return !dissolvedWordIds.has(letter.wordId);
    });
  }, [fadeEnabled, renderedLetters]);

  const renderedLines = useMemo(() => {
    type Line = { id: number; align: TextAlignMode; letters: LetterRecord[] };
    const lines: Line[] = [];
    let currentLetters: LetterRecord[] = [];
    let currentAlign: TextAlignMode = textAlign;
    let lineId = 0;

    for (const letter of visibleLetters) {
      if (letter.char === '\n') {
        lines.push({ id: lineId++, align: currentAlign, letters: currentLetters });
        currentLetters = [];
        currentAlign = textAlign;
        continue;
      }
      currentAlign = letter.align;
      currentLetters.push(letter);
    }
    lines.push({ id: lineId, align: currentAlign, letters: currentLetters });
    return lines;
  }, [textAlign, visibleLetters]);

  const cycleSize = useCallback(() => {
    setCurrentSize((previous) => {
      const index = SIZE_STEPS.indexOf(previous as typeof SIZE_STEPS[number]);
      const nextIndex = index >= 0 ? (index + 1) % SIZE_STEPS.length : 0;
      return SIZE_STEPS[nextIndex];
    });
  }, []);

  const cycleAlign = useCallback(() => {
    setTextAlign((previous) => (
      previous === 'left' ? 'center' : previous === 'center' ? 'right' : 'left'
    ));
  }, []);

  const textStyleBase = {
    color: '#2C1810',
    fontFamily: "'Lora', 'Instrument Serif', serif",
    lineHeight: 1.8,
    wordBreak: 'break-word' as const,
  };
  const edgePadding = 40;
  const controlBottom = isDesktopLayout ? edgePadding : Math.max(edgePadding, formatBarBottom);
  const writingAreaBottomPadding = isDesktopLayout
    ? edgePadding
    : Math.max(controlBottom + 84, edgePadding + 84 + keyboardInset);

  return (
    <div
      data-card-color={cardColor}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#FFFFFF',
        overscrollBehavior: 'none',
      }}
      onPointerDown={focusInput}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: PAPER_NOISE_BG,
          backgroundRepeat: 'repeat',
          opacity: 0.02,
          pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: edgePadding,
          right: edgePadding,
          zIndex: 1020,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(44,24,16,0.08)',
          color: '#2C1810',
          fontSize: 18,
          lineHeight: 1,
          cursor: 'pointer',
        }}
      >
        ×
      </button>

      <button
        type="button"
        onClick={() => setFadeEnabled((previous) => !previous)}
        style={{
          position: 'fixed',
          bottom: controlBottom,
          zIndex: 1020,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          ...(isDesktopLayout
            ? { right: edgePadding, left: 'auto', transform: 'none' }
            : { left: '50%', transform: 'translateX(-50%)' }),
        }}
      >
        <span
          style={{
            fontFamily: "'Lora', 'Instrument Serif', serif",
            fontStyle: 'italic',
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'lowercase',
            color: 'rgba(44,24,16,0.4)',
          }}
        >
          fade
        </span>
        <span
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            background: fadeEnabled ? 'rgba(44,24,16,0.25)' : 'rgba(44,24,16,0.1)',
            transition: 'all 200ms ease',
            position: 'relative',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: fadeEnabled ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'rgba(44,24,16,0.3)',
              transition: 'all 200ms ease',
            }}
          />
        </span>
      </button>

      <div
        style={{
          position: 'fixed',
          left: isDesktopLayout ? edgePadding : '50%',
          bottom: controlBottom,
          transform: isDesktopLayout ? 'none' : 'translateX(-50%)',
          zIndex: 1015,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          background: 'rgba(44,24,16,0.05)',
          borderRadius: 20,
          padding: '8px 16px',
          pointerEvents: 'auto',
        }}
      >
        <button
          type="button"
          aria-label="Toggle bold"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setIsBold((previous) => !previous);
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isBold ? 'rgba(44,24,16,0.08)' : 'transparent',
            color: isBold ? 'rgba(44,24,16,0.6)' : 'rgba(44,24,16,0.25)',
            fontFamily: "'Lora', 'Instrument Serif', serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          B
        </button>

        <button
          type="button"
          aria-label="Toggle italic"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setIsItalic((previous) => !previous);
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isItalic ? 'rgba(44,24,16,0.08)' : 'transparent',
            color: isItalic ? 'rgba(44,24,16,0.6)' : 'rgba(44,24,16,0.25)',
            fontFamily: "'Lora', 'Instrument Serif', serif",
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          I
        </button>

        <button
          type="button"
          aria-label="Cycle font size"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            cycleSize();
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: currentSize !== SIZE_STEPS[0] ? 'rgba(44,24,16,0.08)' : 'transparent',
            color: currentSize !== SIZE_STEPS[0] ? 'rgba(44,24,16,0.6)' : 'rgba(44,24,16,0.25)',
            fontFamily: "'Lora', 'Instrument Serif', serif",
            fontWeight: 400,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          A↑
        </button>

        <button
          type="button"
          aria-label="Cycle alignment"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            cycleAlign();
          }}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: textAlign !== 'left' ? 'rgba(44,24,16,0.08)' : 'transparent',
            color: textAlign !== 'left' ? 'rgba(44,24,16,0.6)' : 'rgba(44,24,16,0.25)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ width: 12, height: 1.6, borderRadius: 2, background: 'currentColor' }} />
            <span style={{ width: 12, height: 1.6, borderRadius: 2, background: 'currentColor' }} />
            <span style={{ width: 12, height: 1.6, borderRadius: 2, background: 'currentColor' }} />
          </span>
        </button>
      </div>

      <div
        ref={typingAreaRef}
        onPointerDown={(event) => {
          event.stopPropagation();
          focusInput();
        }}
        onTouchStart={(event) => {
          event.stopPropagation();
          focusInput();
        }}
        onClick={(event) => {
          event.stopPropagation();
          focusInput();
        }}
        style={{
          position: 'absolute',
          inset: 0,
          paddingLeft: edgePadding,
          paddingRight: edgePadding,
          paddingTop: edgePadding,
          paddingBottom: writingAreaBottomPadding,
          overflowY: 'auto',
          touchAction: 'manipulation',
          WebkitOverflowScrolling: 'touch',
          ...textStyleBase,
          whiteSpace: 'pre-wrap',
          userSelect: 'none',
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(event) => handleInput(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck={false}
          inputMode="text"
          enterKeyHint="enter"
          aria-label="Journal input"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            color: 'transparent',
            background: 'transparent',
            border: 0,
            outline: 'none',
            resize: 'none',
            zIndex: 1,
            padding: 0,
            margin: 0,
            pointerEvents: 'auto',
            fontSize: 16,
            lineHeight: 1.5,
          }}
        />

        {renderedLetters.length === 0 && !hasTypedOnce && (
          <span
            style={{
              color: 'rgba(44,24,16,0.15)',
              fontFamily: "'Lora', 'Instrument Serif', serif",
              fontStyle: 'italic',
              fontWeight: 300,
              fontSize: 18,
              pointerEvents: 'none',
            }}
          >
            start typing...
          </span>
        )}

        {renderedLines.map((line, lineIndex) => (
          <div
            key={`line-${line.id}-${lineIndex}`}
            style={{
              textAlign: line.align,
              minHeight: 8,
              width: '100%',
            }}
          >
            {line.letters.map((letter) => {
              const currentWord = wordsRef.current.find((word) => word.id === activeWordId);
              const isCurrentWordLetter = (
                letter.wordId !== null &&
                letter.wordId === activeWordId &&
                Boolean(currentWord && !currentWord.completed)
              );
              return (
                <span
                  key={letter.id}
                  ref={(element) => {
                    if (element) {
                      letterElementRefs.current.set(letter.id, element);
                    } else {
                      letterElementRefs.current.delete(letter.id);
                    }
                  }}
                  style={{
                    display: 'inline',
                    opacity: letter.opacity,
                    transform: `translateY(${letter.y}px)`,
                    filter: `blur(${letter.blur}px)`,
                    transition: 'opacity 120ms linear, filter 120ms linear, transform 120ms linear',
                    fontFamily: "'Lora', 'Instrument Serif', serif",
                    fontWeight: letter.bold ? 600 : 300,
                    fontStyle: letter.italic ? 'italic' : 'normal',
                    fontSize: letter.size,
                    lineHeight: 1.8,
                    textShadow: isCurrentWordLetter ? '0 0 8px rgba(44,24,16,0.1)' : 'none',
                  }}
                >
                  {letter.char === ' ' ? '\u00A0' : letter.char}
                </span>
              );
            })}
            {lineIndex === renderedLines.length - 1 && isFocused && (
              <span
                style={{
                  display: 'inline-block',
                  width: 2,
                  height: currentSize + 2,
                  marginLeft: 1,
                  verticalAlign: 'baseline',
                  background: '#2C1810',
                  opacity: isTyping ? 0.5 : 0.4,
                  animation: 'journal-cursor-blink 1s step-end infinite',
                }}
              />
            )}
          </div>
        ))}

        {renderedParticles.map((particle) => (
          <span
            key={particle.id}
            style={{
              position: 'absolute',
              left: particle.x,
              top: particle.y,
              width: 2,
              height: 2,
              borderRadius: '50%',
              background: '#2C1810',
              opacity: particle.opacity,
              pointerEvents: 'none',
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes journal-cursor-blink {
          0%, 49% { opacity: 0; }
          50%, 100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
