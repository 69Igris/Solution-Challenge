'use client';

/**
 * SANKALP — Pulse Map
 *
 * The Bloomberg-terminal-grade visualization at the heart of the coordinator
 * dashboard. A dark Mapbox basemap of the demo city with live, breathing,
 * severity-colored markers for every active SOS, plus secondary dots for
 * available volunteers. Click a pulse → selects the alert in the side panel.
 *
 * Design decisions:
 *   - DOM markers (Mapbox `Marker` + custom HTMLElements) instead of GeoJSON
 *     symbol layers, because we want CSS keyframe pulses that GeoJSON layers
 *     can't replicate cleanly.
 *   - The map is the only thing that consumes the Mapbox token. Everything
 *     else degrades gracefully if NEXT_PUBLIC_MAPBOX_TOKEN is unset.
 *   - The fallback isn't a "broken" placeholder — it's an intentional
 *     starfield-style abstract canvas with the same alert dots, so the
 *     demo doesn't lose visual integrity if a teammate forgets the token.
 */

import { useEffect, useMemo, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { ActiveAlert, VolunteerRow } from '@/lib/firestore-hooks';
import type { SeverityLevel } from '@/types';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const DEFAULT_CENTER: [number, number] = [77.6376, 12.9145]; // HSR Layout, Bengaluru
const DEFAULT_ZOOM = 12;
const MAPBOX_DARK_STYLE = 'mapbox://styles/mapbox/dark-v11';

const SEVERITY_HEX: Record<SeverityLevel, string> = {
  critical: '#FF3D6E',
  high: '#A855F7',
  medium: '#F59E0B',
  low: '#3B82F6',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface PulseMapProps {
  alerts: ActiveAlert[];
  volunteers: VolunteerRow[];
  selectedAlertId: string | null;
  onSelectAlert: (alertId: string | null) => void;
  className?: string;
}

export function PulseMap({
  alerts,
  volunteers,
  selectedAlertId,
  onSelectAlert,
  className,
}: PulseMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  if (!token) {
    return (
      <FallbackMap
        alerts={alerts}
        selectedAlertId={selectedAlertId}
        onSelectAlert={onSelectAlert}
        className={className}
      />
    );
  }

  return (
    <MapboxPulseMap
      alerts={alerts}
      volunteers={volunteers}
      selectedAlertId={selectedAlertId}
      onSelectAlert={onSelectAlert}
      className={className}
      token={token}
    />
  );
}

// ===========================================================================
// Mapbox implementation
// ===========================================================================
function MapboxPulseMap({
  alerts,
  volunteers,
  selectedAlertId,
  onSelectAlert,
  className,
  token,
}: PulseMapProps & { token: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const alertMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const volunteerMarkersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // ---- init map (once) ----
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAPBOX_DARK_STYLE,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(
      new mapboxgl.AttributionControl({ compact: true }),
      'bottom-right',
    );

    // Subtle vignette + saturate on top of dark-v11
    map.on('style.load', () => {
      try {
        map.setFog({
          'horizon-blend': 0.04,
          color: '#05060B',
          'high-color': '#0A0B14',
          'space-color': '#000000',
          'star-intensity': 0.05,
        });
      } catch {
        /* fog API may differ across Mapbox versions; ignore */
      }
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      alertMarkersRef.current.clear();
      volunteerMarkersRef.current.clear();
    };
  }, [token]);

  // ---- sync alert markers ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const present = new Set<string>();
    for (const a of alerts) {
      if (!a.location) continue;
      present.add(a.alertId);

      const existing = alertMarkersRef.current.get(a.alertId);
      const sev = a.parsed?.severity ?? 'medium';
      const isMatched = a.status === 'matched' || a.status === 'in_progress';

      // Mapbox `Marker` doesn't expose setElement, so we have to remove and
      // recreate when state changes (severity / matched / selected) — that's
      // the only reliable way to refresh both data-* attributes AND the
      // onClick closure (which captures `onSelectAlert` from a previous render).
      if (existing) existing.remove();

      const el = makeAlertMarker({
        severity: sev,
        matched: isMatched,
        selected: a.alertId === selectedAlertId,
        onClick: () => onSelectAlert(a.alertId),
      });
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([a.location.lng, a.location.lat])
        .addTo(map);
      alertMarkersRef.current.set(a.alertId, marker);
    }

    // Remove markers no longer in feed
    for (const [id, marker] of alertMarkersRef.current.entries()) {
      if (!present.has(id)) {
        marker.remove();
        alertMarkersRef.current.delete(id);
      }
    }
  }, [alerts, selectedAlertId, onSelectAlert]);

  // ---- sync volunteer dots ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const present = new Set<string>();
    for (const v of volunteers) {
      if (!v.location) continue;
      present.add(v.uid);

      const existing = volunteerMarkersRef.current.get(v.uid);
      if (existing) {
        existing.setLngLat([v.location.lng, v.location.lat]);
        existing.getElement().dataset.available = String(v.isAvailable);
      } else {
        const el = makeVolunteerMarker(v.isAvailable);
        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([v.location.lng, v.location.lat])
          .addTo(map);
        volunteerMarkersRef.current.set(v.uid, marker);
      }
    }
    for (const [uid, marker] of volunteerMarkersRef.current.entries()) {
      if (!present.has(uid)) {
        marker.remove();
        volunteerMarkersRef.current.delete(uid);
      }
    }
  }, [volunteers]);

  // ---- pan to selected alert ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedAlertId) return;
    const a = alerts.find((x) => x.alertId === selectedAlertId);
    if (!a?.location) return;
    map.easeTo({
      center: [a.location.lng, a.location.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: 700,
    });
  }, [selectedAlertId, alerts]);

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <div ref={containerRef} className="absolute inset-0" />
      <PulseMarkerStyles />
      {/* Subtle inner-glow vignette for that command-center feel */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 120px 12px rgba(5,6,11,0.85)',
        }}
      />
    </div>
  );
}

// ===========================================================================
// Marker DOM factories
// ===========================================================================
function makeAlertMarker({
  severity,
  matched,
  selected,
  onClick,
}: {
  severity: SeverityLevel;
  matched: boolean;
  selected: boolean;
  onClick: () => void;
}): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'sankalp-alert-marker';
  root.dataset.severity = severity;
  root.dataset.matched = String(matched);
  root.dataset.selected = String(selected);

  const ring = document.createElement('div');
  ring.className = 'ring';
  const dot = document.createElement('div');
  dot.className = 'dot';

  root.appendChild(ring);
  root.appendChild(dot);
  root.style.cssText = `--severity-color: ${SEVERITY_HEX[severity]};`;
  root.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return root;
}

function makeVolunteerMarker(available: boolean): HTMLDivElement {
  const root = document.createElement('div');
  root.className = 'sankalp-volunteer-marker';
  root.dataset.available = String(available);
  return root;
}

// ===========================================================================
// Embedded styles (no Tailwind — these target pseudo-state via data-attrs)
// ===========================================================================
function PulseMarkerStyles() {
  return (
    <style jsx global>{`
      .sankalp-alert-marker {
        position: relative;
        width: 18px;
        height: 18px;
        cursor: pointer;
        transition: transform 0.2s ease;
      }
      .sankalp-alert-marker:hover {
        transform: scale(1.2);
      }
      .sankalp-alert-marker .dot {
        position: absolute;
        inset: 4px;
        border-radius: 999px;
        background: var(--severity-color);
        box-shadow:
          0 0 0 2px rgba(5, 6, 11, 0.9),
          0 0 16px var(--severity-color);
      }
      .sankalp-alert-marker .ring {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: var(--severity-color);
        opacity: 0.55;
        animation: sankalp-pulse 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      .sankalp-alert-marker[data-selected='true'] {
        transform: scale(1.35);
      }
      .sankalp-alert-marker[data-selected='true'] .dot {
        box-shadow:
          0 0 0 2px white,
          0 0 24px var(--severity-color);
      }
      .sankalp-alert-marker[data-matched='true'] .ring {
        animation-duration: 4s;
        opacity: 0.3;
      }
      @keyframes sankalp-pulse {
        0% {
          transform: scale(1);
          opacity: 0.6;
        }
        100% {
          transform: scale(2.4);
          opacity: 0;
        }
      }

      .sankalp-volunteer-marker {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.35);
        box-shadow:
          0 0 0 1.5px rgba(5, 6, 11, 0.9),
          0 0 8px rgba(255, 255, 255, 0.2);
      }
      .sankalp-volunteer-marker[data-available='true'] {
        background: #10b981;
        box-shadow:
          0 0 0 1.5px rgba(5, 6, 11, 0.9),
          0 0 10px rgba(16, 185, 129, 0.6);
      }

      /* Mapbox attribution — tame to fit the dark theme */
      .mapboxgl-ctrl-attrib {
        background: rgba(15, 17, 32, 0.6) !important;
        backdrop-filter: blur(8px);
      }
      .mapboxgl-ctrl-attrib a,
      .mapboxgl-ctrl-attrib {
        color: rgba(255, 255, 255, 0.45) !important;
        font-size: 10px !important;
      }
    `}</style>
  );
}

// ===========================================================================
// Fallback when no Mapbox token — abstract starfield with alert dots
// ===========================================================================
function FallbackMap({
  alerts,
  selectedAlertId,
  onSelectAlert,
  className,
}: Omit<PulseMapProps, 'volunteers'>) {
  const positioned = useMemo(() => {
    // Project lat/lng of HSR area (12.85..12.98, 77.55..77.72) into 0..1 box
    const minLat = 12.86, maxLat = 12.98, minLng = 77.55, maxLng = 77.72;
    return alerts
      .filter((a) => a.location)
      .map((a) => ({
        ...a,
        x: ((a.location!.lng - minLng) / (maxLng - minLng)) * 100,
        y: 100 - ((a.location!.lat - minLat) / (maxLat - minLat)) * 100,
      }));
  }, [alerts]);

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-midnight-900',
        className,
      )}
    >
      {/* starfield grain */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `radial-gradient(rgba(76,91,255,0.18) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-sankalp-500/[0.05] via-transparent to-severity-medical/[0.04]"
      />
      <PulseMarkerStyles />

      {positioned.map((a) => {
        const sev = a.parsed?.severity ?? 'medium';
        const matched = a.status === 'matched' || a.status === 'in_progress';
        return (
          <button
            key={a.alertId}
            onClick={() => onSelectAlert(a.alertId)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${a.x}%`,
              top: `${a.y}%`,
              ['--severity-color' as string]: SEVERITY_HEX[sev],
            }}
            aria-label={a.parsed?.summary ?? 'SOS alert'}
          >
            <div
              className="sankalp-alert-marker"
              data-severity={sev}
              data-matched={String(matched)}
              data-selected={String(a.alertId === selectedAlertId)}
            >
              <div className="ring" />
              <div className="dot" />
            </div>
          </button>
        );
      })}

      {/* Empty state */}
      {alerts.length === 0 && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
              Awaiting telemetry
            </div>
            <div className="mt-2 text-sm text-white/55">
              No active SOS in your sector.
            </div>
          </div>
        </div>
      )}

      {/* Token-missing notice — corner pill, doesn't break the demo */}
      <div className="absolute bottom-3 right-3 rounded-md border border-white/10 bg-midnight-900/80 px-2 py-1 text-[10px] uppercase tracking-widest text-white/40 backdrop-blur">
        abstract view · add NEXT_PUBLIC_MAPBOX_TOKEN for street basemap
      </div>
    </div>
  );
}
