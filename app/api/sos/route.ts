/**
 * SANKALP — POST /api/sos
 *
 * The vertical slice's terminal stage on the server. Accepts a multipart
 * form upload from the Citizen SOS UI and returns the persisted alert.
 *
 * Pipeline (executed in this order, with parallelism where safe):
 *   1. Verify Firebase Auth ID token (or accept demo header in dev mode)
 *   2. Parse multipart form data (photo + voice + GPS + text + lang)
 *   3. Validate with zod
 *   4. Reserve a Firestore alertId (so Storage paths can include it)
 *   5. Parallel: upload media to Cloud Storage  ‖  parse with Gemini
 *   6. Compose SosAlertDoc and write to Firestore
 *   7. (TODO Sprint 2) trigger matching engine + FCM fanout
 *
 * Demo target: <8s p50 end-to-end (the "Definition of Done" loop).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FieldValue,
  GeoPoint,
  Timestamp,
} from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import { parseSosWithGemini, type SosParsed } from '@/lib/gemini-sos';
import { encodeGeohash } from '@/lib/geohash';
import { matchSosAlert, type MatchOutcome } from '@/lib/matcher';
import type { SupportedLanguage } from '@/types';

// ---------------------------------------------------------------------------
// Route configuration
// ---------------------------------------------------------------------------
// Node runtime — required for firebase-admin (uses Node net APIs)
export const runtime = 'nodejs';
// Generous timeout — Gemini multimodal parse + Storage upload p99 ~12s
export const maxDuration = 60;
// Never cache — every SOS is a write
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
const SUPPORTED_LANGS = [
  'en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'bn', 'gu', 'pa', 'or', 'as',
] as const;

const formSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  text: z.string().max(2000).optional().nullable(),
  language: z.enum(SUPPORTED_LANGS).default('en'),
  cityDistrict: z.string().max(120).optional().nullable(),
});

const MAX_PHOTO_BYTES = 6 * 1024 * 1024; // 6 MB
const MAX_VOICE_BYTES = 2 * 1024 * 1024; // 2 MB (~30s @ 64kbps opus)

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // 1) AUTH — verify Firebase ID token from Authorization: Bearer <token>
    const citizenUid = await resolveCitizenUid(req);
    if (!citizenUid) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'Missing or invalid ID token' },
        { status: 401 },
      );
    }

    // 2) MULTIPART PARSE
    const formData = await req.formData();

    const fields = formSchema.parse({
      lat: formData.get('lat'),
      lng: formData.get('lng'),
      text: formData.get('text'),
      language: formData.get('language') ?? 'en',
      cityDistrict: formData.get('cityDistrict'),
    });

    const photoFile = formData.get('photo');
    const voiceFile = formData.get('voice');

    const photo = isFile(photoFile)
      ? await readFile(photoFile, MAX_PHOTO_BYTES, 'photo')
      : null;
    const voice = isFile(voiceFile)
      ? await readFile(voiceFile, MAX_VOICE_BYTES, 'voice')
      : null;

    // 3) RESERVE ALERT ID — gives us a stable path for Storage uploads
    const db = adminDb();
    const alertRef = db.collection('sos_alerts').doc();
    const alertId = alertRef.id;

    // 4) PARALLEL: Storage uploads ‖ Gemini parse
    //
    // Storage is OPTIONAL. When `STORAGE_DISABLED=1` (Spark plan, no Blaze
    // billing), we skip the upload entirely and write null URLs. The Gemini
    // parse still receives the media inline as base64, so AI quality is
    // identical — only post-parse media persistence is dropped.
    //
    // We also wrap each upload in try-catch so a misconfigured bucket never
    // blocks an SOS from being recorded.
    const storageDisabled = process.env.STORAGE_DISABLED === '1';
    const bucketName =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    const photoUploadP: Promise<string | null> =
      !photo || storageDisabled
        ? Promise.resolve(null)
        : uploadMediaSafe(bucketName, alertId, 'photo', photo);

    const voiceUploadP: Promise<string | null> =
      !voice || storageDisabled
        ? Promise.resolve(null)
        : uploadMediaSafe(bucketName, alertId, 'voice', voice);

    const parsePromise: Promise<SosParsed> = parseSosWithGemini({
      photo: photo
        ? { buffer: photo.buffer, mimeType: photo.mimeType }
        : null,
      voice: voice
        ? { buffer: voice.buffer, mimeType: voice.mimeType }
        : null,
      text: fields.text ?? null,
      language: fields.language as SupportedLanguage,
      location: { lat: fields.lat, lng: fields.lng },
      cityDistrict: fields.cityDistrict ?? null,
    });

    const [rawPhotoUrl, rawVoiceUrl, parsed] = await Promise.all([
      photoUploadP,
      voiceUploadP,
      parsePromise,
    ]);

    // 5) FIRESTORE WRITE — composed SosAlertDoc
    const geohash = encodeGeohash(fields.lat, fields.lng, 7);

    const alertDoc = {
      alertId,
      citizenUid,
      status: parsed.flagged ? ('flagged' as const) : ('parsed' as const),

      // Raw inputs
      rawPhotoUrl,
      rawVoiceUrl,
      rawTextInput: fields.text ?? null,
      inputLanguage: fields.language,

      // Gemini parse output (strip our internal-only flag fields)
      parsed: {
        needTypes: parsed.needTypes,
        severity: parsed.severity,
        severityScore: parsed.severityScore,
        summary: parsed.summary,
        summaryLocalized: parsed.summaryLocalized,
        headcount: parsed.headcount,
        vulnerabilityFlags: parsed.vulnerabilityFlags,
        accessibilityNotes: parsed.accessibilityNotes,
        confidence: parsed.confidence,
      },

      // Geo
      location: new GeoPoint(fields.lat, fields.lng),
      geohash,
      pincode: null,
      cityDistrict: fields.cityDistrict ?? null,

      // Match state (filled by matching engine in Sprint 2)
      matchedVolunteerUid: null,
      matchedAt: null,
      matchScore: null,
      matchReason: null,
      parsedAt: FieldValue.serverTimestamp(),

      // Lifecycle
      createdAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      responseMinutes: null,

      // Trust
      duplicateOfAlertId: null,
      flagReason: parsed.flagReason,
    };

    await alertRef.set(alertDoc);

    // 6) Bump citizen aggregate counter (best-effort, non-blocking)
    db.collection('users').doc(citizenUid).set(
      {
        sosRaisedCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    ).catch(() => {/* don't fail the SOS on counter failure */});

    // 7) MATCHING ENGINE — only for parsed (non-flagged) alerts
    //    Wrapped in try-catch: a matching failure must NEVER fail the SOS.
    //    The alert is already persisted; matching can be retried via /api/match.
    let match: MatchOutcome | null = null;
    if (alertDoc.status === 'parsed') {
      try {
        match = await matchSosAlert(alertId);
      } catch (matchErr) {
        console.warn(
          '[match] matching failed (alert is still recorded):',
          matchErr instanceof Error ? matchErr.message : matchErr,
        );
      }
    }

    // 8) TODO Sprint 3: FCM push to matched volunteer
    //    if (match?.matched) await sendMissionPush(match.matchedVolunteerUid, alertId);

    return NextResponse.json(
      {
        ok: true,
        alertId,
        status: match?.matched ? 'matched' : alertDoc.status,
        parsed: alertDoc.parsed,
        flagReason: parsed.flagReason,
        match,
        elapsedMs: Date.now() - startedAt,
      },
      { status: 201 },
    );
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;

    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'invalid_request', issues: err.issues, elapsedMs },
        { status: 400 },
      );
    }
    if (err instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: 'payload_too_large', message: err.message, elapsedMs },
        { status: 413 },
      );
    }

    console.error('[POST /api/sos] failed', { err, elapsedMs });
    return NextResponse.json(
      {
        error: 'internal_error',
        message: err instanceof Error ? err.message : 'Unknown failure',
        elapsedMs,
      },
      { status: 500 },
    );
  }
}

// ===========================================================================
// Helpers
// ===========================================================================

class PayloadTooLargeError extends Error {}

interface ReadFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  size: number;
}

function isFile(value: FormDataEntryValue | null): value is File {
  return (
    value != null &&
    typeof value === 'object' &&
    'arrayBuffer' in value &&
    typeof (value as File).arrayBuffer === 'function'
  );
}

async function readFile(
  file: File,
  maxBytes: number,
  field: 'photo' | 'voice',
): Promise<ReadFile> {
  if (file.size > maxBytes) {
    throw new PayloadTooLargeError(
      `${field} exceeds ${(maxBytes / 1024 / 1024).toFixed(1)}MB limit`,
    );
  }
  const ab = await file.arrayBuffer();
  return {
    buffer: Buffer.from(ab),
    mimeType: file.type || (field === 'photo' ? 'image/jpeg' : 'audio/webm'),
    fileName: file.name || `${field}.bin`,
    size: file.size,
  };
}

/**
 * Resilient wrapper around `uploadMedia` — never throws.
 *
 * Catches any error (Storage not enabled on Spark plan, bucket missing,
 * permission denied, network blip) and resolves with null. The SOS
 * pipeline must never fail because of optional media persistence.
 */
async function uploadMediaSafe(
  bucketName: string | undefined,
  alertId: string,
  kind: 'photo' | 'voice',
  file: ReadFile,
): Promise<string | null> {
  try {
    const bucket = bucketName
      ? adminStorage().bucket(bucketName)
      : adminStorage().bucket();
    return await uploadMedia(bucket, alertId, kind, file);
  } catch (err) {
    // Common cause on Spark plan: "The specified bucket does not exist"
    // or "Firebase Storage has not been set up on project ...".
    // We log once and continue — the AI parse still has the inline buffer.
    console.warn(
      `[upload] ${kind} skipped — storage unavailable:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Upload media to Firebase Storage and return a 7-day v4 signed URL.
 * Path convention: `sos/{alertId}/{kind}.{ext}`
 */
async function uploadMedia(
  bucket: ReturnType<ReturnType<typeof adminStorage>['bucket']>,
  alertId: string,
  kind: 'photo' | 'voice',
  file: ReadFile,
): Promise<string> {
  const ext = extFromMime(file.mimeType, kind);
  const objectPath = `sos/${alertId}/${kind}.${ext}`;
  const obj = bucket.file(objectPath);

  await obj.save(file.buffer, {
    contentType: file.mimeType,
    resumable: false,
    metadata: {
      cacheControl: 'private, max-age=604800',
      metadata: { kind, alertId },
    },
  });

  const [signedUrl] = await obj.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  return signedUrl;
}

function extFromMime(mime: string, kind: 'photo' | 'voice'): string {
  const m = mime.toLowerCase();
  if (kind === 'photo') {
    if (m.includes('png')) return 'png';
    if (m.includes('webp')) return 'webp';
    if (m.includes('heic')) return 'heic';
    return 'jpg';
  }
  if (m.includes('webm')) return 'webm';
  if (m.includes('ogg')) return 'ogg';
  if (m.includes('mp4') || m.includes('m4a')) return 'm4a';
  if (m.includes('wav')) return 'wav';
  return 'bin';
}

/**
 * Resolve the citizen's UID from the Authorization header.
 * In `SANKALP_DEMO_MODE=1` we additionally allow `x-demo-uid` so judges
 * can fire SOS from any device without phone-OTP onboarding mid-demo.
 */
async function resolveCitizenUid(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const idToken = authHeader.slice(7).trim();
    try {
      const decoded = await adminAuth().verifyIdToken(idToken, true);
      return decoded.uid;
    } catch {
      return null;
    }
  }

  if (process.env.SANKALP_DEMO_MODE === '1') {
    const demoUid = req.headers.get('x-demo-uid');
    if (demoUid && /^[A-Za-z0-9_-]{6,64}$/.test(demoUid)) return demoUid;
  }

  return null;
}
