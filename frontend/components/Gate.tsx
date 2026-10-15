'use client';

import { useAuth } from './AuthProvider';
import ChatApp from './ChatApp';
import Login from './Login';

export default function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <div className="splash">Loading…</div>;
  if (!user) return <Login />;
  return <ChatApp />;
}
