'use client';

import { useState } from 'react';
import { firebaseConfigured } from '@/lib/firebase';
import { useAuth } from './AuthProvider';
import ThemeToggle from './ThemeToggle';

function explain(code?: string): string | null {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // user changed their mind, not an error
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled. Turn it on in Firebase under Authentication → Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export default function Login() {
  const { signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(explain((e as { code?: string }).code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login-theme">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <h1>Education Law Assistant</h1>
        <p>
          Ask questions about Bangladesh education law. Sign in to save your chats and
          come back to them later.
        </p>

        {!firebaseConfigured ? (
          <div className="error" role="alert">
            <span>
              Firebase isn’t configured yet. Fill in the NEXT_PUBLIC_FIREBASE_* values in
              frontend/.env.local and restart the dev server.
            </span>
          </div>
        ) : (
          <>
            <button className="google" onClick={onClick} disabled={busy}>
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7.1l7.3 5.7c4.3-4 6.8-9.9 6.8-17.3z" />
                <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-2.9-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.5 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.9 2.3-8.6 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
              {busy ? 'Signing in…' : 'Continue with Google'}
            </button>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <p className="fine">New here? Signing in with Google creates your account automatically.</p>
          </>
        )}
      </div>
    </main>
  );
}
