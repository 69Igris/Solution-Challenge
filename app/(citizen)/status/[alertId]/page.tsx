'use client';

/**
 * SANKALP — Citizen Live Status
 *
 * After a citizen fires an SOS, this is where they live for the next minutes.
 * Subscribes to their alert doc + matched volunteer profile and renders a
 * vertical timeline of the lifecycle.
 *
 * The /sos page links here automatically on success (Sprint 4 wiring), but
 * /status/[alertId] is also reachable directly so the citizen can re-open
 * after closing the app.
 */

import { use, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowLeft,
  Check,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useEnsureAuth } from '@/lib/auth-hooks';
import { useAlert, useVolunteer } from '@/lib/firestore-hooks';
import { cn, timeAgo } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

const SEVERITY_TINT: Record<SeverityLevel, { bg: string; text: string; ring: string; label: string }> = {
  critical:  { bg: 'bg-severity-medical/15',    text: 'text-severity-medical',    ring: 'ring-severity-medical/30',    label: 'CRITICAL' },
  high:      { bg: 'bg-severity-evacuation/15', text: 'text-severity-evacuation', ring: 'ring-severity-evacuation/30', label: 'HIGH' },
  medium:    { bg: 'bg-severity-food/15',       text: 'text-severity-food',       ring: 'ring-severity-food/30',       label: 'MEDIUM' },
  low:       { bg: 'bg-severity-shelter/15',    text: 'text-severity-shelter',    ring: 'ring-severity-shelter/30',    label: 'LOW' },
};

// Next 15 type — params is a Promise that has to be unwrapped with `use()`
type Params = Promise<{ alertId: string }>;

export default function CitizenStatusPage({ params }: { params: Params }) {
  const { alertId } = use(params);
  const auth = useEnsureAuth();
  const { alert, loading } = useAlert(alertId);
  const canViewVolunteer = !!alert && auth.user?.uid === alert.citizenUid;
  const { volunteer } = useVolunteer(canViewVolunteer ? alert.matchedVolunteerUid ?? null : null);

  const timeline = useMemo(() => buildTimeline(alert), [alert]);

  if (auth.loading || loading) {
    return (
      <main className="grid flex-1 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-sankalp-400" />
      </main>
    );
  }

  if (!alert) {
    return (
      <main className="grid flex-1 place-items-center px-5">
        <div className="glass-strong max-w-md p-5 text-center">
          <div className="text-sm font-medium text-white">Alert not found</div>
          <p className="mt-1 text-[11px] text-white/55">
            It may have been deleted or your account doesn&apos;t have read access.
          </p>
          <Link
            href="/sos"
            className="mt-3 inline-flex items-center gap-1 text-[11px] text-sankalp-300 underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Back to SOS
          </Link>
        </div>
      </main>
    );
  }

  if (auth.user && alert.citizenUid !== auth.user.uid) {
    return <AccessDenied />;
  }

  const sev = alert.parsed?.severity ?? 'medium';
  const tint = SEVERITY_TINT[sev];
  const flags = alert.parsed?.vulnerabilityFlags;
  const flagPills: Array<[string, string]> = [];
  if (flags) {
    if (flags.elderly) flagPills.push(['elderly', 'Elderly']);
    if (flags.child) flagPills.push(['child', 'Child']);
    if (flags.pregnant) flagPills.push(['pregnant', 'Pregnant']);
    if (flags.disabled) flagPills.push(['disabled', 'Disabled']);
    if (flags.injured) flagPills.push(['injured', 'Injured']);
  }

  return (
    <main className="relative flex flex-1 flex-col px-5 safe-top safe-bottom">
      {/* Header */}
      <header className="relative z-10 flex items-center justify-between pt-2">
        <Link
          href="/sos"
          className="glass flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-white/75 transition hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          New SOS
        </Link>
        <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">
          #{alertId.slice(0, 8)}
        </div>
      </header>

      {/* Hero status */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 mt-5"
      >
        <div className={cn('glass-strong relative overflow-hidden p-4 ring-1', tint.ring)}>
          <div className="flex items-center justify-between">
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]',
                tint.bg,
                tint.text,
              )}
            >
              <Activity className="h-3 w-3" strokeWidth={2.4} />
              {tint.label} · {alert.parsed?.severityScore ?? 0}/100
            </div>
            <StatusPill status={alert.status} />
          </div>

          <p className="mt-3 text-[14px] leading-relaxed text-white">
            {alert.parsed?.summaryLocalized || alert.parsed?.summary || 'Awaiting AI parse…'}
          </p>

          {alert.parsed?.accessibilityNotes && (
            <p className="mt-2 text-[11px] italic leading-snug text-white/55">
              {alert.parsed.accessibilityNotes}
            </p>
          )}

          {(alert.parsed?.needTypes || flagPills.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(alert.parsed?.needTypes ?? []).map((n) => (
                <span
                  key={n}
                  className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-white/80"
                >
                  {n}
                </span>
              ))}
              {flagPills.map(([k, l]) => (
                <span
                  key={k}
                  className="flex items-center gap-1 rounded-md border border-severity-evacuation/30 bg-severity-evacuation/10 px-2 py-1 text-[11px] text-severity-evacuation"
                >
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* Volunteer card */}
      {alert.matchedVolunteerUid && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative z-10 mt-3"
        >
          <div className="glass-strong relative overflow-hidden p-4">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-severity-resolved/15 blur-2xl"
            />
            <div className="relative flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sankalp-500 to-sankalp-700 text-sm font-semibold text-white shadow-glow-brand">
                {(volunteer?.displayName ?? 'NA')
                  .split(' ')
                  .map((s) => s[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || <User className="h-5 w-5" />}
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-severity-resolved">
                  Help is on the way
                </div>
                <div className="text-sm font-medium text-white">
                  {volunteer?.displayName ?? 'Volunteer'}
                </div>
                <div className="text-[11px] text-white/55">
                  {Array.isArray(volunteer?.skills) && volunteer.skills.length > 0
                    ? volunteer.skills.slice(0, 3).join(' · ')
                    : 'Verified responder'}
                </div>
              </div>
              <button
                disabled
                className="grid h-9 w-9 place-items-center rounded-full bg-severity-resolved/15 text-severity-resolved disabled:opacity-60"
                aria-label="Call volunteer"
              >
                <Phone className="h-4 w-4" />
              </button>
            </div>
            {alert.matchReason && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-sankalp-500/20 bg-sankalp-500/[0.06] px-3 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sankalp-300" strokeWidth={2.2} />
                <div className="flex-1 text-[11.5px] leading-relaxed text-white/80">
                  {alert.matchReason}
                </div>
              </div>
            )}
          </div>
        </motion.section>
      )}

      {/* Timeline */}
      <section className="relative z-10 mt-4 flex-1">
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Live timeline
        </div>
        <ol className="relative ml-3 space-y-3 border-l border-white/10 pl-4">
          {timeline.map((step, i) => (
            <li key={i} className="relative">
              <span
                className={cn(
                  'absolute -left-[21px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full',
                  step.done
                    ? 'bg-severity-resolved text-white'
                    : step.current
                      ? 'bg-sankalp-500 text-white animate-pulse'
                      : 'bg-white/15 text-white/45',
                )}
              >
                {step.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              </span>
              <div
                className={cn(
                  'text-[12.5px]',
                  step.done ? 'text-white/85' : step.current ? 'text-white' : 'text-white/40',
                )}
              >
                {step.label}
              </div>
              {step.timestamp && (
                <div className="text-[10px] text-white/40">{timeAgo(step.timestamp)}</div>
              )}
            </li>
          ))}
        </ol>
      </section>

      <footer className="relative z-10 mt-4 flex items-center justify-center gap-2 pb-4 text-[11px] text-white/40">
        <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.6} />
        <span>Updates every second · Encrypted in transit</span>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
type TimelineStep = { label: string; done: boolean; current: boolean; timestamp: number | null };

function buildTimeline(alert: ReturnType<typeof useAlert>['alert']): TimelineStep[] {
  if (!alert) return [];

  const status = alert.status;
  const order: Record<string, number> = {
    pending: 0, parsed: 1, matched: 2, in_progress: 3, resolved: 4,
    flagged: 1, cancelled: 4,
  };
  const cur = order[status] ?? 0;

  const steps: TimelineStep[] = [
    { label: 'SOS sent', done: cur >= 1 || status === 'pending', current: status === 'pending', timestamp: alert.createdAt },
    { label: 'AI parse complete', done: cur >= 2, current: status === 'parsed' || status === 'flagged', timestamp: alert.parsedAt },
    {
      label: alert.matchedVolunteerUid ? 'Volunteer matched' : 'Searching for volunteer',
      done: cur >= 3,
      current: status === 'matched',
      timestamp: alert.matchedAt,
    },
    { label: 'Volunteer on-site', done: cur >= 4, current: status === 'in_progress', timestamp: alert.arrivedAt },
    { label: 'Resolved', done: status === 'resolved', current: false, timestamp: alert.resolvedAt },
  ];
  return steps;
}

function AccessDenied() {
  return (
    <main className="grid flex-1 place-items-center px-5">
      <div className="glass-strong max-w-md p-5 text-center">
        <div className="text-sm font-medium text-white">Access denied</div>
        <p className="mt-1 text-[11px] text-white/55">
          You can only view alerts created from your signed-in account.
        </p>
        <Link
          href="/sos"
          className="mt-3 inline-flex items-center gap-1 text-[11px] text-sankalp-300 underline-offset-2 hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to SOS
        </Link>
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pending:     { label: 'Sending',         classes: 'bg-white/[0.05] text-white/65' },
    parsed:      { label: 'Searching',       classes: 'bg-severity-food/15 text-severity-food' },
    matched:     { label: 'Volunteer en route', classes: 'bg-sankalp-500/15 text-sankalp-300' },
    in_progress: { label: 'On-site',         classes: 'bg-severity-evacuation/15 text-severity-evacuation' },
    resolved:    { label: 'Resolved',        classes: 'bg-severity-resolved/15 text-severity-resolved' },
    flagged:     { label: 'Under review',    classes: 'bg-severity-medical/15 text-severity-medical' },
    cancelled:   { label: 'Cancelled',       classes: 'bg-white/[0.05] text-white/55' },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em]', m.classes)}>
      {m.label}
    </span>
  );
}
