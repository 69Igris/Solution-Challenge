'use client';

/**
 * SANKALP — Alert Detail panel
 *
 * Right-side drawer-style panel for the selected SOS. Reveals:
 *   - Full AI parse (summary in citizen language + English, accessibility notes)
 *   - Identified needs as chips
 *   - Vulnerability flags
 *   - Matched volunteer with the "Why you were matched" line
 *   - Coordinator action buttons — Re-route triggers a force re-match;
 *     Mark resolved closes the mission and frees the volunteer.
 */

import { useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  Activity,
  HeartPulse,
  Languages,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDb } from '@/lib/firebase';
import type { ActiveAlert, VolunteerRow } from '@/lib/firestore-hooks';
import type { SeverityLevel } from '@/types';

const SEVERITY_TINT: Record<SeverityLevel, { bg: string; text: string; ring: string; label: string }> = {
  critical:  { bg: 'bg-severity-medical/15',    text: 'text-severity-medical',    ring: 'ring-severity-medical/30',    label: 'CRITICAL' },
  high:      { bg: 'bg-severity-evacuation/15', text: 'text-severity-evacuation', ring: 'ring-severity-evacuation/30', label: 'HIGH' },
  medium:    { bg: 'bg-severity-food/15',       text: 'text-severity-food',       ring: 'ring-severity-food/30',       label: 'MEDIUM' },
  low:       { bg: 'bg-severity-shelter/15',    text: 'text-severity-shelter',    ring: 'ring-severity-shelter/30',    label: 'LOW' },
};

export function AlertDetail({
  alert,
  volunteer,
  onClose,
}: {
  alert: ActiveAlert | null;
  volunteer: VolunteerRow | null;
  onClose: () => void;
}) {
  if (!alert) {
    return (
      <div className="glass-strong flex h-full flex-col items-center justify-center gap-2 p-10 text-center">
        <Activity className="h-8 w-8 text-white/25" strokeWidth={1.4} />
        <div className="text-sm font-medium text-white/70">Select an alert</div>
        <div className="max-w-xs text-[11px] leading-snug text-white/40">
          Click a pulse on the map or any row in the feed to inspect the AI parse and matched volunteer.
        </div>
      </div>
    );
  }

  const sev = alert.parsed?.severity ?? 'medium';
  const tint = SEVERITY_TINT[sev];
  const flags = alert.parsed?.vulnerabilityFlags;
  const activeFlags: Array<[string, string]> = [];
  if (flags) {
    if (flags.elderly) activeFlags.push(['elderly', 'Elderly']);
    if (flags.child) activeFlags.push(['child', 'Child']);
    if (flags.pregnant) activeFlags.push(['pregnant', 'Pregnant']);
    if (flags.disabled) activeFlags.push(['disabled', 'Disabled']);
    if (flags.injured) activeFlags.push(['injured', 'Injured']);
  }

  return (
    <motion.div
      key={alert.alertId}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn('glass-strong flex h-full flex-col overflow-hidden ring-1', tint.ring)}
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.06] p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-[0.18em]',
                tint.bg,
                tint.text,
              )}
            >
              <Activity className="h-3 w-3" strokeWidth={2.4} />
              {tint.label} · {alert.parsed?.severityScore ?? 0}/100
            </span>
            <span className="font-mono text-[10px] text-white/40">
              #{alert.alertId.slice(0, 8)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-white/55">
            {alert.cityDistrict && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {alert.cityDistrict}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Languages className="h-3 w-3" /> {alert.inputLanguage}
            </span>
            {alert.parsed?.confidence != null && (
              <span>
                AI confidence {(alert.parsed.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition hover:bg-white/[0.06] hover:text-white"
          aria-label="Close detail"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Summary */}
        <p className="text-[13px] leading-relaxed text-white/90">
          {alert.parsed?.summary ?? '(awaiting AI parse…)'}
        </p>
        {alert.parsed?.summaryLocalized &&
          alert.parsed.summaryLocalized !== alert.parsed.summary && (
            <p className="mt-2 text-[11px] italic leading-relaxed text-white/45">
              {alert.parsed.summaryLocalized}
            </p>
          )}

        {alert.parsed?.accessibilityNotes && (
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] italic leading-relaxed text-white/60">
            {alert.parsed.accessibilityNotes}
          </div>
        )}

        {/* Need + flag chips */}
        <div className="mt-4 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Identified needs
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(alert.parsed?.needTypes ?? []).map((n) => (
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
                <HeartPulse className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Match info */}
        {alert.matchedVolunteerUid ? (
          <div className="mt-5 space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              Matched volunteer
            </div>
            <div className="glass flex items-center gap-3 p-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sankalp-500 to-sankalp-700 text-xs font-semibold text-white">
                {volunteer?.displayName
                  ? volunteer.displayName
                      .split(' ')
                      .map((s) => s[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">
                  {volunteer?.displayName ?? 'Volunteer'}
                </div>
                <div className="text-[11px] text-white/50">
                  {Array.isArray(volunteer?.skills) && volunteer.skills.length > 0
                    ? volunteer.skills.slice(0, 3).map(humanizeSkill).join(' · ')
                    : 'Verified responder'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-widest text-white/30">
                  match
                </div>
                <div className="font-mono text-sm font-semibold text-white/85">
                  {alert.matchScore != null ? Math.round(alert.matchScore * 100) : '—'}
                </div>
              </div>
            </div>

            {alert.matchReason && (
              <div className="flex items-start gap-2 rounded-md border border-sankalp-500/20 bg-sankalp-500/[0.06] px-3 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sankalp-300" strokeWidth={2.2} />
                <div className="flex-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sankalp-300">
                    Why this volunteer
                  </div>
                  <div className="mt-0.5 text-[12px] leading-relaxed text-white/85">
                    {alert.matchReason}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          alert.status === 'parsed' && (
            <div className="mt-5 rounded-md border border-severity-food/20 bg-severity-food/[0.06] p-3 text-[12px] leading-relaxed text-severity-food/90">
              No volunteer matched yet — escalate to NGO desk or widen radius.
            </div>
          )
        )}
      </div>

      {/* Footer actions — Re-route + Mark resolved */}
      <CoordinatorActions alert={alert} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// CoordinatorActions — wired to /api/match (force) + /api/missions PATCH
// ---------------------------------------------------------------------------
function CoordinatorActions({ alert }: { alert: ActiveAlert }) {
  const [busy, setBusy] = useState<null | 'reroute' | 'resolve'>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | 'reroute' | 'resolve'>(null);

  const canReroute =
    alert.status === 'matched' || alert.status === 'in_progress' || alert.status === 'parsed';
  const canResolve =
    alert.status === 'matched' || alert.status === 'in_progress';

  const reroute = async () => {
    setBusy('reroute');
    setError(null);
    try {
      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId: alert.alertId, force: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      setDone('reroute');
      window.setTimeout(() => setDone(null), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Re-route failed');
    } finally {
      setBusy(null);
    }
  };

  const resolve = async () => {
    setBusy('resolve');
    setError(null);
    try {
      // Find the active mission for this alert
      const q = query(
        collection(getDb(), 'missions'),
        where('alertId', '==', alert.alertId),
        where('status', 'in', ['assigned', 'en_route', 'on_site']),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        throw new Error('No active mission to resolve');
      }
      const mission = snap.docs[0];
      const volunteerUid = (mission.data() as { volunteerUid?: string }).volunteerUid ?? '';

      const res = await fetch(`/api/missions/${mission.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          // Demo-mode bypass — coordinator acting on behalf of the volunteer
          'x-demo-uid': volunteerUid || 'demo-coordinator-001',
        },
        body: JSON.stringify({ status: 'completed' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      setDone('resolve');
      window.setTimeout(() => setDone(null), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not mark resolved');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="border-t border-white/[0.06] p-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={reroute}
          disabled={!canReroute || busy != null}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium text-white/75 transition',
            'hover:border-white/20 hover:bg-white/[0.06] hover:text-white',
            (!canReroute || busy != null) && 'opacity-60',
          )}
        >
          {busy === 'reroute' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : done === 'reroute' ? (
            <span className="text-severity-resolved">Re-routed ✓</span>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" /> Re-route
            </>
          )}
        </button>
        <button
          onClick={resolve}
          disabled={!canResolve || busy != null}
          className={cn(
            'rounded-md bg-severity-resolved/20 px-3 py-2 text-xs font-semibold text-severity-resolved transition',
            'hover:bg-severity-resolved/30',
            (!canResolve || busy != null) && 'opacity-60',
          )}
        >
          {busy === 'resolve' ? (
            <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
          ) : done === 'resolve' ? (
            'Resolved ✓'
          ) : (
            'Mark resolved'
          )}
        </button>
      </div>
      {error && (
        <div className="mt-2 rounded-md border border-severity-medical/30 bg-severity-medical/[0.08] px-2 py-1.5 text-[10.5px] text-severity-medical">
          {error}
        </div>
      )}
    </div>
  );
}

function humanizeSkill(s: string): string {
  return ({
    first_aid: 'First Aid',
    cpr_certified: 'CPR',
    medical_professional: 'Medical pro',
    driver: 'Driver',
    heavy_lifter: 'Lifter',
    cook: 'Cook',
    swimmer: 'Swimmer',
    translator: 'Translator',
    electrician: 'Electrician',
    plumber: 'Plumber',
  } as Record<string, string>)[s] ?? s;
}
