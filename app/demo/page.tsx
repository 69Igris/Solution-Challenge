'use client';

/**
 * SANKALP — Demo Control Center
 *
 * The single URL you open during a live judging demo. Lets you reset the
 * sandbox, fire scripted SOS scenarios that look real, and jump into any
 * of the three role views with one click.
 *
 * NOT for production. Guarded by SANKALP_DEMO_MODE on the API side.
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  Hospital,
  Loader2,
  RefreshCw,
  Siren,
  TestTube,
  Users,
  LayoutDashboard,
} from 'lucide-react';
import { useEnsureAuth } from '@/lib/auth-hooks';
import {
  useActiveAlerts,
  useDashboardKpis,
  useVolunteers,
} from '@/lib/firestore-hooks';
import { cn, timeAgo } from '@/lib/utils';

// Hand-tuned scenarios for live demos. Each uses real Indian-disaster
// language so Gemini Flash returns rich, realistic parses on demo day.
const SCENARIOS = [
  {
    id: 'critical-medical',
    label: 'Critical · Medical',
    icon: Hospital,
    accent: 'border-severity-medical/30 hover:bg-severity-medical/[0.06] text-severity-medical',
    sos: {
      lat: 12.9145,
      lng: 77.6376,
      language: 'hi',
      text: 'मेरे पिताजी अचेत हैं, सांस बहुत धीमी है, हमें अभी मदद चाहिए। दूसरी मंज़िल पर हैं, नीचे पानी भर गया है।',
      cityDistrict: 'HSR Layout · Sector 2',
    },
  },
  {
    id: 'high-rescue',
    label: 'High · Rescue',
    icon: Flame,
    accent: 'border-severity-evacuation/30 hover:bg-severity-evacuation/[0.06] text-severity-evacuation',
    sos: {
      lat: 12.9352,
      lng: 77.6245,
      language: 'en',
      text: 'Family of five with infant trapped on the roof, water level at chest height on ground floor, road blocked by a fallen tree.',
      cityDistrict: 'Koramangala · 4th Block',
    },
  },
  {
    id: 'medium-food',
    label: 'Medium · Food / Water',
    icon: Users,
    accent: 'border-severity-food/30 hover:bg-severity-food/[0.06] text-severity-food',
    sos: {
      lat: 12.9082,
      lng: 77.6042,
      language: 'kn',
      text: '12 ಕುಟುಂಬಗಳು ಶಾಲೆಯಲ್ಲಿ ಆಶ್ರಯ ಪಡೆದಿದ್ದಾರೆ, 24 ಗಂಟೆಯಿಂದ ಆಹಾರ ಇಲ್ಲ, ಕುಡಿಯುವ ನೀರು ಬೇಕು.',
      cityDistrict: 'Madiwala',
    },
  },
] as const;

export default function DemoControlCenterPage() {
  const auth = useEnsureAuth();
  const { alerts } = useActiveAlerts({ limitTo: 50 });
  const { volunteers } = useVolunteers();
  const kpis = useDashboardKpis(alerts, volunteers);

  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ time: number; level: 'info' | 'success' | 'error'; message: string }>>([]);

  const pushLog = (level: 'info' | 'success' | 'error', message: string) => {
    setLog((l) => [...l.slice(-19), { time: Date.now(), level, message }]);
  };

  const fireSos = async (s: (typeof SCENARIOS)[number]) => {
    if (busy) return;
    setBusy(s.id);
    pushLog('info', `Firing ${s.label}…`);
    try {
      const fd = new FormData();
      fd.append('lat', String(s.sos.lat));
      fd.append('lng', String(s.sos.lng));
      fd.append('language', s.sos.language);
      fd.append('text', s.sos.text);
      fd.append('cityDistrict', s.sos.cityDistrict);

      const res = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'x-demo-uid': 'demo-citizen-001' },
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      const matched = json.match?.matched
        ? `→ matched ${json.match.matchedVolunteerName ?? json.match.matchedVolunteerUid}`
        : '→ awaiting match';
      pushLog('success', `${s.label} dispatched in ${json.elapsedMs}ms ${matched}`);
    } catch (e) {
      pushLog('error', `${s.label} failed — ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  const resetAll = async () => {
    if (busy) return;
    setBusy('reset');
    pushLog('info', 'Wiping demo data…');
    try {
      await fetch('/api/seed-demo', { method: 'DELETE' });
      const res = await fetch('/api/seed-demo', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.error || `HTTP ${res.status}`);
      }
      pushLog(
        'success',
        `Reset complete · ${json.seeded} volunteers + ${json.seededAlerts ?? 0} sample alerts`,
      );
    } catch (e) {
      pushLog('error', `Reset failed — ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setBusy(null);
    }
  };

  if (auth.loading) {
    return (
      <main className="grid h-dvh place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-sankalp-400" />
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-5 p-5">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-sankalp-500 to-sankalp-700 shadow-glow-brand">
            <TestTube className="h-4 w-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <div className="text-sm font-medium tracking-wide text-white">
              SANKALP · Demo Control
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
              not for production · sankalp_demo_mode required
            </div>
          </div>
        </div>
        <button
          onClick={resetAll}
          disabled={busy != null}
          className="glass flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white/75 transition hover:text-white disabled:opacity-60"
        >
          {busy === 'reset' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Reset & reseed
        </button>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-4 gap-3">
        <Tile label="Active alerts" value={kpis.activeAlerts.toString()} hint={`${kpis.unmetNeeds} unmatched`} />
        <Tile label="En route / on-site" value={kpis.matchedNow.toString()} hint="volunteers in motion" />
        <Tile
          label="Median match"
          value={kpis.medianMatchMinutes != null ? `${Math.round(kpis.medianMatchMinutes)}m` : '—'}
          hint="across recent alerts"
        />
        <Tile
          label="Volunteers"
          value={`${kpis.availableVolunteers}/${kpis.totalVolunteers}`}
          hint="available / total"
        />
      </section>

      {/* Scenario buttons */}
      <section>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Fire a scenario
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {SCENARIOS.map((s) => {
            const Icon = s.icon;
            return (
              <motion.button
                key={s.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => fireSos(s)}
                disabled={busy != null}
                className={cn(
                  'glass-strong group relative flex flex-col gap-2 p-4 text-left transition disabled:opacity-60',
                  'border-l-2',
                  s.accent,
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                    {s.label}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed text-white/70 line-clamp-2">
                  {s.sos.text}
                </p>
                <div className="mt-auto flex items-center justify-between text-[10px] uppercase tracking-widest text-white/35">
                  <span>{s.sos.cityDistrict}</span>
                  <span>{s.sos.language.toUpperCase()}</span>
                </div>
                {busy === s.id && (
                  <div className="absolute inset-0 grid place-items-center rounded-2xl bg-midnight-900/70 backdrop-blur-sm">
                    <Loader2 className="h-5 w-5 animate-spin text-white/85" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Quick links to role views */}
      <section>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Open a role view (new tab)
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <RoleLink href="/sos" target="_blank" icon={Siren} title="Citizen SOS" subtitle="Press the red button" tint="text-severity-medical" />
          <RoleLink href="/missions?as=demo-volunteer-001" target="_blank" icon={Users} title="Volunteer · Priya" subtitle="Mission card view" tint="text-sankalp-300" />
          <RoleLink href="/command" target="_blank" icon={LayoutDashboard} title="Coordinator" subtitle="Pulse map + KPIs" tint="text-severity-resolved" />
        </div>
      </section>

      {/* Activity log */}
      <section className="flex-1">
        <h2 className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Demo activity
          <span className="font-mono text-white/35">{log.length}</span>
        </h2>
        <div className="glass-strong flex max-h-72 flex-col overflow-y-auto p-3">
          {log.length === 0 ? (
            <div className="grid place-items-center py-8 text-[11px] text-white/35">
              No actions yet. Press a scenario to begin.
            </div>
          ) : (
            <ul className="space-y-1.5 font-mono text-[11px]">
              {log
                .slice()
                .reverse()
                .map((l, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                        l.level === 'success'
                          ? 'bg-severity-resolved'
                          : l.level === 'error'
                            ? 'bg-severity-medical'
                            : 'bg-sankalp-300',
                      )}
                    />
                    <span className="text-white/35">{timeAgo(l.time)}</span>
                    <span
                      className={cn(
                        'flex-1',
                        l.level === 'success'
                          ? 'text-white/85'
                          : l.level === 'error'
                            ? 'text-severity-medical'
                            : 'text-white/70',
                      )}
                    >
                      {l.message}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      {/* Live alert preview footer */}
      <section>
        <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Last 5 alerts (live)
        </h2>
        <div className="grid gap-2">
          {alerts.slice(0, 5).map((a) => (
            <div
              key={a.alertId}
              className="glass flex items-center justify-between gap-3 px-3 py-2 text-[11px]"
            >
              <span className="font-mono text-[10px] text-white/35">
                #{a.alertId.slice(0, 6)}
              </span>
              <span className="line-clamp-1 flex-1 text-white/75">
                {a.parsed?.summary ?? '(awaiting AI parse)'}
              </span>
              <StatusBadge status={a.status} />
            </div>
          ))}
          {alerts.length === 0 && (
            <div className="glass grid place-items-center py-4 text-[11px] text-white/35">
              Awaiting first SOS — fire a scenario above.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------
function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="glass-strong p-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
        {value}
      </div>
      <div className="text-[10px] text-white/40">{hint}</div>
    </div>
  );
}

function RoleLink({
  href,
  target,
  icon: Icon,
  title,
  subtitle,
  tint,
}: {
  href: string;
  target?: string;
  icon: typeof Siren;
  title: string;
  subtitle: string;
  tint: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      className="glass group flex items-center gap-3 p-3 transition hover:border-white/15 hover:bg-white/[0.05]"
    >
      <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.06] ring-1 ring-white/5', tint)}>
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-white">{title}</div>
        <div className="text-[11px] text-white/50">{subtitle}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-white" />
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; classes: string }> = {
    pending:     { label: 'Sending',         classes: 'bg-white/[0.05] text-white/65' },
    parsed:      { label: 'Awaiting',        classes: 'bg-severity-food/15 text-severity-food' },
    matched:     { label: 'Matched',         classes: 'bg-sankalp-500/15 text-sankalp-300' },
    in_progress: { label: 'On-site',         classes: 'bg-severity-evacuation/15 text-severity-evacuation' },
    resolved:    { label: 'Resolved',        classes: 'bg-severity-resolved/15 text-severity-resolved' },
    flagged:     { label: 'Flagged',         classes: 'bg-severity-medical/15 text-severity-medical' },
    cancelled:   { label: 'Cancelled',       classes: 'bg-white/[0.05] text-white/55' },
  };
  const m = map[status] ?? map.pending;
  return (
    <span className={cn('rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest', m.classes)}>
      {m.label}
    </span>
  );
}
