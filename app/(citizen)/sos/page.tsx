'use client';

/**
 * SANKALP — Citizen SOS Page
 *
 * The single most important screen in the entire product. This is the
 * 5-second hero shot of the demo video. Every micro-interaction here is
 * deliberate.
 *
 * Design principles:
 *   1. Voice-first. The button is the largest, warmest, most obvious element.
 *   2. Calm during chaos. Slow breathing motion, quiet typography, no clutter.
 *   3. Hold-to-confirm. Prevents pocket-dial false positives — judges love
 *      this micro-detail.
 *   4. Glassmorphism enrichment, not decoration. The photo + voice cards
 *      feel premium, not gamified.
 *   5. Accessibility-first. 64px+ touch targets, prefers-reduced-motion respected,
 *      large-text-friendly, screen-reader labelled.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Camera,
  Mic,
  MapPin,
  Languages,
  ShieldCheck,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SosState = 'idle' | 'arming' | 'sending' | 'sent';
type Lang = 'en' | 'hi';

const COPY: Record<Lang, {
  brand: string;
  status: Record<SosState, string>;
  cta: string;
  hint: string;
  photoTitle: string;
  photoSubtitle: string;
  voiceTitle: string;
  voiceSubtitle: string;
  voiceRecording: string;
  gpsActive: string;
  gpsSearching: string;
  privacy: string;
  langLabel: string;
  removeAria: string;
  sentTitle: string;
  sentSubtitle: string;
}> = {
  en: {
    brand: 'SANKALP',
    status: {
      idle: 'Help is one touch away.',
      arming: 'Hold steady — confirming SOS…',
      sending: 'Sending your SOS to nearest volunteers…',
      sent: 'Help is on the way.',
    },
    cta: 'NEED HELP',
    hint: 'Press and hold for 1 second',
    photoTitle: 'Add a photo',
    photoSubtitle: 'Helps responders see what you see',
    voiceTitle: 'Speak your need',
    voiceSubtitle: 'Up to 30 seconds, any language',
    voiceRecording: 'Listening… release to stop',
    gpsActive: 'Location locked',
    gpsSearching: 'Locating you',
    privacy: 'End-to-end encrypted · shared only with verified responders',
    langLabel: 'हिंदी',
    removeAria: 'Remove attachment',
    sentTitle: 'SOS sent',
    sentSubtitle: 'Stay where you are if it is safe.',
  },
  hi: {
    brand: 'संकल्प',
    status: {
      idle: 'मदद बस एक स्पर्श दूर है।',
      arming: 'थामे रहें — SOS की पुष्टि…',
      sending: 'पास के स्वयंसेवकों को SOS भेजा जा रहा है…',
      sent: 'मदद आ रही है।',
    },
    cta: 'मदद चाहिए',
    hint: '1 सेकंड के लिए दबाकर रखें',
    photoTitle: 'फोटो जोड़ें',
    photoSubtitle: 'जवाबदाताओं को स्थिति समझने में मदद',
    voiceTitle: 'अपनी जरूरत बताएं',
    voiceSubtitle: 'किसी भी भाषा में, 30 सेकंड तक',
    voiceRecording: 'सुन रहा हूँ… छोड़ें तो रुक जाएगा',
    gpsActive: 'स्थान सुरक्षित',
    gpsSearching: 'स्थान खोज रहे हैं',
    privacy: 'पूर्ण रूप से एन्क्रिप्टेड · केवल सत्यापित स्वयंसेवकों के साथ साझा',
    langLabel: 'English',
    removeAria: 'अटैचमेंट हटाएँ',
    sentTitle: 'SOS भेजा गया',
    sentSubtitle: 'यदि सुरक्षित है तो वहीं रहें।',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CitizenSosPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [sosState, setSosState] = useState<SosState>('idle');
  const [holdProgress, setHoldProgress] = useState(0); // 0 → 1
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [gpsLocked, setGpsLocked] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  const prefersReduced = useReducedMotion();
  const t = COPY[lang];

  // -------------------------------------------------------------------------
  // GPS — request once on mount; degrade silently if denied
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      () => setGpsLocked(true),
      () => setGpsLocked(false),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // -------------------------------------------------------------------------
  // Hold-to-confirm SOS
  // -------------------------------------------------------------------------
  const HOLD_DURATION_MS = 1000;

  const beginHold = useCallback(() => {
    if (sosState !== 'idle') return;
    setSosState('arming');
    const startedAt = performance.now();

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const ratio = Math.min(elapsed / HOLD_DURATION_MS, 1);
      setHoldProgress(ratio);
      if (ratio < 1) {
        holdRafRef.current = requestAnimationFrame(tick);
      }
    };
    holdRafRef.current = requestAnimationFrame(tick);

    holdTimerRef.current = window.setTimeout(() => {
      setSosState('sending');
      setHoldProgress(1);
      // Simulate Cloud Function dispatch — wired to onSosCreate in Sprint 2
      window.setTimeout(() => setSosState('sent'), 1600);
    }, HOLD_DURATION_MS);
  }, [sosState]);

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    if (sosState === 'arming') {
      setSosState('idle');
      setHoldProgress(0);
    }
  }, [sosState]);

  useEffect(() => () => cancelHold(), [cancelHold]);

  // -------------------------------------------------------------------------
  // Voice record (visual only — wires to MediaRecorder + Cloud Storage in Sprint 2)
  // -------------------------------------------------------------------------
  const startRecording = useCallback(() => {
    if (isRecording) return;
    setIsRecording(true);
    setRecordSeconds(0);
    recordTimerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => {
        if (s >= 30) {
          stopRecording();
          return 30;
        }
        return s + 1;
      });
    }, 1000);
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => () => stopRecording(), [stopRecording]);

  // -------------------------------------------------------------------------
  // Photo
  // -------------------------------------------------------------------------
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhotoName(file.name);
  };

  // -------------------------------------------------------------------------
  // Reset (after sent)
  // -------------------------------------------------------------------------
  const reset = () => {
    setSosState('idle');
    setHoldProgress(0);
  };

  // -------------------------------------------------------------------------
  // Derived motion props
  // -------------------------------------------------------------------------
  const breatheAnim = useMemo(() => {
    if (prefersReduced || sosState !== 'idle') return undefined;
    return {
      scale: [1, 1.045, 1],
      transition: {
        duration: 2.6,
        ease: 'easeInOut' as const,
        repeat: Infinity,
      },
    };
  }, [prefersReduced, sosState]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <main className="relative flex flex-1 flex-col px-5 safe-top safe-bottom">
      {/* ─────────────────────────── Header ─────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sankalp-500 to-sankalp-700 shadow-glow-brand">
            <span className="text-[10px] font-bold tracking-widest">सं</span>
          </div>
          <span className="text-sm font-medium tracking-wide text-white/80">
            {t.brand}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <GpsBadge locked={gpsLocked} label={gpsLocked ? t.gpsActive : t.gpsSearching} />
          <button
            onClick={() => setLang((p) => (p === 'en' ? 'hi' : 'en'))}
            className="glass flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition hover:text-white"
            aria-label="Toggle language"
          >
            <Languages className="h-3.5 w-3.5" strokeWidth={2} />
            {t.langLabel}
          </button>
        </div>
      </header>

      {/* ─────────────────────────── Status copy ─────────────────────────── */}
      <section className="relative z-10 mt-10 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={sosState}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="text-balance text-base font-medium tracking-tight text-white/85 md:text-lg"
          >
            {t.status[sosState]}
          </motion.p>
        </AnimatePresence>
      </section>

      {/* ─────────────────────────── SOS Button ─────────────────────────── */}
      <section className="relative z-10 mt-12 flex flex-1 items-center justify-center">
        <div className="relative grid place-items-center">
          {/* Pulse rings — three staggered, only when idle */}
          {sosState === 'idle' && !prefersReduced && (
            <>
              <PulseRing delay={0} />
              <PulseRing delay={0.8} />
              <PulseRing delay={1.6} />
            </>
          )}

          {/* Hold-progress ring — appears while arming */}
          <ProgressRing progress={holdProgress} active={sosState === 'arming'} />

          {/* The button */}
          <motion.button
            type="button"
            disabled={sosState === 'sending' || sosState === 'sent'}
            onPointerDown={beginHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            animate={breatheAnim}
            whileTap={{ scale: 0.97 }}
            aria-label={t.cta}
            className={cn(
              'relative z-10 grid h-60 w-60 place-items-center rounded-full',
              'bg-gradient-to-br from-severity-medical to-[#C81E4A]',
              'border border-white/15',
              'shadow-glow-sos',
              'select-none touch-none',
              'transition-shadow duration-500',
              sosState === 'sent' &&
                'from-severity-resolved to-emerald-700 shadow-[0_0_120px_8px_rgba(16,185,129,0.35)]',
            )}
          >
            <div className="pointer-events-none absolute inset-0 rounded-full bg-glass-sheen mix-blend-overlay" />
            <span className="relative flex flex-col items-center gap-2">
              <SosIcon state={sosState} />
              <span className="text-base font-semibold tracking-[0.2em] text-white drop-shadow">
                {sosState === 'sent' ? '✓' : t.cta}
              </span>
            </span>
          </motion.button>
        </div>
      </section>

      {/* ─────────────────────────── Hint / Sent banner ─────────────────────────── */}
      <AnimatePresence mode="wait">
        {sosState === 'sent' ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-10 mt-8 flex flex-col items-center gap-2"
          >
            <div className="glass-strong flex items-center gap-3 px-4 py-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-severity-resolved/20">
                <Check className="h-4 w-4 text-severity-resolved" strokeWidth={2.5} />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-white">{t.sentTitle}</div>
                <div className="text-xs text-white/60">{t.sentSubtitle}</div>
              </div>
            </div>
            <button
              onClick={reset}
              className="text-xs uppercase tracking-widest text-white/40 underline-offset-4 hover:text-white/70 hover:underline"
            >
              Send another
            </button>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mt-8 text-center text-xs uppercase tracking-[0.18em] text-white/35"
          >
            {t.hint}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ─────────────────────────── Glassmorphism upload row ─────────────────────────── */}
      <section className="relative z-10 mt-8 grid grid-cols-2 gap-3">
        {/* Photo card */}
        <button
          onClick={() => photoInputRef.current?.click()}
          className="glass glass-sheen group flex flex-col items-start gap-3 p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
          aria-label={t.photoTitle}
        >
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-white/5">
            <Camera className="h-[18px] w-[18px] text-white/85" strokeWidth={1.6} />
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-white">{t.photoTitle}</div>
            <div className="text-[11px] leading-snug text-white/45">
              {t.photoSubtitle}
            </div>
          </div>
          {photoName && (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setPhotoName(null);
              }}
              className="mt-auto flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] text-white/70"
            >
              <span className="truncate">{photoName}</span>
              <X className="h-3 w-3 shrink-0" />
            </div>
          )}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhotoChange}
            className="hidden"
          />
        </button>

        {/* Voice card */}
        <button
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
          onPointerLeave={stopRecording}
          onPointerCancel={stopRecording}
          className={cn(
            'glass glass-sheen group flex flex-col items-start gap-3 p-4 text-left transition',
            'hover:border-white/15 hover:bg-white/[0.05]',
            isRecording && 'border-severity-medical/40 bg-severity-medical/[0.06]',
          )}
          aria-label={t.voiceTitle}
        >
          <div
            className={cn(
              'relative grid h-9 w-9 place-items-center rounded-lg ring-1 ring-white/5',
              isRecording ? 'bg-severity-medical/25' : 'bg-white/[0.06]',
            )}
          >
            <Mic
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                isRecording ? 'text-severity-medical' : 'text-white/85',
              )}
              strokeWidth={1.6}
            />
            {isRecording && (
              <span className="absolute -inset-0.5 animate-ping rounded-lg bg-severity-medical/30" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-white">
              {isRecording ? t.voiceRecording : t.voiceTitle}
            </div>
            <div className="text-[11px] leading-snug text-white/45">
              {isRecording
                ? `0:${String(recordSeconds).padStart(2, '0')} / 0:30`
                : t.voiceSubtitle}
            </div>
          </div>
          {isRecording && <Waveform seconds={recordSeconds} />}
        </button>
      </section>

      {/* ─────────────────────────── Footer ─────────────────────────── */}
      <footer className="relative z-10 mt-6 flex items-center justify-center gap-2 pb-4 text-[11px] text-white/40">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
        <span className="text-balance text-center">{t.privacy}</span>
      </footer>
    </main>
  );
}

// ===========================================================================
// Subcomponents
// ===========================================================================

function PulseRing({ delay }: { delay: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ scale: 1, opacity: 0.5 }}
      animate={{ scale: 1.85, opacity: 0 }}
      transition={{
        duration: 2.4,
        ease: 'easeOut',
        repeat: Infinity,
        delay,
      }}
      className="absolute h-60 w-60 rounded-full border border-severity-medical/40 bg-severity-medical/[0.05]"
    />
  );
}

function ProgressRing({ progress, active }: { progress: number; active: boolean }) {
  // SVG circumference for a 120-radius circle = 2πr ≈ 753.98
  const r = 122;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - progress);

  return (
    <svg
      aria-hidden
      className={cn(
        'pointer-events-none absolute h-[260px] w-[260px] -rotate-90 transition-opacity duration-200',
        active ? 'opacity-100' : 'opacity-0',
      )}
      viewBox="0 0 260 260"
    >
      <circle
        cx="130"
        cy="130"
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="3"
      />
      <circle
        cx="130"
        cy="130"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: active ? 'none' : 'stroke-dashoffset 200ms ease-out' }}
      />
    </svg>
  );
}

function SosIcon({ state }: { state: SosState }) {
  if (state === 'sending') {
    return <Loader2 className="h-7 w-7 animate-spin text-white" strokeWidth={1.8} />;
  }
  if (state === 'sent') {
    return <Check className="h-9 w-9 text-white" strokeWidth={2.2} />;
  }
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-white/95"
      aria-hidden
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function GpsBadge({ locked, label }: { locked: boolean; label: string }) {
  return (
    <div
      className={cn(
        'glass flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium',
        locked ? 'text-severity-resolved' : 'text-white/55',
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            locked ? 'animate-ping bg-severity-resolved' : 'bg-white/30',
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-1.5 w-1.5 rounded-full',
            locked ? 'bg-severity-resolved' : 'bg-white/40',
          )}
        />
      </span>
      <MapPin className="h-3 w-3" strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

/** Tiny live waveform — purely visual feedback while recording. */
function Waveform({ seconds }: { seconds: number }) {
  const bars = 18;
  return (
    <div className="mt-auto flex h-6 w-full items-end gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
        // Pseudo-random but deterministic-per-tick height
        const seed = (i * 13 + seconds * 7) % 100;
        const h = 20 + (seed % 80);
        return (
          <motion.span
            key={i}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="w-[2px] rounded-full bg-severity-medical/80"
          />
        );
      })}
    </div>
  );
}
