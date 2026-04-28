'use client';

/**
 * SANKALP — Auth Hooks (client-only)
 *
 * Live Firebase Auth state, with automatic anonymous sign-in for
 * unauthenticated visitors. The coordinator dashboard, citizen pages,
 * and volunteer screens all call `useEnsureAuth()` to guarantee an
 * `auth.uid` is available before any Firestore subscription fires.
 *
 * Why anonymous sign-in:
 *   - Firestore rules require `request.auth != null` to read sos_alerts
 *     and volunteer profiles in our demo posture.
 *   - Phone-OTP onboarding lands in Sprint 4; until then, anonymous auth
 *     gives every visitor a stable uid for security-rule evaluation.
 *
 * Production path: when a user completes phone-OTP, `linkWithCredential`
 * upgrades the anonymous account to a phone account, preserving uid.
 */

import { useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  /** True until the first auth state callback fires. */
  loading: boolean;
  /** Set if anonymous sign-in fails (e.g. Anonymous Auth is disabled in console). */
  error: Error | null;
}

export function useEnsureAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const signingInRef = useRef(false);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsub = onAuthStateChanged(
      auth,
      async (u) => {
        if (u) {
          setState({ user: u, loading: false, error: null });
          return;
        }
        // No session — auto sign-in anonymously (idempotent guard against
        // double calls during React Strict Mode double-mounting).
        if (signingInRef.current) return;
        signingInRef.current = true;
        try {
          const cred = await signInAnonymously(auth);
          setState({ user: cred.user, loading: false, error: null });
        } catch (err) {
          const e = err instanceof Error ? err : new Error(String(err));
          setState({
            user: null,
            loading: false,
            // Most common cause: Anonymous Auth not enabled in Firebase Console.
            error: e,
          });
        } finally {
          signingInRef.current = false;
        }
      },
      (err) => {
        setState({ user: null, loading: false, error: err });
      },
    );

    return unsub;
  }, []);

  return state;
}
