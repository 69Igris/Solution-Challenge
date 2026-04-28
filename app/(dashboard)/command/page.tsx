'use client';

/**
 * SANKALP — Coordinator Command Center
 *
 * The single most important screen for the demo video's hero shot.
 * Bloomberg-terminal-grade live ops canvas:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ HEADER · brand · LIVE pill · session clock · KPIs        │
 *   ├──────────────────────────┬──────────────────────────────┤
 *   │                          │  ACTIVE ALERTS FEED          │
 *   │     PULSE MAP            │  (sorted, severity-colored)  │
 *   │     (Bengaluru, dark)    │                              │
 *   │     · severity pulses    │                              │
 *   │     · volunteer dots     │                              │
 *   │                          ├──────────────────────────────┤
 *   │                          │  SELECTED ALERT DETAIL       │
 *   │                          │  · AI parse                  │
 *   │                          │  · matched volunteer         │
 *   │                          │  · "Why you were matched"    │
 *   └──────────────────────────┴──────────────────────────────┘
 *
 * Data sources — all live, all real-time:
 *   - sos_alerts → useActiveAlerts() (onSnapshot)
 *   - users(role=volunteer) → useVolunteers() (onSnapshot)
 *   - KPIs → derived in memory from the two streams
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldAlert } from 'lucide-react';
import {
  useActiveAlerts,
  useDashboardKpis,
  useVolunteers,
} from '@/lib/firestore-hooks';
import { useEnsureAuth } from '@/lib/auth-hooks';
import { PulseMap } from '@/components/dashboard/PulseMap';
import { KpiBar } from '@/components/dashboard/KpiBar';
import { AlertsFeed } from '@/components/dashboard/AlertsFeed';
import { AlertDetail } from '@/components/dashboard/AlertDetail';

export default function CommandCenterPage() {
  // === ALL HOOKS — must run unconditionally, in the same order, every render. ===
  // Ensure we have an auth session (anonymous if not logged in).
  // Firestore rules require request.auth != null to read sos_alerts.
  const auth = useEnsureAuth();

  const { alerts, loading: alertsLoading, error: alertsError } = useActiveAlerts();
  const { volunteers } = useVolunteers();
  const kpis = useDashboardKpis(alerts, volunteers);

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const selectedAlert = useMemo(
    () => alerts.find((a) => a.alertId === selectedAlertId) ?? null,
    [alerts, selectedAlertId],
  );
  const matchedVolunteer = useMemo(() => {
    if (!selectedAlert?.matchedVolunteerUid) return null;
    return (
      volunteers.find((v) => v.uid === selectedAlert.matchedVolunteerUid) ?? null
    );
  }, [selectedAlert, volunteers]);

  // === Auth bootstrap branches — early returns must come AFTER all hooks ===
  if (auth.loading) return <AuthLoadingSplash />;
  if (auth.error) return <AuthErrorSplash message={auth.error.message} />;

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden">
      {/* Header */}
      <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-midnight-900/70 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-sankalp-500 to-sankalp-700 shadow-glow-brand">
            <span className="text-[10px] font-bold tracking-widest">सं</span>
          </div>
          <div className="flex flex-col">
            <div className="text-sm font-medium leading-tight tracking-wide text-white/90">
              SANKALP · Command Center
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Bengaluru sector · sankalp-prod
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SessionClock />
          <div className="flex items-center gap-1.5 rounded-md border border-severity-resolved/30 bg-severity-resolved/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-severity-resolved">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-resolved opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-severity-resolved" />
            </span>
            Live
          </div>
        </div>
      </header>

      {/* Body grid */}
      <div className="relative z-0 grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        {/* LEFT — KPI bar stacked above the map */}
        <div className="flex min-h-0 flex-col gap-3">
          <KpiBar kpis={kpis} loading={alertsLoading} />
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass-strong relative min-h-0 flex-1 overflow-hidden"
          >
            <PulseMap
              alerts={alerts}
              volunteers={volunteers}
              selectedAlertId={selectedAlertId}
              onSelectAlert={setSelectedAlertId}
            />
          </motion.div>
        </div>

        {/* RIGHT — feed (top, scrolls) + detail (bottom, fixed) */}
        <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(280px,46%)] gap-3">
          <div className="min-h-0 overflow-y-auto pr-0.5">
            {alertsError ? (
              <div className="glass-strong p-4 text-[12px] text-severity-medical">
                Could not subscribe: {alertsError.message}
              </div>
            ) : (
              <AlertsFeed
                alerts={alerts}
                selectedAlertId={selectedAlertId}
                onSelectAlert={setSelectedAlertId}
                loading={alertsLoading}
              />
            )}
          </div>

          <div className="min-h-0">
            <AlertDetail
              alert={selectedAlert}
              volunteer={matchedVolunteer}
              onClose={() => setSelectedAlertId(null)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// SessionClock — small live wall-clock for the command-center vibe
// ---------------------------------------------------------------------------
function SessionClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date()); // hydrate after mount to avoid SSR mismatch
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return (
      <div
        aria-hidden
        className="hidden font-mono text-[11px] uppercase tracking-widest text-white/45 sm:block"
      >
        --:--:-- IST
      </div>
    );
  }

  return (
    <div className="hidden font-mono text-[11px] uppercase tracking-widest text-white/45 sm:block">
      {now.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })} IST
    </div>
  );
}

// ---------------------------------------------------------------------------
// Auth bootstrap UI
// ---------------------------------------------------------------------------
function AuthLoadingSplash() {
  return (
    <main className="grid h-dvh place-items-center bg-midnight-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-sankalp-400" strokeWidth={1.6} />
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Securing session…
        </div>
      </div>
    </main>
  );
}

function AuthErrorSplash({ message }: { message: string }) {
  const looksLikeAnonDisabled =
    /admin-restricted-operation|operation-not-allowed|anonymous/i.test(message);

  return (
    <main className="grid h-dvh place-items-center bg-midnight-950 px-6">
      <div className="glass-strong max-w-md p-6 ring-1 ring-severity-medical/30">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-severity-medical/15">
            <ShieldAlert className="h-4 w-4 text-severity-medical" strokeWidth={2.2} />
          </div>
          <div>
            <div className="text-sm font-medium text-white">
              Could not start a secure session
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-white/65">
              {looksLikeAnonDisabled ? (
                <>
                  Anonymous Authentication is not yet enabled on this Firebase
                  project. Open{' '}
                  <a
                    href="https://console.firebase.google.com/project/sankalp-prod/authentication/providers"
                    target="_blank"
                    rel="noreferrer"
                    className="text-sankalp-300 underline-offset-2 hover:underline"
                  >
                    Authentication → Sign-in method
                  </a>
                  , scroll to <strong>Anonymous</strong>, click{' '}
                  <strong>Enable</strong>, save, then refresh this page.
                </>
              ) : (
                message
              )}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
