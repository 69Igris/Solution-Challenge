/**
 * SANKALP — Geohash encoder (zero-dependency, base32, Niemeyer's algorithm)
 *
 * Why we have this: every SOS document carries a `geohash` field that powers
 * radius queries from the volunteer app ("show me all parsed SOS within 3 km").
 * Firestore can't do native geo-radius, so we pre-compute the geohash and
 * range-query the prefix.
 *
 * Precision reference (length → cell size):
 *   5 → ~4.9 km  (city-block aggregation, used for crisis_zones rollup)
 *   6 → ~1.2 km
 *   7 → ~152 m   (default for sos_alerts — fine enough for street-level)
 *   8 → ~38 m
 */

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(
  lat: number,
  lon: number,
  precision: number = 7,
): string {
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    throw new Error('encodeGeohash: lat/lon must be finite numbers');
  }
  if (lat < -90 || lat > 90) throw new Error('lat out of range [-90, 90]');
  if (lon < -180 || lon > 180) throw new Error('lon out of range [-180, 180]');
  if (precision < 1 || precision > 12) {
    throw new Error('precision must be 1-12');
  }

  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  let bit = 0;
  let ch = 0;
  let evenBit = true;
  let geohash = '';

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude bit
      const mid = (lonMin + lonMax) / 2;
      if (lon >= mid) {
        ch = (ch << 1) | 1;
        lonMin = mid;
      } else {
        ch = ch << 1;
        lonMax = mid;
      }
    } else {
      // latitude bit
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Returns the geohash range (inclusive start, exclusive end) for prefix queries.
 * Use with Firestore `where('geohash', '>=', start).where('geohash', '<', end)`.
 */
export function geohashRange(prefix: string): { start: string; end: string } {
  const lastChar = prefix.charAt(prefix.length - 1);
  const idx = BASE32.indexOf(lastChar);
  const next = idx === BASE32.length - 1
    ? prefix + '0' // wrap-safe for the very last cell
    : prefix.slice(0, -1) + BASE32[idx + 1];
  return { start: prefix, end: next };
}
