'use client';

import type { ChatSummary } from '@/lib/api';
import { useAuth } from './AuthProvider';

type Props = {
  chats: ChatSummary[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  busy: boolean;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
};

export default function Sidebar({
  chats, activeId, loading, error, busy, open, onSelect, onNew, onDelete,
}: Props) {
  const { user, logout } = useAuth();
  const name = user?.displayName || user?.email || 'Account';

  return (
    <aside className={`sidebar${open ? ' open' : ''}`} aria-label="Chat history">
      <div className="side-top">
        <button className="new-chat" onClick={onNew} disabled={busy}>
          + New chat
        </button>
      </div>

      <nav className="chat-list">
        {loading && <p className="side-note">Loading chats…</p>}
        {error && <p className="side-note err">{error}</p>}
        {!loading && !error && chats.length === 0 && (
          <p className="side-note">No chats yet. Your conversations will show up here.</p>
        )}
        <ul>
          {chats.map((c) => (
            <li key={c.id} className={`chat-item${c.id === activeId ? ' active' : ''}`}>
              <button
                className="open-chat"
                onClick={() => onSelect(c.id)}
                disabled={busy}
                title={c.title}
                aria-current={c.id === activeId ? 'page' : undefined}
              >
                {c.title}
              </button>
              <button
                className="del"
                onClick={() => onDelete(c.id)}
                disabled={busy}
                aria-label={`Delete chat: ${c.title}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="side-user">
        {user?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar fallback" aria-hidden="true">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="who">
          <strong>{name}</strong>
          {user?.displayName && user?.email && <span>{user.email}</span>}
        </div>
        <button className="ghost" onClick={() => logout()}>
          Log out
        </button>
      </div>
    </aside>
  );
}
