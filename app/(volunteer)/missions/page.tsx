'use client';

/**
 * SANKALP — Volunteer Mission Board
 *
 * The volunteer's home screen. Live-subscribes to missions assigned to them
 * and renders the active mission as a hero card. When standing by, shows
 * personal stats + recent mission history.
 *
 * Demo identity:
 *   - URL `?as=demo-volunteer-001` selects which volunteer to view as.
 *   - Defaults to demo-volunteer-001 (Priya Sharma).
 *   - Production: Firebase Auth phone-OTP populates this automatically.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Award,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  ShieldAlert,
  ToggleLeft,
  ToggleRight,
  User,
} from 'lucide-react';
import { useEnsureAuth } from '@/lib/auth-hooks';
import {
  useAlert,
  useMissionsForVolunteer,
  useVolunteer,
} from '@/lib/firestore-hooks';
import { MissionCard } from '@/components/volunteer/MissionCard';
import { cn, timeAgo } from '@/lib/utils';

const DEFAULT_DEMO_VOLUNTEER = 'demo-volunteer-001';

const ACTIVE_STATUSES = ['assigned', 'en_route', 'on_site'] as const;

export default function VolunteerMissionsPage() {
  const sp = useSearchParams();
  const volunteerUid = sp?.get('as') ?? DEFAULT_DEMO_VOLUNTEER;

  const auth = useEnsureAuth();
  const { volunteer } = useVolunteer(volunteerUid);
  const { missions, loading: missionsLoading, error: missionsError } =
    useMissionsForVolunteer(volunteerUid);

  // Active mission = the most recent non-terminal one
  const activeMission = useMemo(
    () =>
      missions.find((m) =>
        (ACTIVE_STATUSES as readonly string[]).includes(m.status),
      ) ?? null,
    [missions],
  );

  const { alert: activeAlert } = useAlert(activeMission?.alertId ?? null);

  const recentCompleted = useMemo(
    () =>
      missions
        .filter((m) => m.status === 'completed' || m.status === 'aborted')
        .slice(0, 5),
    [missions],
  );

  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // "New mission" arrival detection — fires the celebratory overlay when a
  // mission transitions from null → assigned. Uses a ref so initial mount
  // (after Firestore subscription resolves) doesn't trigger it falsely.
  const [showArrival, setShowArrival] = useState(false);
  const lastSeenMissionIdRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (missionsLoading) return;
    const currentId =
      activeMission && activeMission.status === 'assigned'
        ? activeMission.missionId
        : null;

    // Skip the very first non-loading render so we don't celebrate
    // a mission that was already there when the page loaded.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      lastSeenMissionIdRef.current = currentId;
      return;
    }

    if (currentId && currentId !== lastSeenMissionIdRef.current) {
      setShowArrival(true);
      window.setTimeout(() => setShowArrival(false), 3200);
    }
    lastSeenMissionIdRef.current = currentId;
  }, [activeMission, missionsLoading]);

  // Mission status update — calls PATCH /api/missions/[id]
  const transition = async (
    next: 'en_route' | 'on_site' | 'completed' | 'aborted',
  ) => {
    if (!activeMission || transitioning) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await fetch(`/api/missions/${activeMission.missionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-demo-uid': volunteerUid,
        },
        body: JSON.stringify({ status: next }),
      });
      const responseText = await res.clone().text().catch(() => '');
      let json: any = {};
      try {
        json = await res.json();
      } catch {
        json = {};
      }
      if (!res.ok || !json.ok) {
        const message = json.message || json.error || responseText || `HTTP ${res.status}`;
        setTransitionError(message);
        console.error('[missions] transition failed', message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not update mission';
      setTransitionError(message);
      console.error('[missions] transition failed', err);
    } finally {
      setTransitioning(false);
    }
  };

  // === Auth bootstrap ===
  if (auth.loading) {
    return (
      <main className="grid flex-1 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-sankalp-400" />
      </main>
    );
  }
  if (auth.error) {
    return (
      <main className="grid flex-1 place-items-center px-5">
        <div className="glass-strong max-w-md p-5 ring-1 ring-severity-medical/30">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-severity-medical" />
            <div>
              <div className="text-sm font-medium text-white">
                Could not start session
              </div>
              <div className="mt-1 text-[11px] text-white/60">
                Enable Anonymous Authentication in Firebase Console.
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col px-5 safe-top safe-bottom">
      {/* New-mission arrival overlay */}
      <NewMissionOverlay show={showArrival} severity={activeAlert?.parsed?.severity ?? null} />

      {/* Header */}
      <Header volunteer={volunteer} volunteerUid={volunteerUid} />

      {/* Active mission OR standby */}
      <section className="relative z-10 mt-4 flex-1">
        {missionsLoading ? (
          <div className="glass-strong grid h-32 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/45" />
          </div>
        ) : missionsError ? (
          <div className="glass-strong p-4 text-[12px] text-severity-medical">
            Could not subscribe: {missionsError.message}
          </div>
        ) : activeMission ? (
          <>
            {transitionError && (
              <div className="mb-2 rounded-md border border-severity-medical/30 bg-severity-medical/[0.08] px-3 py-2 text-[12px] text-severity-medical">
                {transitionError}
              </div>
            )}
            <MissionCard
              mission={activeMission}
              alert={activeAlert}
              onTransition={transition}
            />
          </>
        ) : (
          <StandbyPanel
            volunteerName={volunteer?.displayName ?? 'Volunteer'}
            completedCount={recentCompleted.filter((m) => m.status === 'completed').length}
            allMissionsCount={missions.length}
          />
        )}
      </section>

      {/* History */}
      {recentCompleted.length > 0 && (
        <section className="relative z-10 mt-4 mb-6">
          <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Recent missions
          </div>
          <div className="flex flex-col gap-2">
            {recentCompleted.map((m) => (
              <HistoryRow key={m.missionId} m={m} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
function Header({
  volunteer,
  volunteerUid,
}: {
  volunteer: ReturnType<typeof useVolunteer>['volunteer'];
  volunteerUid: string;
}) {
  const initials = (volunteer?.displayName ?? 'NA')
    .split(' ')
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <header className="relative z-10 flex items-center justify-between pt-2">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sankalp-500 to-sankalp-700 text-xs font-semibold text-white shadow-glow-brand">
          {initials || <User className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-sm font-medium text-white">
            Hi, {volunteer?.displayName?.split(' ')[0] ?? 'Volunteer'}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">
            {volunteerUid}
          </div>
        </div>
      </div>

      <AvailabilityPill available={volunteer?.isAvailable ?? false} />
    </header>
  );
}

function AvailabilityPill({ available }: { available: boolean }) {
  return (
    <div
      className={cn(
        'glass flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-widest',
        available ? 'text-severity-resolved' : 'text-severity-food',
      )}
    >
      {available ? (
        <ToggleRight className="h-4 w-4" strokeWidth={2} />
      ) : (
        <ToggleLeft className="h-4 w-4" strokeWidth={2} />
      )}
      {available ? 'Available' : 'On mission'}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Standby state
// ---------------------------------------------------------------------------
function StandbyPanel({
  volunteerName,
  completedCount,
  allMissionsCount,
}: {
  volunteerName: string;
  completedCount: number;
  allMissionsCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-strong relative overflow-hidden p-6"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-sankalp-500/10 blur-3xl"
      />
      <div className="relative flex flex-col items-center text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-severity-resolved/15 ring-1 ring-severity-resolved/30">
          <CheckCircle2 className="h-7 w-7 text-severity-resolved" strokeWidth={1.6} />
        </div>
        <div className="mt-4 text-base font-medium text-white">
          Standing by, {volunteerName.split(' ')[0]}.
        </div>
        <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-white/55">
          When the next SOS in your area is matched to you, it will appear here.
          Keep your phone unlocked.
        </p>

        <div className="mt-6 grid w-full grid-cols-2 gap-2">
          <Stat icon={Award} label="Lives assisted" value={completedCount.toString()} />
          <Stat icon={Activity} label="Total missions" value={allMissionsCount.toString()} />
        </div>
      </div>
    </motion.div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Award;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-left">
      <Icon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.8} />
      <div className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-white">
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History row
// ---------------------------------------------------------------------------
function HistoryRow({ m }: { m: { missionId: string; status: string; alertId: string; acceptedAt: number; completedAt: number | null } }) {
  return (
    <div className="glass flex items-center gap-3 p-2.5">
      <div
        className={cn(
          'grid h-7 w-7 place-items-center rounded-full',
          m.status === 'completed'
            ? 'bg-severity-resolved/15 text-severity-resolved'
            : 'bg-white/[0.06] text-white/55',
        )}
      >
        {m.status === 'completed' ? (
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.2} />
        ) : (
          <Clock className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-white/75">
          Alert #{m.alertId.slice(0, 8)}
        </div>
        <div className="text-[10px] text-white/40">
          {m.status === 'completed' ? 'Completed' : 'Cancelled'} · {timeAgo(m.completedAt ?? m.acceptedAt)}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewMissionOverlay — celebratory ping moment when a fresh mission arrives
// ---------------------------------------------------------------------------
function NewMissionOverlay({
  show,
  severity,
}: {
  show: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low' | null;
}) {
  // Vibrate on supported devices
  useEffect(() => {
    if (!show) return;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.([90, 60, 90, 60, 180]);
      } catch {
        /* ignore */
      }
    }
  }, [show]);

  const tint =
    severity === 'critical'
      ? 'from-severity-medical/40'
      : severity === 'high'
        ? 'from-severity-evacuation/40'
        : severity === 'medium'
          ? 'from-severity-food/40'
          : 'from-sankalp-500/40';

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Top-edge gradient flash */}
          <motion.div
            key="flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              'pointer-events-none fixed inset-x-0 top-0 z-50 h-44 bg-gradient-to-b to-transparent',
              tint,
            )}
          />
          {/* Pill banner */}
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -32, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed left-1/2 top-6 z-50 -translate-x-1/2"
          >
            <div className="glass-strong flex items-center gap-2.5 rounded-full px-4 py-2.5 ring-1 ring-sankalp-500/30 shadow-glow-brand">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sankalp-500/60" />
                <Bell className="relative h-3.5 w-3.5 text-sankalp-300" strokeWidth={2.4} />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sankalp-300">
                  New mission
                </span>
                <span className="text-xs font-medium text-white">
                  Tap below to review and accept
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
