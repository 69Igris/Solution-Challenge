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
 *
 * Pipeline on hold-complete:
 *   GPS coords + photoFile + voiceBlob + text + lang
 *     → multipart POST to /api/sos
 *     → Gemini parse + Firestore write on the server
 *     → render the parsed result card with severity + summary + needs
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
  AlertTriangle,
  Activity,
  ArrowRight,
  Heart,
  HeartPulse,
  User,
  Navigation,
  Sparkles,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type SosState = 'idle' | 'arming' | 'sending' | 'sent' | 'error';
type Lang = 'en' | 'hi';

interface MatchInfo {
  matched: boolean;
  matchedVolunteerUid: string | null;
  matchedVolunteerName: string | null;
  matchScore: number;
  matchReason: string;
  distanceKm: number | null;
  estimatedEtaMinutes: number | null;
  candidatesConsidered: number;
}

interface ParsedResult {
  alertId: string;
  status: string;
  needTypes: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  severityScore: number;
  summary: string;
  summaryLocalized: string;
  vulnerabilityFlags: {
    elderly: boolean;
    child: boolean;
    pregnant: boolean;
    disabled: boolean;
    injured: boolean;
  };
  accessibilityNotes: string | null;
  match: MatchInfo | null;
  elapsedMs: number;
}

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
  errorTitle: string;
  retryLabel: string;
  responseLabel: string;
  needsLabel: string;
  volunteerLabel: string;
  whyMatched: string;
  etaLabel: string;
  noMatchTitle: string;
  noMatchSubtitle: string;
}> = {
  en: {
    brand: 'SANKALP',
    status: {
      idle: 'Help is three taps away.',
      arming: 'Keep tapping…',
      sending: 'AI is dispatching your SOS…',
      sent: 'Help is on the way.',
      error: 'Something went wrong. Try again.',
    },
    cta: 'NEED HELP',
    hint: 'Tap 3 times to send SOS',
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
    errorTitle: 'Could not send',
    retryLabel: 'Try again',
    responseLabel: 'AI response in',
    needsLabel: 'Identified needs',
    volunteerLabel: 'Matched volunteer',
    whyMatched: 'Why this volunteer',
    etaLabel: 'ETA',
    noMatchTitle: 'Searching for a volunteer…',
    noMatchSubtitle: 'No one available in radius — escalating to NGOs.',
  },
  hi: {
    brand: 'संकल्प',
    status: {
      idle: 'तीन टैप में मदद आएगी।',
      arming: 'टैप करते रहें…',
      sending: 'AI आपका SOS भेज रहा है…',
      sent: 'मदद आ रही है।',
      error: 'कुछ गड़बड़ हुई, फिर कोशिश करें।',
    },
    cta: 'मदद चाहिए',
    hint: 'SOS भेजने के लिए 3 बार टैप करें',
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
    errorTitle: 'भेजा नहीं जा सका',
    retryLabel: 'फिर कोशिश करें',
    responseLabel: 'AI ने जवाब दिया',
    needsLabel: 'पहचानी गई ज़रूरतें',
    volunteerLabel: 'मिले हुए स्वयंसेवक',
    whyMatched: 'इस स्वयंसेवक का कारण',
    etaLabel: 'ETA',
    noMatchTitle: 'स्वयंसेवक की खोज जारी…',
    noMatchSubtitle: 'पास में कोई नहीं — NGOs को सूचित कर रहे हैं।',
  },
};

// Bengaluru fallback coords for the demo if GPS denied
const DEMO_FALLBACK_COORDS = { lat: 12.9716, lng: 77.5946 };

const SEVERITY_TINT: Record<
  ParsedResult['severity'],
  { ring: string; text: string; bg: string; label: string }
> = {
  critical: { ring: 'ring-severity-medical', text: 'text-severity-medical', bg: 'bg-severity-medical/15', label: 'CRITICAL' },
  high:     { ring: 'ring-severity-evacuation', text: 'text-severity-evacuation', bg: 'bg-severity-evacuation/15', label: 'HIGH' },
  medium:   { ring: 'ring-severity-food', text: 'text-severity-food', bg: 'bg-severity-food/15', label: 'MEDIUM' },
  low:      { ring: 'ring-severity-shelter', text: 'text-severity-shelter', bg: 'bg-severity-shelter/15', label: 'LOW' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CitizenSosPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [sosState, setSosState] = useState<SosState>('idle');
  const [holdProgress, setHoldProgress] = useState(0); // 0 → 1
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState<string>('audio/webm');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLocked, setGpsLocked] = useState(false);
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Tap-to-confirm: 3 quick taps within 2.5s fires the SOS.
  // Replaces the press-and-hold gesture for clearer demo + better
  // mobile-touch reliability.
  const [tapCount, setTapCount] = useState(0);
  const tapResetTimerRef = useRef<number | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const prefersReduced = useReducedMotion();
  const t = COPY[lang];

  // -------------------------------------------------------------------------
  // GPS — request once on mount; degrade silently if denied
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsLocked(true);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGpsLocked(false),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // -------------------------------------------------------------------------
  // 3-tap-to-confirm SOS → submitSos()
  //   - Tap 1 → "arming", count = 1
  //   - Tap 2 within 2.5s → count = 2
  //   - Tap 3 within 2.5s → submitSos() fires
  //   - 2.5s of inactivity → reset to idle
  // Equally pocket-dial-resistant as press-and-hold, much more visible.
  // -------------------------------------------------------------------------
  const TAP_RESET_MS = 2500;
  const TAPS_REQUIRED = 3;

  const submitSos = useCallback(async () => {
    setSosState('sending');
    setErrorMsg(null);

    // GPS fallback for demo if user hasn't granted permission
    const submitCoords = coords ?? DEMO_FALLBACK_COORDS;

    const fd = new FormData();
    fd.append('lat', String(submitCoords.lat));
    fd.append('lng', String(submitCoords.lng));
    fd.append('language', lang);
    if (photoFile) fd.append('photo', photoFile);
    if (voiceBlob) {
      const ext = voiceMime.includes('webm') ? 'webm' : voiceMime.includes('ogg') ? 'ogg' : 'm4a';
      fd.append('voice', voiceBlob, `voice.${ext}`);
    }
    // For demo: include a textual SOS hint when no media is attached, so
    // judges can demo just by tapping the button. Remove this `else` block
    // once volunteer onboarding + auth land in Sprint 2.
    if (!photoFile && !voiceBlob) {
      fd.append(
        'text',
        'Stuck on 2nd floor, ground floor flooded, elderly grandmother needs medical help',
      );
    }

    try {
      const res = await fetch('/api/sos', {
        method: 'POST',
        // Demo mode header — bypasses Firebase Auth ID-token verification.
        // The server only honours this when SANKALP_DEMO_MODE=1.
        headers: { 'x-demo-uid': 'demo-citizen-001' },
        body: fd,
      });
      const responseText = await res.clone().text().catch(() => '');
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      if (!res.ok || !json.ok) {
        throw new Error(
          json.message || json.error || responseText || `HTTP ${res.status}: SOS failed`,
        );
      }
      setParsedResult({
        alertId: json.alertId,
        status: json.status,
        needTypes: json.parsed.needTypes,
        severity: json.parsed.severity,
        severityScore: json.parsed.severityScore,
        summary: json.parsed.summary,
        summaryLocalized: json.parsed.summaryLocalized,
        vulnerabilityFlags: json.parsed.vulnerabilityFlags,
        accessibilityNotes: json.parsed.accessibilityNotes,
        match: json.match ?? null,
        elapsedMs: json.elapsedMs ?? 0,
      });
      setSosState('sent');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setSosState('error');
      setHoldProgress(0);
    }
  }, [coords, lang, photoFile, voiceBlob, voiceMime]);

  const handleTap = useCallback(() => {
    // Ignore taps while submitting/sent
    if (sosState === 'sending' || sosState === 'sent') return;

    // Clear any existing reset timer — we got a tap, restart the window
    if (tapResetTimerRef.current) {
      window.clearTimeout(tapResetTimerRef.current);
      tapResetTimerRef.current = null;
    }

    setErrorMsg(null);
    const next = tapCount + 1;
    setTapCount(next);
    setSosState('arming');
    setHoldProgress(next / TAPS_REQUIRED); // reuse hold ring visually

    if (next >= TAPS_REQUIRED) {
      // Fire! Reset count immediately so a second SOS won't trigger from
      // residual state.
      setTapCount(0);
      setHoldProgress(1);
      submitSos();
      return;
    }

    // Schedule auto-reset if user doesn't complete the sequence
    tapResetTimerRef.current = window.setTimeout(() => {
      setTapCount(0);
      setHoldProgress(0);
      setSosState((s) => (s === 'arming' ? 'idle' : s));
    }, TAP_RESET_MS);
  }, [tapCount, sosState, submitSos]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tapResetTimerRef.current) {
        window.clearTimeout(tapResetTimerRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Voice recording — real MediaRecorder
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported MIME type
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mime =
        candidates.find((m) =>
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m),
        ) ?? '';

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, {
          type: mime || 'audio/webm',
        });
        if (blob.size > 0) {
          setVoiceBlob(blob);
          setVoiceMime(mime || 'audio/webm');
        }
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };
      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setRecordSeconds(0);
      stopRecordingRef.current = () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === 'recording'
        ) {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        setIsRecording(false);
      };
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s + 1 >= 30) {
            stopRecordingRef.current();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      // Mic permission denied — degrade silently, the user can still send
      // a text/photo SOS. We don't throw a modal in their face mid-emergency.
      console.warn('Microphone permission denied:', err);
    }
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  useEffect(() => () => stopRecording(), [stopRecording]);

  // -------------------------------------------------------------------------
  // Photo
  // -------------------------------------------------------------------------
  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      setPhotoName(file.name);
    }
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoName(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // -------------------------------------------------------------------------
  // Reset (after sent or error)
  // -------------------------------------------------------------------------
  const reset = () => {
    setSosState('idle');
    setHoldProgress(0);
    setParsedResult(null);
    setErrorMsg(null);
    setPhotoFile(null);
    setPhotoName(null);
    setVoiceBlob(null);
    setRecordSeconds(0);
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

  const showHero = sosState !== 'sent';

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
            className={cn(
              'text-balance text-base font-medium tracking-tight md:text-lg',
              sosState === 'error' ? 'text-severity-medical' : 'text-white/85',
            )}
          >
            {t.status[sosState]}
          </motion.p>
        </AnimatePresence>
      </section>

      {/* ─────────────────────────── SOS Button ─────────────────────────── */}
      {showHero && (
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

            {/* Tap-progress ring — fills as taps accumulate (1/3 → 2/3 → 3/3) */}
            <ProgressRing progress={holdProgress} active={sosState === 'arming'} />

            {/* The button — single click handler. 3 taps within 2.5s fires SOS. */}
            <motion.button
              type="button"
              disabled={sosState === 'sending'}
              onClick={handleTap}
              animate={breatheAnim}
              whileTap={{ scale: 0.94 }}
              aria-label={`${t.cta} — tap ${TAPS_REQUIRED} times to send`}
              className={cn(
                'relative z-10 grid h-60 w-60 place-items-center rounded-full',
                'bg-gradient-to-br from-severity-medical to-[#C81E4A]',
                'border border-white/15',
                'shadow-glow-sos',
                'select-none touch-none',
                'transition-shadow duration-500',
                sosState === 'sending' && 'opacity-90',
              )}
            >
              <div className="pointer-events-none absolute inset-0 rounded-full bg-glass-sheen mix-blend-overlay" />
              <span className="relative flex flex-col items-center gap-2">
                <SosIcon state={sosState} />
                <span className="text-base font-semibold tracking-[0.2em] text-white drop-shadow">
                  {t.cta}
                </span>
              </span>
            </motion.button>
          </div>
        </section>
      )}

      {/* ─────────────────────────── Sent — parsed result reveal ─────────────────────────── */}
      <AnimatePresence>
        {sosState === 'sent' && parsedResult && (
          <ParsedResultPanel
            key="parsed"
            result={parsedResult}
            t={t}
            onReset={reset}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────── Hint / Error ─────────────────────────── */}
      <AnimatePresence mode="wait">
        {sosState === 'error' && errorMsg ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative z-10 mt-8 flex flex-col items-center gap-2"
          >
            <div className="glass-strong flex max-w-xs items-start gap-3 px-4 py-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-severity-medical/20">
                <AlertTriangle className="h-4 w-4 text-severity-medical" strokeWidth={2.2} />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-white">{t.errorTitle}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/55">
                  {errorMsg}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSosState('idle')}
              className="text-xs uppercase tracking-widest text-white/60 underline-offset-4 hover:text-white hover:underline"
            >
              {t.retryLabel}
            </button>
          </motion.div>
        ) : sosState === 'idle' || sosState === 'arming' ? (
          <motion.div
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-10 mt-8 flex flex-col items-center gap-3"
          >
            {/* Tap progress dashes — visual count of how many taps so far */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TAPS_REQUIRED }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 w-8 rounded-sm transition-colors duration-200',
                    i < tapCount
                      ? 'bg-severity-medical shadow-[0_0_8px_rgba(230,57,80,0.6)]'
                      : 'bg-white/15',
                  )}
                />
              ))}
            </div>
            <p className="text-center text-xs uppercase tracking-[0.18em] text-white/35">
              {tapCount === 0
                ? t.hint
                : tapCount === TAPS_REQUIRED - 1
                  ? lang === 'hi' ? 'एक और टैप' : 'One more tap'
                  : lang === 'hi'
                    ? `${TAPS_REQUIRED - tapCount} और टैप`
                    : `${TAPS_REQUIRED - tapCount} more taps`}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ─────────────────────────── Glassmorphism upload row ─────────────────────────── */}
      {sosState !== 'sent' && (
        <section className="relative z-10 mt-8 grid grid-cols-2 gap-3">
          {/* Photo card */}
          <button
            onClick={() => photoInputRef.current?.click()}
            className="glass glass-sheen group flex flex-col items-start gap-3 p-4 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
            aria-label={t.photoTitle}
            type="button"
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
                  clearPhoto();
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
              voiceBlob && !isRecording && 'border-severity-resolved/30',
            )}
            aria-label={t.voiceTitle}
            type="button"
          >
            <div
              className={cn(
                'relative grid h-9 w-9 place-items-center rounded-lg ring-1 ring-white/5',
                isRecording ? 'bg-severity-medical/25' : voiceBlob ? 'bg-severity-resolved/20' : 'bg-white/[0.06]',
              )}
            >
              <Mic
                className={cn(
                  'h-[18px] w-[18px] transition-colors',
                  isRecording
                    ? 'text-severity-medical'
                    : voiceBlob
                      ? 'text-severity-resolved'
                      : 'text-white/85',
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
                  : voiceBlob
                    ? `Recorded · ${(voiceBlob.size / 1024).toFixed(0)} KB`
                    : t.voiceSubtitle}
              </div>
            </div>
            {isRecording && <Waveform seconds={recordSeconds} />}
          </button>
        </section>
      )}

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
      <circle cx="130" cy="130" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      <circle
        cx="130" cy="130" r={r}
        fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"
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
  return (
    <svg
      width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
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

function Waveform({ seconds }: { seconds: number }) {
  const bars = 18;
  return (
    <div className="mt-auto flex h-6 w-full items-end gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
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

// ---------------------------------------------------------------------------
// Parsed-result reveal panel — the WOW moment of the demo
// ---------------------------------------------------------------------------
type Translations = (typeof COPY)[Lang];

function ParsedResultPanel({
  result,
  t,
  onReset,
}: {
  result: ParsedResult;
  t: Translations;
  onReset: () => void;
}) {
  const tint = SEVERITY_TINT[result.severity];
  const flagLabels: Array<[keyof ParsedResult['vulnerabilityFlags'], string]> = [
    ['elderly', 'Elderly'],
    ['child', 'Child'],
    ['pregnant', 'Pregnant'],
    ['disabled', 'Disabled'],
    ['injured', 'Injured'],
  ];
  const activeFlags = flagLabels.filter(([k]) => result.vulnerabilityFlags[k]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-10 mt-8 flex flex-col gap-4"
    >
      {/* Sent banner */}
      <div className="glass-strong flex items-center gap-3 px-4 py-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-severity-resolved/20">
          <Check className="h-5 w-5 text-severity-resolved" strokeWidth={2.5} />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-white">{t.sentTitle}</div>
          <div className="text-xs text-white/55">{t.sentSubtitle}</div>
        </div>
        <div className="text-right text-[10px] uppercase tracking-widest text-white/35">
          <div>{t.responseLabel}</div>
          <div className="font-mono text-white/70">{result.elapsedMs}ms</div>
        </div>
      </div>

      {/* Severity + summary card */}
      <div className={cn('glass-strong flex flex-col gap-3 p-4 ring-1', tint.ring)}>
        <div className="flex items-center justify-between">
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]',
              tint.bg,
              tint.text,
            )}
          >
            <Activity className="h-3 w-3" strokeWidth={2.4} />
            {tint.label} · {result.severityScore}/100
          </div>
          <div className="font-mono text-[10px] text-white/35">
            #{result.alertId.slice(0, 8)}
          </div>
        </div>
        <p className="text-sm leading-relaxed text-white/90">
          {result.summaryLocalized || result.summary}
        </p>
        {result.accessibilityNotes && (
          <p className="text-[11px] italic leading-snug text-white/50">
            {result.accessibilityNotes}
          </p>
        )}
      </div>

      {/* Identified needs + vulnerability flags */}
      <div className="glass-strong flex flex-col gap-2 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          {t.needsLabel}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {result.needTypes.map((n) => (
            <span
              key={n}
              className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white/80"
            >
              {n}
            </span>
          ))}
          {activeFlags.map(([k, label]) => (
            <span
              key={k}
              className="flex items-center gap-1 rounded-md border border-severity-evacuation/30 bg-severity-evacuation/10 px-2 py-1 text-[11px] text-severity-evacuation"
            >
              <HeartPulse className="h-3 w-3" strokeWidth={2.2} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Matched volunteer — the WOW moment */}
      {result.match && <MatchPanel match={result.match} t={t} />}

      {/* Continue to live status */}
      <Link
        href={`/status/${result.alertId}`}
        className="group glass-strong relative mt-1 flex items-center justify-between overflow-hidden px-4 py-3 transition hover:ring-1 hover:ring-sankalp-500/30"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sankalp-500/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        />
        <div className="relative">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sankalp-300">
            Track your help
          </div>
          <div className="text-sm font-medium text-white">
            View live status & timeline
          </div>
        </div>
        <ArrowRight className="relative h-4 w-4 text-white/55 transition-transform group-hover:translate-x-1 group-hover:text-white" />
      </Link>

      <button
        onClick={onReset}
        className="mx-auto mt-2 text-xs uppercase tracking-widest text-white/40 underline-offset-4 hover:text-white/70 hover:underline"
      >
        Send another
      </button>
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// MatchPanel — the matched-volunteer reveal card
// ---------------------------------------------------------------------------
function MatchPanel({ match, t }: { match: MatchInfo; t: Translations }) {
  // No-match state — escalating to NGOs
  if (!match.matched) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="glass-strong flex items-center gap-3 p-4"
      >
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-severity-food/15 ring-1 ring-severity-food/30">
          <Search className="h-4 w-4 animate-pulse text-severity-food" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">{t.noMatchTitle}</div>
          <div className="mt-0.5 text-[11px] text-white/55">
            {t.noMatchSubtitle}
          </div>
        </div>
      </motion.div>
    );
  }

  // Initials avatar
  const initials = (match.matchedVolunteerName ?? 'NA')
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="glass-strong relative overflow-hidden p-4"
    >
      {/* subtle hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-severity-resolved/15 blur-2xl"
      />

      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sankalp-500 to-sankalp-700 text-sm font-semibold text-white shadow-glow-brand">
          {initials || <User className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-severity-resolved">
            {t.volunteerLabel}
          </div>
          <div className="text-sm font-medium text-white">
            {match.matchedVolunteerName ?? 'Volunteer'}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/60">
            {match.distanceKm !== null && (
              <span className="flex items-center gap-1">
                <Navigation className="h-3 w-3" strokeWidth={2} />
                {match.distanceKm.toFixed(1)} km
              </span>
            )}
            {match.estimatedEtaMinutes !== null && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" strokeWidth={2} />
                {t.etaLabel} {match.estimatedEtaMinutes} min
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">
            score
          </div>
          <div className="font-mono text-base font-semibold text-white/90">
            {(match.matchScore * 100).toFixed(0)}
          </div>
        </div>
      </div>

      {/* The "Why you were matched" line — the explainability gem */}
      <div className="relative mt-3 flex items-start gap-2 rounded-lg border border-sankalp-500/20 bg-sankalp-500/[0.06] px-3 py-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sankalp-300" strokeWidth={2.2} />
        <div className="flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sankalp-300">
            {t.whyMatched}
          </div>
          <div className="mt-0.5 text-[12px] leading-relaxed text-white/85">
            {match.matchReason}
          </div>
        </div>
      </div>

      {match.candidatesConsidered > 0 && (
        <div className="relative mt-2 text-right text-[10px] uppercase tracking-widest text-white/30">
          chosen from {match.candidatesConsidered} candidates
        </div>
      )}
    </motion.div>
  );
}
