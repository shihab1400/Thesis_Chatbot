'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatSummary, deleteChat, listChats } from '@/lib/api';
import Chat from './Chat';
import Sidebar from './Sidebar';

export default function ChatApp() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [open, setOpen] = useState(false); // mobile drawer
  const [busy, setBusy] = useState(false); // a message is being sent / a chat loading

  useEffect(() => {
    listChats()
      .then(setChats)
      .catch((e) =>
        setError(
          e instanceof TypeError
            ? 'Can’t reach the server.'
            : (e as Error).message,
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const onChatSaved = useCallback((c: ChatSummary) => {
    setChats((prev) => [c, ...prev.filter((x) => x.id !== c.id)]);
    setActiveId(c.id);
  }, []);

  async function onDelete(id: string) {
    const chat = chats.find((c) => c.id === id);
    if (!window.confirm(`Delete "${chat?.title ?? 'this chat'}"? This can’t be undone.`)) return;
    try {
      await deleteChat(id);
      setChats((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeId={activeId}
        loading={loading}
        error={error}
        busy={busy}
        open={open}
        onSelect={(id) => {
          setActiveId(id);
          setOpen(false);
        }}
        onNew={() => {
          setActiveId(null);
          setResetKey((k) => k + 1);
          setOpen(false);
        }}
        onDelete={onDelete}
      />
      {open && <div className="backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="main">
        <Chat
          chatId={activeId}
          resetKey={resetKey}
          onChatSaved={onChatSaved}
          onBusyChange={setBusy}
          onOpenMenu={() => setOpen(true)}
        />
      </div>
    </div>
  );
}
