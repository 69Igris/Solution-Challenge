/**
 * SANKALP — POST /api/seed-demo
 *
 * Demo-prep endpoint. Creates 20 realistic volunteer profiles around the
 * Bengaluru/HSR Layout area so the matching engine has a candidate pool.
 *
 * GUARDED — only runs when SANKALP_DEMO_MODE=1. Cannot run in production.
 *
 * Usage:
 *   curl -X POST http://localhost:3000/api/seed-demo
 *
 * Idempotent — re-running overwrites the same 20 demo UIDs.
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, GeoPoint } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { encodeGeohash } from '@/lib/geohash';
import type { VolunteerSkill } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// HSR Layout, Bengaluru — our demo flood epicentre
const DEMO_CENTER = { lat: 12.9145, lng: 77.6376 };

// 20 hand-tuned profiles — varied skills, vehicles, and proximity so
// the matching engine has interesting decisions to make on demo day.
const VOLUNTEERS: Array<{
  name: string;
  phone: string;
  skills: VolunteerSkill[];
  hasVehicle: boolean;
  vehicleCapacityKg: number | null;
  averageResponseMinutes: number | null;
  completedMissions: number;
  /** Offset from DEMO_CENTER in km */
  offsetKm: { dLat: number; dLng: number };
  preferredLanguage: 'en' | 'hi' | 'kn' | 'ta';
}> = [
  // Within 1km — tight pool, expect them to dominate matches
  { name: 'Priya Sharma',     phone: '+919876500001', skills: ['medical_professional', 'first_aid', 'cpr_certified'],     hasVehicle: true,  vehicleCapacityKg: 4,  averageResponseMinutes: 8,  completedMissions: 17, offsetKm: { dLat: -0.4, dLng: 0.2 }, preferredLanguage: 'en' },
  { name: 'Arjun Mehta',      phone: '+919876500002', skills: ['driver', 'heavy_lifter'],                                  hasVehicle: true,  vehicleCapacityKg: 800,averageResponseMinutes: 12, completedMissions: 9,  offsetKm: { dLat: 0.3,  dLng: -0.5 }, preferredLanguage: 'hi' },
  { name: 'Lakshmi Iyer',     phone: '+919876500003', skills: ['first_aid', 'cook'],                                       hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 18, completedMissions: 4, offsetKm: { dLat: -0.2, dLng: -0.3 }, preferredLanguage: 'ta' },
  { name: 'Rajesh Kumar',     phone: '+919876500004', skills: ['cpr_certified', 'first_aid', 'driver'],                    hasVehicle: true,  vehicleCapacityKg: 6,  averageResponseMinutes: 11, completedMissions: 22, offsetKm: { dLat: 0.5,  dLng: 0.4 },  preferredLanguage: 'kn' },
  { name: 'Ananya Singh',     phone: '+919876500005', skills: ['swimmer', 'first_aid'],                                    hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 9,  completedMissions: 14, offsetKm: { dLat: 0.6,  dLng: -0.2 }, preferredLanguage: 'en' },

  // 1-3 km — middle ring
  { name: 'Vikram Naidu',     phone: '+919876500006', skills: ['driver', 'heavy_lifter', 'first_aid'],                     hasVehicle: true,  vehicleCapacityKg: 1200, averageResponseMinutes: 14, completedMissions: 11, offsetKm: { dLat: 1.5,  dLng: 1.2 },  preferredLanguage: 'kn' },
  { name: 'Deepa Reddy',      phone: '+919876500007', skills: ['medical_professional', 'cpr_certified'],                   hasVehicle: true,  vehicleCapacityKg: 4,  averageResponseMinutes: 16, completedMissions: 8,  offsetKm: { dLat: -1.8, dLng: 0.7 },  preferredLanguage: 'en' },
  { name: 'Sandeep Patel',    phone: '+919876500008', skills: ['driver', 'cook'],                                          hasVehicle: true,  vehicleCapacityKg: 500, averageResponseMinutes: 22, completedMissions: 3,   offsetKm: { dLat: 1.1,  dLng: -1.4 }, preferredLanguage: 'hi' },
  { name: 'Meera Krishnan',   phone: '+919876500009', skills: ['first_aid', 'translator'],                                 hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 19, completedMissions: 6, offsetKm: { dLat: -2.1, dLng: -1.0 }, preferredLanguage: 'ta' },
  { name: 'Karthik Raj',      phone: '+919876500010', skills: ['heavy_lifter', 'electrician'],                             hasVehicle: true,  vehicleCapacityKg: 300, averageResponseMinutes: 13, completedMissions: 12, offsetKm: { dLat: 2.4,  dLng: 0.3 },  preferredLanguage: 'kn' },
  { name: 'Fatima Khan',      phone: '+919876500011', skills: ['medical_professional', 'first_aid'],                       hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 10, completedMissions: 19, offsetKm: { dLat: 1.7,  dLng: -2.0 }, preferredLanguage: 'hi' },
  { name: 'Suresh Babu',      phone: '+919876500012', skills: ['driver', 'plumber'],                                       hasVehicle: true,  vehicleCapacityKg: 2,  averageResponseMinutes: 24, completedMissions: 2,  offsetKm: { dLat: -0.9, dLng: 2.3 },  preferredLanguage: 'kn' },

  // 3-5 km — outer ring, only matched when nothing closer fits
  { name: 'Neha Gupta',       phone: '+919876500013', skills: ['first_aid', 'translator', 'cook'],                         hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 17, completedMissions: 7, offsetKm: { dLat: 3.4,  dLng: 1.8 },  preferredLanguage: 'hi' },
  { name: 'Rohit Bhatt',      phone: '+919876500014', skills: ['driver', 'heavy_lifter', 'swimmer'],                       hasVehicle: true,  vehicleCapacityKg: 900, averageResponseMinutes: 15, completedMissions: 10, offsetKm: { dLat: -3.1, dLng: 2.5 },  preferredLanguage: 'en' },
  { name: 'Aishwarya Rao',    phone: '+919876500015', skills: ['first_aid'],                                                hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 28, completedMissions: 1, offsetKm: { dLat: 2.9,  dLng: -3.2 }, preferredLanguage: 'kn' },
  { name: 'Imran Sheikh',     phone: '+919876500016', skills: ['driver', 'first_aid'],                                     hasVehicle: true,  vehicleCapacityKg: 5,  averageResponseMinutes: 21, completedMissions: 5,  offsetKm: { dLat: -2.7, dLng: -3.0 }, preferredLanguage: 'hi' },
  { name: 'Sneha Joshi',      phone: '+919876500017', skills: ['cook'],                                                     hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: null, completedMissions: 0, offsetKm: { dLat: 3.8,  dLng: 0.1 },  preferredLanguage: 'en' },
  { name: 'Manoj Pillai',     phone: '+919876500018', skills: ['medical_professional', 'driver'],                          hasVehicle: true,  vehicleCapacityKg: 4,  averageResponseMinutes: 13, completedMissions: 16, offsetKm: { dLat: -3.6, dLng: -1.2 }, preferredLanguage: 'ta' },
  { name: 'Pooja Verma',      phone: '+919876500019', skills: ['translator', 'first_aid'],                                 hasVehicle: false, vehicleCapacityKg: null, averageResponseMinutes: 23, completedMissions: 4, offsetKm: { dLat: 4.2,  dLng: 2.6 },  preferredLanguage: 'hi' },
  { name: 'Tarun Bhardwaj',   phone: '+919876500020', skills: ['heavy_lifter', 'driver', 'electrician'],                   hasVehicle: true,  vehicleCapacityKg: 1500, averageResponseMinutes: 19, completedMissions: 8, offsetKm: { dLat: -4.1, dLng: 3.5 },  preferredLanguage: 'kn' },
];

export async function POST(_req: NextRequest) {
  if (process.env.SANKALP_DEMO_MODE !== '1') {
    return NextResponse.json(
      { error: 'forbidden', message: 'Set SANKALP_DEMO_MODE=1 in .env.local to enable seeding.' },
      { status: 403 },
    );
  }

  const startedAt = Date.now();
  const db = adminDb();
  const batch = db.batch();
  const seeded: Array<{ uid: string; name: string; distanceKm: number; skills: VolunteerSkill[] }> = [];

  for (let i = 0; i < VOLUNTEERS.length; i++) {
    const v = VOLUNTEERS[i];
    const uid = `demo-volunteer-${String(i + 1).padStart(3, '0')}`;

    // Convert km offset to lat/lng (rough approximation, fine for demo)
    const kmToDegLat = 1 / 111;
    const kmToDegLng = 1 / (111 * Math.cos((DEMO_CENTER.lat * Math.PI) / 180));
    const lat = DEMO_CENTER.lat + v.offsetKm.dLat * kmToDegLat;
    const lng = DEMO_CENTER.lng + v.offsetKm.dLng * kmToDegLng;
    const distanceKm = Math.sqrt(v.offsetKm.dLat ** 2 + v.offsetKm.dLng ** 2);

    // Raw shape — kept loose because UserDoc references the client-SDK GeoPoint,
    // while we write with the Admin SDK GeoPoint. Firestore accepts both at
    // runtime; only TS types diverge.
    const userDoc = {
      uid,
      role: 'volunteer' as const,
      phone: v.phone,
      displayName: v.name,
      preferredLanguage: v.preferredLanguage,
      isLowBandwidth: false,
      sosRaisedCount: 0,
      livesAssistedCount: v.completedMissions,
      volunteer: {
        skills: v.skills,
        radiusKm: 5,
        hasVehicle: v.hasVehicle,
        vehicleCapacityKg: v.vehicleCapacityKg,
        isAvailable: true,
        lastKnownLocation: new GeoPoint(lat, lng),
        activeMissionId: null,
        completedMissions: v.completedMissions,
        averageResponseMinutes: v.averageResponseMinutes,
        geohash: encodeGeohash(lat, lng, 7),
      },
    };

    const ref = db.collection('users').doc(uid);
    batch.set(
      ref,
      {
        ...userDoc,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    seeded.push({ uid, name: v.name, distanceKm: Number(distanceKm.toFixed(2)), skills: v.skills });
  }

  await batch.commit();

  // Also seed sample SOS alerts so the coordinator dashboard has immediate
  // visual richness on first load. Idempotent — overwrites the same demo IDs.
  const seededAlerts = await seedDemoAlerts();

  return NextResponse.json({
    ok: true,
    seeded: seeded.length,
    seededAlerts: seededAlerts.length,
    centerOfArea: DEMO_CENTER,
    volunteers: seeded,
    alerts: seededAlerts,
    elapsedMs: Date.now() - startedAt,
  });
}

// ---------------------------------------------------------------------------
// Sample SOS alerts — 6 fixtures spread across Bengaluru with varied severity
// ---------------------------------------------------------------------------
type AlertFixture = {
  id: string;
  offsetKm: { dLat: number; dLng: number };
  language: 'en' | 'hi' | 'kn' | 'ta';
  cityDistrict: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  severityScore: number;
  needTypes: Array<'medical' | 'evacuation' | 'shelter' | 'food' | 'water' | 'rescue' | 'other'>;
  summary: string;
  summaryLocalized: string;
  headcount: number;
  flags: { elderly: boolean; child: boolean; pregnant: boolean; disabled: boolean; injured: boolean };
  accessibilityNotes: string | null;
  matched: boolean;
  matchedVolunteerUid?: string;
  matchScore?: number;
  matchReason?: string;
  ageMinutes: number;
};

const SAMPLE_ALERTS: AlertFixture[] = [
  {
    id: 'demo-alert-001',
    offsetKm: { dLat: -0.3, dLng: 0.2 },
    language: 'hi',
    cityDistrict: 'HSR Layout · Sector 2',
    severity: 'critical',
    severityScore: 92,
    needTypes: ['medical', 'rescue'],
    summary: 'Elderly woman with breathing difficulty stuck on 2nd floor, ground floor flooded.',
    summaryLocalized: 'दूसरी मंज़िल पर बुज़ुर्ग महिला को साँस लेने में दिक्कत, ज़मीनी मंज़िल पानी में डूबी।',
    headcount: 3,
    flags: { elderly: true, child: false, pregnant: false, disabled: false, injured: false },
    accessibilityNotes: 'stuck on 2nd floor, ground floor flooded',
    matched: true,
    matchedVolunteerUid: 'demo-volunteer-001',
    matchScore: 0.91,
    matchReason: '440 m away · Medical professional certified · medical professional, vulnerable person · historically fast responder',
    ageMinutes: 4,
  },
  {
    id: 'demo-alert-002',
    offsetKm: { dLat: 1.4, dLng: -0.8 },
    language: 'kn',
    cityDistrict: 'Koramangala · 4th Block',
    severity: 'high',
    severityScore: 74,
    needTypes: ['evacuation', 'shelter'],
    summary: 'Family of five with infant displaced after roof collapse, water rising on the lane.',
    summaryLocalized: 'ಮನೆ ಮೇಲ್ಛಾವಣಿ ಕುಸಿದು ಐದು ಜನರ ಕುಟುಂಬ ನಿರ್ಗತಿಕ; ರಸ್ತೆಯಲ್ಲಿ ನೀರು ಏರುತ್ತಿದೆ.',
    headcount: 5,
    flags: { elderly: false, child: true, pregnant: false, disabled: false, injured: false },
    accessibilityNotes: 'water rising · road blocked',
    matched: true,
    matchedVolunteerUid: 'demo-volunteer-006',
    matchScore: 0.78,
    matchReason: '1.6 km away · Driver certified · has vehicle',
    ageMinutes: 9,
  },
  {
    id: 'demo-alert-003',
    offsetKm: { dLat: 0.6, dLng: 1.2 },
    language: 'en',
    cityDistrict: 'BTM Layout · 2nd Stage',
    severity: 'high',
    severityScore: 68,
    needTypes: ['medical'],
    summary: 'Pregnant woman experiencing complications, cannot reach hospital due to flooded approach road.',
    summaryLocalized: 'Pregnant woman experiencing complications, cannot reach hospital due to flooded approach road.',
    headcount: 1,
    flags: { elderly: false, child: false, pregnant: true, disabled: false, injured: false },
    accessibilityNotes: 'approach road flooded',
    matched: false,
    ageMinutes: 2,
  },
  {
    id: 'demo-alert-004',
    offsetKm: { dLat: -1.8, dLng: -0.5 },
    language: 'ta',
    cityDistrict: 'Madiwala',
    severity: 'medium',
    severityScore: 45,
    needTypes: ['food', 'water'],
    summary: 'Group of 12 displaced families need food and drinking water, current shelter is dry.',
    summaryLocalized: 'பாதிக்கப்பட்ட 12 குடும்பங்களுக்கு உணவு மற்றும் குடிநீர் தேவை. தற்போதைய தங்குமிடம் பாதுகாப்பானது.',
    headcount: 38,
    flags: { elderly: false, child: true, pregnant: false, disabled: false, injured: false },
    accessibilityNotes: null,
    matched: true,
    matchedVolunteerUid: 'demo-volunteer-003',
    matchScore: 0.62,
    matchReason: '1.9 km away · Cook · food and water support',
    ageMinutes: 22,
  },
  {
    id: 'demo-alert-005',
    offsetKm: { dLat: 2.6, dLng: 1.7 },
    language: 'en',
    cityDistrict: 'HSR Layout · Sector 7',
    severity: 'medium',
    severityScore: 52,
    needTypes: ['rescue'],
    summary: 'Two people stranded on top of submerged auto-rickshaw at junction, water mid-thigh.',
    summaryLocalized: 'Two people stranded on top of submerged auto-rickshaw at junction, water mid-thigh.',
    headcount: 2,
    flags: { elderly: false, child: false, pregnant: false, disabled: false, injured: false },
    accessibilityNotes: 'water at mid-thigh height',
    matched: false,
    ageMinutes: 6,
  },
  {
    id: 'demo-alert-006',
    offsetKm: { dLat: -2.4, dLng: 2.1 },
    language: 'hi',
    cityDistrict: 'Bommanahalli',
    severity: 'low',
    severityScore: 18,
    needTypes: ['other'],
    summary: 'Family lost all identity documents in flood, requesting assistance for replacements.',
    summaryLocalized: 'बाढ़ में परिवार के सभी पहचान दस्तावेज़ खो गए, मदद की ज़रूरत।',
    headcount: 4,
    flags: { elderly: true, child: false, pregnant: false, disabled: false, injured: false },
    accessibilityNotes: null,
    matched: false,
    ageMinutes: 47,
  },
];

async function seedDemoAlerts(): Promise<Array<{ id: string; severity: string; matched: boolean }>> {
  const db = adminDb();
  const batch = db.batch();
  const seeded: Array<{ id: string; severity: string; matched: boolean }> = [];
  const now = Date.now();

  for (const f of SAMPLE_ALERTS) {
    const kmToDegLat = 1 / 111;
    const kmToDegLng = 1 / (111 * Math.cos((DEMO_CENTER.lat * Math.PI) / 180));
    const lat = DEMO_CENTER.lat + f.offsetKm.dLat * kmToDegLat;
    const lng = DEMO_CENTER.lng + f.offsetKm.dLng * kmToDegLng;
    const createdAtMs = now - f.ageMinutes * 60_000;

    const ref = db.collection('sos_alerts').doc(f.id);
    batch.set(ref, {
      alertId: f.id,
      citizenUid: 'demo-citizen-001',
      status: f.matched ? 'matched' : 'parsed',
      rawPhotoUrl: null,
      rawVoiceUrl: null,
      rawTextInput: null,
      inputLanguage: f.language,
      parsed: {
        needTypes: f.needTypes,
        severity: f.severity,
        severityScore: f.severityScore,
        summary: f.summary,
        summaryLocalized: f.summaryLocalized,
        headcount: f.headcount,
        vulnerabilityFlags: f.flags,
        accessibilityNotes: f.accessibilityNotes,
        confidence: 0.82,
      },
      location: new GeoPoint(lat, lng),
      geohash: encodeGeohash(lat, lng, 7),
      pincode: null,
      cityDistrict: f.cityDistrict,
      matchedVolunteerUid: f.matched ? f.matchedVolunteerUid ?? null : null,
      matchedAt: f.matched
        ? new Date(createdAtMs + Math.min(f.ageMinutes * 0.4, 6) * 60_000)
        : null,
      matchScore: f.matched ? f.matchScore ?? null : null,
      matchReason: f.matched ? f.matchReason ?? null : null,
      parsedAt: new Date(createdAtMs),
      createdAt: new Date(createdAtMs),
      resolvedAt: null,
      responseMinutes: null,
      duplicateOfAlertId: null,
      flagReason: null,
    });
    seeded.push({ id: f.id, severity: f.severity, matched: f.matched });
  }

  await batch.commit();
  return seeded;
}

export async function DELETE(_req: NextRequest) {
  if (process.env.SANKALP_DEMO_MODE !== '1') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const db = adminDb();
  const batch = db.batch();
  for (let i = 0; i < VOLUNTEERS.length; i++) {
    const uid = `demo-volunteer-${String(i + 1).padStart(3, '0')}`;
    batch.delete(db.collection('users').doc(uid));
  }
  for (const f of SAMPLE_ALERTS) {
    batch.delete(db.collection('sos_alerts').doc(f.id));
  }
  await batch.commit();
  return NextResponse.json({
    ok: true,
    removedVolunteers: VOLUNTEERS.length,
    removedAlerts: SAMPLE_ALERTS.length,
  });
}
