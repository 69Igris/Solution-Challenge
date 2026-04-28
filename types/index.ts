/**
 * SANKALP — Domain Types
 *
 * Mirrors the Firestore NoSQL schema in /firestore/schema.json.
 * Keep these in lock-step with the schema file when evolving the data model.
 */

import type { Timestamp, GeoPoint } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type NeedType =
  | 'medical'
  | 'evacuation'
  | 'shelter'
  | 'food'
  | 'water'
  | 'rescue'
  | 'other';

export type SosStatus =
  | 'pending'      // newly raised, awaiting AI parse
  | 'parsed'       // Gemini classification complete, awaiting match
  | 'matched'      // volunteer assigned, en-route
  | 'in_progress'  // volunteer on-site
  | 'resolved'     // need fulfilled
  | 'cancelled'    // citizen withdrew
  | 'flagged';     // verification layer flagged for review

export type VolunteerSkill =
  | 'first_aid'
  | 'cpr_certified'
  | 'medical_professional'
  | 'driver'
  | 'heavy_lifter'
  | 'cook'
  | 'swimmer'
  | 'translator'
  | 'electrician'
  | 'plumber';

export type SupportedLanguage =
  | 'en'  // English
  | 'hi'  // Hindi
  | 'ta'  // Tamil
  | 'te'  // Telugu
  | 'kn'  // Kannada
  | 'ml'  // Malayalam
  | 'mr'  // Marathi
  | 'bn'  // Bengali
  | 'gu'  // Gujarati
  | 'pa'  // Punjabi
  | 'or'  // Odia
  | 'as'; // Assamese

export type UserRole = 'citizen' | 'volunteer' | 'coordinator' | 'ngo_admin';

// ---------------------------------------------------------------------------
// Firestore document shapes
// ---------------------------------------------------------------------------

/** Collection: `users/{uid}` */
export interface UserDoc {
  uid: string;
  role: UserRole;
  phone: string;            // E.164, primary identity in India (phone-OTP auth)
  displayName: string | null;
  preferredLanguage: SupportedLanguage;
  // Volunteer-only fields (null for citizens)
  volunteer?: {
    skills: VolunteerSkill[];
    radiusKm: number;       // willingness to travel
    hasVehicle: boolean;
    vehicleCapacityKg: number | null;
    isAvailable: boolean;
    lastKnownLocation: GeoPoint | null;
    activeMissionId: string | null;
    completedMissions: number;
    averageResponseMinutes: number | null;
  } | null;
  // Aggregate counters
  sosRaisedCount: number;
  livesAssistedCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // 2G fallback flag — set client-side based on connection.effectiveType
  isLowBandwidth: boolean;
}

/** Collection: `sos_alerts/{alertId}` */
export interface SosAlertDoc {
  alertId: string;
  citizenUid: string;
  status: SosStatus;

  // Raw inputs
  rawVoiceUrl: string | null;       // Cloud Storage URL, max 30s clip
  rawPhotoUrl: string | null;       // Cloud Storage URL, compressed
  rawTextInput: string | null;      // optional typed input
  inputLanguage: SupportedLanguage;

  // Gemini parse output (populated by Cloud Function)
  parsed: {
    needTypes: NeedType[];           // a single SOS may have multiple needs
    severity: SeverityLevel;
    severityScore: number;            // 0-100 for sorting
    summary: string;                   // 1-line English summary for coordinators
    summaryLocalized: string;          // same line in citizen's language
    headcount: number;                 // people needing help
    vulnerabilityFlags: {
      elderly: boolean;
      child: boolean;
      pregnant: boolean;
      disabled: boolean;
      injured: boolean;
    };
    accessibilityNotes: string | null; // "stuck on 3rd floor, water rising"
    confidence: number;                // 0-1, for verification routing
  } | null;

  // Geolocation
  location: GeoPoint;                  // device GPS or inferred from speech
  geohash: string;                     // for radius queries
  pincode: string | null;              // reverse-geocoded
  cityDistrict: string | null;         // e.g. "Bengaluru Urban"

  // Matching state
  matchedVolunteerUid: string | null;
  matchedAt: Timestamp | null;
  matchScore: number | null;
  matchReason: string | null;          // "Why you were matched" — explainability

  // Lifecycle
  createdAt: Timestamp;
  resolvedAt: Timestamp | null;
  responseMinutes: number | null;      // resolvedAt - createdAt

  // Trust & verification
  duplicateOfAlertId: string | null;
  flagReason: string | null;
}

/** Collection: `missions/{missionId}` — volunteer-side view of an active match */
export interface MissionDoc {
  missionId: string;
  alertId: string;
  volunteerUid: string;
  status: 'assigned' | 'en_route' | 'on_site' | 'completed' | 'aborted';
  acceptedAt: Timestamp;
  arrivedAt: Timestamp | null;
  completedAt: Timestamp | null;
  routePolyline: string | null;        // encoded polyline from Routes API
  distanceMeters: number;
  estimatedDurationSeconds: number;
}

/** Collection: `crisis_zones/{zoneId}` — coordinator/predictive layer */
export interface CrisisZoneDoc {
  zoneId: string;
  name: string;                         // e.g. "HSR Layout — Sector 2"
  geohashPrefix: string;
  activeAlertCount: number;
  predictedSurgeMinutes: number | null; // forecasted spike window
  predictedSurgeConfidence: number | null;
  unmetNeedCount: number;
  lastUpdatedAt: Timestamp;
}
