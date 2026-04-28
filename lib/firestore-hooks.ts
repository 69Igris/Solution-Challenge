'use client';

/**
 * SANKALP — Live Firestore React hooks (client-only)
 *
 * Thin, typed wrappers around `onSnapshot` for the coordinator dashboard.
 * Auto-clean up subscriptions on unmount, expose loading/error states, and
 * coerce Firestore-specific types (Timestamp, GeoPoint) into plain JS.
 *
 * The dashboard subscribes to all three:
 *   useActiveAlerts() → live SOS feed for the map + sidebar
 *   useVolunteers()   → volunteer dots on the map
 *   useDashboardKpis() → derived counters (Unmet, Median Match Time, Lives Assisted)
 */

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
  type DocumentData,
  type GeoPoint,
  type Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import type { NeedType, SeverityLevel, SosStatus } from '@/types';

// ---------------------------------------------------------------------------
// Mission shape (mirrors firestore/schema.json `missions` collection)
// ---------------------------------------------------------------------------
export type MissionStatus =
  | 'assigned' | 'en_route' | 'on_site' | 'completed' | 'aborted';

export interface MissionRow {
  missionId: string;
  alertId: string;
  volunteerUid: string;
  status: MissionStatus;
  acceptedAt: number;            // epoch ms
  arrivedAt: number | null;
  completedAt: number | null;
  distanceMeters: number;
  estimatedDurationSeconds: number;
}

// ---------------------------------------------------------------------------
// Public client-side row shapes — Firestore primitives normalised to JS
// ---------------------------------------------------------------------------
export interface ActiveAlert {
  alertId: string;
  citizenUid: string;
  status: SosStatus;
  inputLanguage: string;
  cityDistrict: string | null;
  parsed: {
    needTypes: NeedType[];
    severity: SeverityLevel;
    severityScore: number;
    summary: string;
    summaryLocalized: string;
    headcount: number;
    vulnerabilityFlags: {
      elderly: boolean;
      child: boolean;
      pregnant: boolean;
      disabled: boolean;
      injured: boolean;
    };
    accessibilityNotes: string | null;
    confidence: number;
  } | null;
  parsedAt: number | null;
  arrivedAt: number | null;
  location: { lat: number; lng: number } | null;
  geohash: string | null;
  matchedVolunteerUid: string | null;
  matchedAt: number | null;       // epoch ms
  matchScore: number | null;
  matchReason: string | null;
  createdAt: number;               // epoch ms (best-effort)
  resolvedAt: number | null;
  responseMinutes: number | null;
}

export interface VolunteerRow {
  uid: string;
  displayName: string | null;
  isAvailable: boolean;
  hasVehicle: boolean;
  skills: string[];
  location: { lat: number; lng: number } | null;
  activeMissionId: string | null;
}

export interface DashboardKpis {
  activeAlerts: number;
  unmetNeeds: number;          // alerts with no matched volunteer yet
  matchedNow: number;
  medianMatchMinutes: number | null;
  livesAssistedToday: number;  // resolved alerts in last 24h × headcount
  totalVolunteers: number;
  availableVolunteers: number;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
const ACTIVE_STATUSES: SosStatus[] = ['parsed', 'matched', 'in_progress'];

export function useActiveAlerts(opts: { limitTo?: number } = {}): {
  alerts: ActiveAlert[];
  loading: boolean;
  error: FirestoreError | null;
} {
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    const db = getDb();
    // Single query — no composite-index dependency. We filter client-side.
    const q = query(
      collection(db, 'sos_alerts'),
      orderBy('createdAt', 'desc'),
      limit(opts.limitTo ?? 80),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: ActiveAlert[] = [];
        snap.forEach((d) => {
          const a = normaliseAlert(d.id, d.data());
          if (a && (ACTIVE_STATUSES.includes(a.status) || a.status === 'flagged')) {
            rows.push(a);
          }
        });
        setAlerts(rows);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [opts.limitTo]);

  return { alerts, loading, error };
}

export function useVolunteers(): {
  volunteers: VolunteerRow[];
  loading: boolean;
  error: FirestoreError | null;
} {
  const [volunteers, setVolunteers] = useState<VolunteerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    const db = getDb();
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'volunteer'),
      limit(200),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: VolunteerRow[] = [];
        snap.forEach((d) => {
          const v = normaliseVolunteer(d.data());
          if (v) rows.push(v);
        });
        setVolunteers(rows);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  return { volunteers, loading, error };
}

/**
 * Computes dashboard KPIs from the live alerts + volunteers streams.
 * Pure derivation — no extra Firestore reads.
 */
export function useDashboardKpis(
  alerts: ActiveAlert[],
  volunteers: VolunteerRow[],
): DashboardKpis {
  return useMemo(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const now = Date.now();

    const active = alerts.filter((a) => ACTIVE_STATUSES.includes(a.status));
    const unmet = active.filter(
      (a) => a.status === 'parsed' && a.matchedVolunteerUid === null,
    ).length;
    const matched = active.filter(
      (a) => a.status === 'matched' || a.status === 'in_progress',
    ).length;

    // Median match time across all matched alerts in the feed
    const matchTimes: number[] = [];
    for (const a of alerts) {
      if (a.matchedAt && a.createdAt) {
        const dt = (a.matchedAt - a.createdAt) / 60000;
        if (dt > 0 && dt < 24 * 60) matchTimes.push(dt);
      }
    }
    matchTimes.sort((a, b) => a - b);
    const median =
      matchTimes.length === 0
        ? null
        : matchTimes[Math.floor(matchTimes.length / 2)];

    // Lives assisted today — based on resolved alerts in the last 24h
    let livesToday = 0;
    for (const a of alerts) {
      if (a.resolvedAt && now - a.resolvedAt < dayMs) {
        livesToday += a.parsed?.headcount ?? 1;
      }
    }

    return {
      activeAlerts: active.length,
      unmetNeeds: unmet,
      matchedNow: matched,
      medianMatchMinutes: median,
      livesAssistedToday: livesToday,
      totalVolunteers: volunteers.length,
      availableVolunteers: volunteers.filter((v) => v.isAvailable).length,
    };
  }, [alerts, volunteers]);
}

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------
function normaliseAlert(id: string, raw: DocumentData): ActiveAlert | null {
  if (!raw) return null;
  const loc = raw.location as GeoPoint | undefined;
  return {
    alertId: id,
    citizenUid: raw.citizenUid ?? '',
    status: (raw.status ?? 'pending') as SosStatus,
    inputLanguage: raw.inputLanguage ?? 'en',
    cityDistrict: raw.cityDistrict ?? null,
    parsed: raw.parsed ?? null,
    parsedAt: tsToMs(raw.parsedAt),
    arrivedAt: tsToMs(raw.arrivedAt),
    location: loc
      ? { lat: loc.latitude, lng: loc.longitude }
      : null,
    geohash: raw.geohash ?? null,
    matchedVolunteerUid: raw.matchedVolunteerUid ?? null,
    matchedAt: tsToMs(raw.matchedAt),
    matchScore: raw.matchScore ?? null,
    matchReason: raw.matchReason ?? null,
    createdAt: tsToMs(raw.createdAt) ?? Date.now(),
    resolvedAt: tsToMs(raw.resolvedAt),
    responseMinutes: raw.responseMinutes ?? null,
  };
}

function normaliseVolunteer(raw: DocumentData): VolunteerRow | null {
  if (!raw || !raw.volunteer) return null;
  const v = raw.volunteer;
  const loc = v.lastKnownLocation as GeoPoint | undefined;
  return {
    uid: raw.uid ?? '',
    displayName: raw.displayName ?? null,
    isAvailable: !!v.isAvailable,
    hasVehicle: !!v.hasVehicle,
    skills: Array.isArray(v.skills) ? v.skills : [],
    location: loc ? { lat: loc.latitude, lng: loc.longitude } : null,
    activeMissionId: v.activeMissionId ?? null,
  };
}

function tsToMs(t: unknown): number | null {
  if (t == null) return null;
  if (typeof t === 'number') return t;
  if (typeof t === 'object' && t !== null && 'toMillis' in t) {
    try {
      return (t as Timestamp).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Single-document subscriptions
// ---------------------------------------------------------------------------
export function useAlert(alertId: string | null): {
  alert: ActiveAlert | null;
  loading: boolean;
  error: FirestoreError | null;
} {
  const [alert, setAlert] = useState<ActiveAlert | null>(null);
  const [loading, setLoading] = useState(!!alertId);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!alertId) {
      setAlert(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ref = doc(getDb(), 'sos_alerts', alertId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setAlert(snap.exists() ? normaliseAlert(snap.id, snap.data()) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [alertId]);

  return { alert, loading, error };
}

export function useVolunteer(uid: string | null): {
  volunteer: VolunteerRow | null;
  loading: boolean;
  error: FirestoreError | null;
} {
  const [volunteer, setVolunteer] = useState<VolunteerRow | null>(null);
  const [loading, setLoading] = useState(!!uid);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!uid) {
      setVolunteer(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const ref = doc(getDb(), 'users', uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setVolunteer(snap.exists() ? normaliseVolunteer(snap.data()) : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { volunteer, loading, error };
}

export function useMissionsForVolunteer(volunteerUid: string | null): {
  missions: MissionRow[];
  loading: boolean;
  error: FirestoreError | null;
} {
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [loading, setLoading] = useState(!!volunteerUid);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!volunteerUid) {
      setMissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(getDb(), 'missions'),
      where('volunteerUid', '==', volunteerUid),
      orderBy('acceptedAt', 'desc'),
      limit(30),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows: MissionRow[] = [];
        snap.forEach((d) => {
          const m = normaliseMission(d.id, d.data());
          if (m) rows.push(m);
        });
        setMissions(rows);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );
    return unsub;
  }, [volunteerUid]);

  return { missions, loading, error };
}

function normaliseMission(id: string, raw: DocumentData): MissionRow | null {
  if (!raw) return null;
  return {
    missionId: id,
    alertId: raw.alertId ?? '',
    volunteerUid: raw.volunteerUid ?? '',
    status: (raw.status ?? 'assigned') as MissionStatus,
    acceptedAt: tsToMs(raw.acceptedAt) ?? Date.now(),
    arrivedAt: tsToMs(raw.arrivedAt),
    completedAt: tsToMs(raw.completedAt),
    distanceMeters: typeof raw.distanceMeters === 'number' ? raw.distanceMeters : 0,
    estimatedDurationSeconds:
      typeof raw.estimatedDurationSeconds === 'number'
        ? raw.estimatedDurationSeconds
        : 0,
  };
}
