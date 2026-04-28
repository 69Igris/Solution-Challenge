'use client';

/**
 * SANKALP — KPI Bar
 *
 * The three numbers a District Magistrate needs to grok in 5 seconds:
 *   1. Unmet Needs       — alerts waiting on a volunteer match
 *   2. Median Match Time — proves the AI is actually fast
 *   3. Lives Assisted    — emotional anchor for the impact story
 */

import { motion } from 'framer-motion';
import { AlertTriangle, Clock, HeartHandshake } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardKpis } from '@/lib/firestore-hooks';

export function KpiBar({ kpis, loading }: { kpis: DashboardKpis; loading?: boolean }) {
  const tiles = [
    {
      label: 'Unmet needs',
      value: kpis.unmetNeeds.toString(),
      sub: kpis.unmetNeeds === 0 ? 'all matched' : `${kpis.activeAlerts} active`,
      icon: AlertTriangle,
      tone: kpis.unmetNeeds > 0 ? 'urgent' : 'calm',
    },
    {
      label: 'Median match time',
      value: kpis.medianMatchMinutes != null
        ? formatMinutes(kpis.medianMatchMinutes)
        : '—',
      sub: kpis.matchedNow > 0 ? `${kpis.matchedNow} en route` : 'awaiting first match',
      icon: Clock,
      tone: 'calm',
    },
    {
      label: 'Lives assisted today',
      value: kpis.livesAssistedToday.toString(),
      sub: `${kpis.availableVolunteers}/${kpis.totalVolunteers} volunteers ready`,
      icon: HeartHandshake,
      tone: 'good',
    },
  ] as const;

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.label}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06, duration: 0.4, ease: 'easeOut' }}
          className={cn(
            'glass-strong relative overflow-hidden p-3',
            tile.tone === 'urgent' && 'ring-1 ring-severity-medical/20',
          )}
        >
          <div className="flex items-center gap-2">
            <tile.icon
              className={cn(
                'h-3.5 w-3.5',
                tile.tone === 'urgent'
                  ? 'text-severity-medical'
                  : tile.tone === 'good'
                    ? 'text-severity-resolved'
                    : 'text-white/55',
              )}
              strokeWidth={2}
            />
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
              {tile.label}
            </div>
          </div>
          <div className={cn('mt-1.5 font-display text-3xl font-semibold tabular-nums tracking-tight', loading && 'opacity-40')}>
            {tile.value}
          </div>
          <div className="text-[11px] text-white/50">{tile.sub}</div>

          {/* subtle ribbon glow */}
          {tile.tone === 'urgent' && (
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-8 -right-8 h-24 w-24 rounded-full bg-severity-medical/10 blur-2xl"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}

function formatMinutes(m: number): string {
  if (m < 1) return `${Math.round(m * 60)}s`;
  const roundedMinutes = Math.round(m);
  if (roundedMinutes < 60) return `${roundedMinutes}m`;
  const h = Math.floor(roundedMinutes / 60);
  const rem = roundedMinutes % 60;
  return `${h}h ${rem}m`;
}
