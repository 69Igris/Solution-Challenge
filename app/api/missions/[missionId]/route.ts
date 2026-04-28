/**
 * SANKALP — PATCH /api/missions/[missionId]
 *
 * Mission lifecycle API. Transitions:
 *
 *   assigned → en_route       (volunteer accepts, no alert change)
 *   en_route → on_site         (alert.status = in_progress)
 *   on_site  → completed       (alert.status = resolved, free volunteer,
 *                                bump livesAssistedCount + completedMissions)
 *   *        → aborted         (alert.status reset to parsed for re-match,
 *                                free volunteer, clear matchedVolunteer*)
 *
 * All transitions run inside a Firestore transaction so the mission +
 * alert + volunteer docs stay consistent.
 *
 * Auth: in demo mode, accepts `x-demo-uid` header. In production,
 * requires Firebase Auth ID token of the assigned volunteer (or coordinator).
 */

import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue, Timestamp, type Transaction } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  status: z.enum(['en_route', 'on_site', 'completed', 'aborted']),
});

type Ctx = { params: Promise<{ missionId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const startedAt = Date.now();

  try {
    const { missionId } = await ctx.params;
    if (!missionId) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }

    const callerUid = await resolveCallerUid(req);
    if (!callerUid) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { status: nextStatus } = bodySchema.parse(await req.json());
    const db = adminDb();
    const missionRef = db.collection('missions').doc(missionId);

    const result = await db.runTransaction(async (tx) => {
      const missionSnap = await tx.get(missionRef);
      if (!missionSnap.exists) throw new MissionError('not_found', 'Mission not found');
      const mission = missionSnap.data()!;
      const alertRef = db.collection('sos_alerts').doc(mission.alertId);
      const alertSnap = await tx.get(alertRef);
      if (!alertSnap.exists) throw new MissionError('not_found', 'Alert not found');
      const alert = alertSnap.data()!;

      // Authorization: caller must be the assigned volunteer OR a coordinator.
      const isAssignee = mission.volunteerUid === callerUid;
      const isCoord = await callerIsCoordinator(tx, callerUid, db);
      if (!isAssignee && !isCoord) {
        throw new MissionError('forbidden', 'Only the assigned volunteer or a coordinator can update this mission');
      }

      const volunteerRef = db.collection('users').doc(mission.volunteerUid);
      const now = Timestamp.now();

      // Apply transitions
      switch (nextStatus) {
        case 'en_route': {
          if (mission.status !== 'assigned' && mission.status !== 'en_route') {
            throw new MissionError(
              'invalid_transition',
              `Cannot transition from ${mission.status} to en_route`,
            );
          }
          tx.update(missionRef, { status: 'en_route' });
          // alert stays at 'matched'
          break;
        }
        case 'on_site': {
          if (!['assigned', 'en_route'].includes(mission.status)) {
            throw new MissionError(
              'invalid_transition',
              `Cannot transition from ${mission.status} to on_site`,
            );
          }
          tx.update(missionRef, {
            status: 'on_site',
            arrivedAt: now,
          });
          tx.update(alertRef, { status: 'in_progress', arrivedAt: now });
          break;
        }
        case 'completed': {
          if (mission.status === 'completed' || mission.status === 'aborted') {
            throw new MissionError(
              'invalid_transition',
              `Mission already ${mission.status}`,
            );
          }
          // Compute response time
          const createdAtMs = (alert.createdAt as Timestamp | undefined)?.toMillis() ?? Date.now();
          const responseMinutes = Math.max(
            1,
            Math.round((now.toMillis() - createdAtMs) / 60_000),
          );
          const headcount = alert.parsed?.headcount ?? 1;

          tx.update(missionRef, {
            status: 'completed',
            completedAt: now,
          });
          tx.update(alertRef, {
            status: 'resolved',
            resolvedAt: now,
            responseMinutes,
          });
          tx.update(volunteerRef, {
            'volunteer.isAvailable': true,
            'volunteer.activeMissionId': null,
            'volunteer.completedMissions': FieldValue.increment(1),
            livesAssistedCount: FieldValue.increment(headcount),
            updatedAt: now,
          });
          break;
        }
        case 'aborted': {
          if (mission.status === 'completed' || mission.status === 'aborted') {
            throw new MissionError(
              'invalid_transition',
              `Mission already ${mission.status}`,
            );
          }
          tx.update(missionRef, {
            status: 'aborted',
            completedAt: now,
          });
          // Reset alert so it can be re-matched
          tx.update(alertRef, {
            status: 'parsed',
            matchedVolunteerUid: null,
            matchedAt: null,
            matchScore: null,
            matchReason: null,
          });
          tx.update(volunteerRef, {
            'volunteer.isAvailable': true,
            'volunteer.activeMissionId': null,
            updatedAt: now,
          });
          break;
        }
      }

      return {
        missionId,
        alertId: mission.alertId,
        volunteerUid: mission.volunteerUid,
        previousStatus: mission.status,
        nextStatus,
      };
    });

    return NextResponse.json(
      { ok: true, ...result, elapsedMs: Date.now() - startedAt },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'invalid_request', issues: err.issues },
        { status: 400 },
      );
    }
    if (err instanceof MissionError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.code === 'not_found' ? 404 : err.code === 'forbidden' ? 403 : 422 },
      );
    }
    console.error('[PATCH /api/missions] failed', { err });
    return NextResponse.json(
      { error: 'internal_error', message: err instanceof Error ? err.message : 'Unknown' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
class MissionError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function resolveCallerUid(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    try {
      const decoded = await adminAuth().verifyIdToken(auth.slice(7).trim(), true);
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

async function callerIsCoordinator(
  tx: Transaction,
  uid: string,
  db: ReturnType<typeof adminDb>,
): Promise<boolean> {
  try {
    const snap = await tx.get(db.collection('users').doc(uid));
    if (!snap.exists) return false;
    const role = snap.data()?.role;
    return role === 'coordinator' || role === 'ngo_admin';
  } catch {
    return false;
  }
}
