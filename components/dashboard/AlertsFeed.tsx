'use client';

/**
 * SANKALP — Active Alerts Feed
 *
 * Live-sorted SOS list. Severity-first, then recency. Each row is a glass
 * card with the AI summary, severity pill, vulnerability flags, and
 * matched-volunteer footer when present.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Clock, MapPin, ShieldAlert, Users } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import type { ActiveAlert } from '@/lib/firestore-hooks';
import type { SeverityLevel } from '@/types';

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string; ring: string }> = {
  critical:  { bg: 'bg-severity-medical/15',    text: 'text-severity-medical',    ring: 'ring-severity-medical/40' },
  high:      { bg: 'bg-severity-evacuation/15', text: 'text-severity-evacuation', ring: 'ring-severity-evacuation/40' },
  medium:    { bg: 'bg-severity-food/15',       text: 'text-severity-food',       ring: 'ring-severity-food/40' },
  low:       { bg: 'bg-severity-shelter/15',    text: 'text-severity-shelter',    ring: 'ring-severity-shelter/40' },
};

export function AlertsFeed({
  alerts,
  selectedAlertId,
  onSelectAlert,
  loading,
}: {
  alerts: ActiveAlert[];
  selectedAlertId: string | null;
  onSelectAlert: (id: string | null) => void;
  loading?: boolean;
}) {
  // Severity-first ranking. Then recency.
  const sorted = [...alerts].sort((a, b) => {
    const sa = a.parsed?.severityScore ?? 0;
    const sb = b.parsed?.severityScore ?? 0;
    if (sa !== sb) return sb - sa;
    return b.createdAt - a.createdAt;
  });

  if (loading && sorted.length === 0) {
    return <FeedSkeleton />;
  }

  if (sorted.length === 0) {
    return (
      <div className="glass-strong flex flex-col items-center justify-center gap-2 p-10 text-center">
        <CheckCircle2 className="h-8 w-8 text-severity-resolved/70" strokeWidth={1.5} />
        <div className="text-sm font-medium text-white">All clear</div>
        <div className="max-w-xs text-[11px] leading-snug text-white/45">
          No active SOS in your sector right now. The next pulse will appear here in real time.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Active alerts · {sorted.length}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-severity-resolved">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-severity-resolved opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-severity-resolved" />
          </span>
          live
        </div>
      </div>

      <AnimatePresence initial={false}>
        {sorted.map((a) => (
          <AlertRow
            key={a.alertId}
            alert={a}
            selected={a.alertId === selectedAlertId}
            onClick={() => onSelectAlert(a.alertId === selectedAlertId ? null : a.alertId)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function AlertRow({
  alert,
  selected,
  onClick,
}: {
  alert: ActiveAlert;
  selected: boolean;
  onClick: () => void;
}) {
  const sev = alert.parsed?.severity ?? 'medium';
  const colors = SEVERITY_COLORS[sev] ?? SEVERITY_COLORS.medium;
  const flags = alert.parsed?.vulnerabilityFlags;
  const flagCount = flags
    ? Object.values(flags).filter(Boolean).length
    : 0;
  const isMatched = alert.status === 'matched' || alert.status === 'in_progress';

  return (
    <motion.button
      layout
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      onClick={onClick}
      type="button"
      aria-label={`Open alert: ${alert.parsed?.summary ?? alert.alertId}`}
      className={cn(
        'glass glass-sheen relative w-full overflow-hidden p-3 text-left transition-all',
        selected ? cn('ring-1', colors.ring) : 'hover:border-white/15 hover:bg-white/[0.05]',
      )}
    >
      {/* Severity ribbon */}
      <div
        aria-hidden
        className={cn('absolute left-0 top-0 h-full w-0.5', colors.bg.replace('/15', ''))}
      />

      <div className="flex items-start justify-between gap-3 pl-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                colors.bg,
                colors.text,
              )}
            >
              {sev}
            </span>
            {alert.status === 'flagged' && (
              <span className="flex items-center gap-1 rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-widest text-white/45">
                <ShieldAlert className="h-2.5 w-2.5" /> flagged
              </span>
            )}
            <span className="font-mono text-[9px] text-white/30">
              #{alert.alertId.slice(0, 6)}
            </span>
          </div>

          <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-white/85">
            {alert.parsed?.summary ?? '(awaiting AI parse…)'}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-white/45">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {timeAgo(alert.createdAt)}
            </span>
            {alert.cityDistrict && (
              <span className="flex items-center gap-1">
                <MapPin className="h-2.5 w-2.5" /> {alert.cityDistrict}
              </span>
            )}
            {alert.parsed?.headcount && alert.parsed.headcount > 1 && (
              <span className="flex items-center gap-1">
                <Users className="h-2.5 w-2.5" /> {alert.parsed.headcount}
              </span>
            )}
            {flagCount > 0 && (
              <span className="text-severity-evacuation/90">
                · {flagCount} vulnerability flag{flagCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {isMatched && alert.matchReason && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md bg-sankalp-500/[0.07] px-2 py-1.5">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-sankalp-300" strokeWidth={2.4} />
              <span className="line-clamp-1 text-[10.5px] text-white/65">
                {alert.matchReason}
              </span>
            </div>
          )}
        </div>

        {/* Severity score */}
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-widest text-white/30">score</div>
          <div className={cn('font-mono text-base font-semibold tabular-nums', colors.text)}>
            {alert.parsed?.severityScore ?? '—'}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass animate-pulse p-3">
          <div className="h-3 w-16 rounded bg-white/[0.06]" />
          <div className="mt-2 h-3 w-full rounded bg-white/[0.06]" />
          <div className="mt-1 h-3 w-2/3 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}
