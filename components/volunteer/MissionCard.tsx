'use client';

/**
 * SANKALP — Active Mission Card
 *
 * The volunteer's hero screen when they have an assignment. Stage progression
 * is presented as a single primary action button that changes label as the
 * mission moves through assigned → en_route → on_site → completed.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  Check,
  HeartPulse,
  Loader2,
  MapPin,
  Navigation,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveAlert, MissionRow } from '@/lib/firestore-hooks';
import type { SeverityLevel } from '@/types';

const SEVERITY_TINT: Record<
  SeverityLevel,
  { bg: string; text: string; ring: string; gradient: string; label: string }
> = {
  critical: {
    bg: 'bg-severity-medical/15',
    text: 'text-severity-medical',
    ring: 'ring-severity-medical/30',
    gradient: 'from-severity-medical/20 via-severity-medical/5 to-transparent',
    label: 'CRITICAL',
  },
  high: {
    bg: 'bg-severity-evacuation/15',
    text: 'text-severity-evacuation',
    ring: 'ring-severity-evacuation/30',
    gradient: 'from-severity-evacuation/20 via-severity-evacuation/5 to-transparent',
    label: 'HIGH',
  },
  medium: {
    bg: 'bg-severity-food/15',
    text: 'text-severity-food',
    ring: 'ring-severity-food/30',
    gradient: 'from-severity-food/20 via-severity-food/5 to-transparent',
    label: 'MEDIUM',
  },
  low: {
    bg: 'bg-severity-shelter/15',
    text: 'text-severity-shelter',
    ring: 'ring-severity-shelter/30',
    gradient: 'from-severity-shelter/20 via-severity-shelter/5 to-transparent',
    label: 'LOW',
  },
};

const STAGE_LABEL: Record<
  MissionRow['status'],
  { primary: string; primaryNext: string; sub: string; toneAccept: 'red' | 'amber' | 'green' }
> = {
  assigned:  { primary: 'Accept mission',     primaryNext: 'en_route',  sub: 'You can decline if not available.', toneAccept: 'red' },
  en_route:  { primary: "I've arrived",       primaryNext: 'on_site',   sub: 'Drive safe. We are tracking your ETA.', toneAccept: 'amber' },
  on_site:   { primary: 'Mark completed',     primaryNext: 'completed', sub: 'Tap once help is fully delivered.', toneAccept: 'green' },
  completed: { primary: 'Mission completed',  primaryNext: 'completed', sub: 'Thank you for your time and care.', toneAccept: 'green' },
  aborted:   { primary: 'Mission cancelled',  primaryNext: 'aborted',   sub: 'You may receive a new match shortly.', toneAccept: 'red' },
};

export function MissionCard({
  mission,
  alert,
  onTransition,
}: {
  mission: MissionRow;
  alert: ActiveAlert | null;
  onTransition: (next: 'en_route' | 'on_site' | 'completed' | 'aborted') => Promise<void>;
}) {
  const [busy, setBusy] = useState<null | 'primary' | 'cancel'>(null);
  const [error, setError] = useState<string | null>(null);

  const sev = alert?.parsed?.severity ?? 'medium';
  const tint = SEVERITY_TINT[sev];
  const stage = STAGE_LABEL[mission.status];

  const flags = alert?.parsed?.vulnerabilityFlags;
  const flagPills: Array<[string, string]> = [];
  if (flags) {
    if (flags.elderly) flagPills.push(['elderly', 'Elderly']);
    if (flags.child) flagPills.push(['child', 'Child']);
    if (flags.pregnant) flagPills.push(['pregnant', 'Pregnant']);
    if (flags.disabled) flagPills.push(['disabled', 'Disabled']);
    if (flags.injured) flagPills.push(['injured', 'Injured']);
  }

  const distanceKm = (mission.distanceMeters ?? 0) / 1000;
  const etaMin = Math.round((mission.estimatedDurationSeconds ?? 0) / 60);

  const handlePrimary = async () => {
    if (mission.status === 'completed' || mission.status === 'aborted') return;
    setError(null);
    setBusy('primary');
    try {
      await onTransition(stage.primaryNext as 'en_route' | 'on_site' | 'completed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update mission');
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    if (mission.status === 'completed' || mission.status === 'aborted') return;
    setError(null);
    setBusy('cancel');
    try {
      await onTransition('aborted');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not cancel mission');
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      key={mission.missionId}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn('glass-strong relative overflow-hidden ring-1', tint.ring)}
    >
      {/* Severity gradient hero */}
      <div
        aria-hidden
        className={cn('pointer-events-none absolute inset-0 bg-gradient-to-b', tint.gradient)}
      />

      <div className="relative p-4">
        {/* Stage indicator */}
        <StageDots status={mission.status} />

        {/* Severity + ID */}
        <div className="mt-4 flex items-center justify-between">
          <div className={cn('flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]', tint.bg, tint.text)}>
            <Activity className="h-3 w-3" strokeWidth={2.4} />
            {tint.label} · {alert?.parsed?.severityScore ?? 0}/100
          </div>
          <div className="font-mono text-[10px] text-white/35">
            #{mission.alertId?.slice(0, 8) ?? ''}
          </div>
        </div>

        {/* Summary */}
        <p className="mt-3 text-[14px] leading-relaxed text-white">
          {alert?.parsed?.summary ?? '(loading alert details…)'}
        </p>

        {alert?.parsed?.accessibilityNotes && (
          <p className="mt-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] italic leading-relaxed text-white/60">
            {alert.parsed.accessibilityNotes}
          </p>
        )}

        {/* Distance + ETA */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-white/40">distance</div>
            <div className="font-mono text-sm font-semibold text-white">
              {distanceKm < 1 ? `${(distanceKm * 1000).toFixed(0)} m` : `${distanceKm.toFixed(1)} km`}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-white/40">ETA</div>
            <div className="font-mono text-sm font-semibold text-white">{etaMin} min</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-widest text-white/40">people</div>
            <div className="font-mono text-sm font-semibold text-white">
              {alert?.parsed?.headcount ?? 1}
            </div>
          </div>
        </div>

        {/* Need types + vulnerability flags */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(alert?.parsed?.needTypes ?? []).map((n) => (
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
              <HeartPulse className="h-3 w-3" />
              {l}
            </span>
          ))}
        </div>

        {/* Why you were matched */}
        {alert?.matchReason && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-sankalp-500/20 bg-sankalp-500/[0.06] px-3 py-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sankalp-300" strokeWidth={2.2} />
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sankalp-300">
                Why you were matched
              </div>
              <div className="mt-0.5 text-[12px] leading-relaxed text-white/85">
                {alert.matchReason}
              </div>
            </div>
          </div>
        )}

        {/* Sub-text */}
        <p className="mt-4 text-center text-[11px] text-white/45">{stage.sub}</p>

        {/* Error */}
        {error && (
          <div className="mt-2 rounded-md border border-severity-medical/30 bg-severity-medical/[0.08] px-3 py-2 text-[11px] text-severity-medical">
            {error}
          </div>
        )}

        {/* Primary action */}
        <button
          onClick={handlePrimary}
          disabled={busy != null || mission.status === 'completed' || mission.status === 'aborted'}
          className={cn(
            'mt-3 grid w-full place-items-center rounded-xl px-4 py-3.5 text-sm font-semibold tracking-wide transition-all',
            stage.toneAccept === 'red' &&
              'bg-gradient-to-br from-severity-medical to-[#C81E4A] text-white shadow-glow-sos hover:brightness-110',
            stage.toneAccept === 'amber' &&
              'bg-gradient-to-br from-severity-food to-[#B45309] text-white shadow-[0_0_60px_rgba(245,158,11,0.35)] hover:brightness-110',
            stage.toneAccept === 'green' &&
              'bg-gradient-to-br from-severity-resolved to-emerald-700 text-white shadow-[0_0_60px_rgba(16,185,129,0.35)] hover:brightness-110',
            (busy != null || mission.status === 'completed' || mission.status === 'aborted') &&
              'opacity-70',
          )}
        >
          {busy === 'primary' ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mission.status === 'completed' ? (
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4" /> {stage.primary}
            </span>
          ) : mission.status === 'aborted' ? (
            <span className="flex items-center gap-2">
              <X className="h-4 w-4" /> {stage.primary}
            </span>
          ) : (
            <span className="flex items-center gap-2 uppercase tracking-[0.15em]">
              {stage.primary}
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>

        {/* Cancel — only when active and not completed */}
        {mission.status !== 'completed' && mission.status !== 'aborted' && (
          <button
            onClick={handleCancel}
            disabled={busy != null}
            className="mt-2 w-full text-center text-[11px] uppercase tracking-widest text-white/35 underline-offset-4 transition hover:text-white/65 hover:underline"
          >
            {busy === 'cancel' ? 'Cancelling…' : mission.status === 'assigned' ? 'Decline' : 'Cancel mission'}
          </button>
        )}

        {/* Pin marker */}
        {alert?.cityDistrict && (
          <div className="mt-3 flex items-center justify-center gap-1 text-[10px] text-white/35">
            <MapPin className="h-3 w-3" />
            {alert.cityDistrict}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stage progression dots
// ---------------------------------------------------------------------------
function StageDots({ status }: { status: MissionRow['status'] }) {
  const stages: Array<{ key: MissionRow['status']; label: string }> = [
    { key: 'assigned',  label: 'Accept' },
    { key: 'en_route',  label: 'En route' },
    { key: 'on_site',   label: 'On-site' },
    { key: 'completed', label: 'Done' },
  ];
  const order: Record<MissionRow['status'], number> = {
    assigned: 0, en_route: 1, on_site: 2, completed: 3, aborted: -1,
  };
  const idx = order[status];

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => {
        const reached = idx >= i;
        const current = idx === i;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-1.5">
            <div className="flex flex-1 flex-col items-center">
              <div
                className={cn(
                  'h-2 w-2 rounded-full transition-all duration-300',
                  reached ? 'bg-severity-resolved' : 'bg-white/15',
                  current && 'scale-150 shadow-[0_0_12px_rgba(16,185,129,0.6)]',
                )}
              />
              <div
                className={cn(
                  'mt-1 text-[8.5px] uppercase tracking-widest',
                  reached ? 'text-white/65' : 'text-white/25',
                )}
              >
                {s.label}
              </div>
            </div>
            {i < stages.length - 1 && (
              <div
                className={cn(
                  '-mt-3 h-px flex-1 transition-colors',
                  reached && idx > i ? 'bg-severity-resolved/60' : 'bg-white/10',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
