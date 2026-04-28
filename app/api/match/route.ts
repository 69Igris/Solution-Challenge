/**
 * SANKALP — POST /api/match
 *
 * Manually trigger the matching engine for a given alertId. Useful when:
 *   - A coordinator wants to re-match an alert (e.g., after a volunteer
 *     declines or goes offline).
 *   - Cloud Functions on Firestore writes invoke this asynchronously.
 *   - During development for debugging algorithm decisions.
 *
 * Most production traffic will *not* hit this — /api/sos calls
 * matchSosAlert() inline. This endpoint is the manual escape hatch.
 *
 * Request body:  { "alertId": "<id>" }
 * Response:      MatchOutcome JSON
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { matchSosAlert } from '@/lib/matcher';
import { adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  alertId: z.string().min(6).max(80),
  force: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  const startedAt = Date.now();

  try {
    // Authentication — coordinators or demo mode only
    const allowed = await isAllowedCaller(req);
    if (!allowed) {
      return NextResponse.json(
        { error: 'unauthorized' },
        { status: 401 },
      );
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'invalid_json', message: 'Request body must be valid JSON' },
        { status: 400 },
      );
    }

    const body = bodySchema.parse(bodyRaw);
    const outcome = await matchSosAlert(body.alertId, { force: body.force });

    return NextResponse.json(
      { ok: true, ...outcome, elapsedMs: Date.now() - startedAt },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'invalid_request', issues: err.issues },
        { status: 400 },
      );
    }
    const msg = err instanceof Error ? err.message : 'Unknown failure';
    if (msg.includes('not found')) {
      return NextResponse.json({ error: 'not_found', message: msg }, { status: 404 });
    }
    console.error('[POST /api/match] failed', { err });
    return NextResponse.json(
      { error: 'internal_error', message: msg, elapsedMs: Date.now() - startedAt },
      { status: 500 },
    );
  }
}

async function isAllowedCaller(req: NextRequest): Promise<boolean> {
  // Demo mode bypass for hackathon
  if (process.env.SANKALP_DEMO_MODE === '1') return true;

  // Production: only coordinators or service-role callers
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  try {
    const idToken = authHeader.slice(7).trim();
    const decoded = await adminAuth().verifyIdToken(idToken, true);
    // Custom claim populated when a user is promoted to coordinator
    return decoded.role === 'coordinator' || decoded.role === 'ngo_admin';
  } catch {
    return false;
  }
}
