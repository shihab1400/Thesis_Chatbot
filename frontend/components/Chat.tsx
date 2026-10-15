'use client';

import { useEffect, useRef, useState } from 'react';
import { ChatSummary, Message, getChat, sendMessage } from '@/lib/api';
import ThemeToggle from './ThemeToggle';

const SUGGESTIONS = [
  'What does the law say about cheating in public examinations?',
  'Who can be a member of a university syndicate?',
  'What are the powers of the Board of Intermediate and Secondary Education?',
];

type Props = {
  chatId: string | null;
  resetKey: number;
  onChatSaved: (c: ChatSummary) => void;
  onBusyChange: (busy: boolean) => void;
  onOpenMenu: () => void;
};

function errorText(e: unknown) {
  return e instanceof TypeError
    ? 'Can’t reach the server. Make sure the backend is running on port 4000.'
    : (e as Error).message;
}

export default function Chat({ chatId, resetKey, onChatSaved, onBusyChange, onOpenMenu }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // When we create a chat ourselves we already hold its messages: don't reload them.
  const skipLoadFor = useRef<string | null>(null);

  useEffect(() => {
    onBusyChange(sending || loadingChat);
  }, [sending, loadingChat, onBusyChange]);

  useEffect(() => {
    setError(null);
    if (!chatId) {
      setMessages([]);
      return;
    }
    if (skipLoadFor.current === chatId) {
      skipLoadFor.current = null;
      return;
    }
    let cancelled = false;
    setLoadingChat(true);
    setMessages([]);
    getChat(chatId)
      .then((c) => !cancelled && setMessages(c.messages))
      .catch((e) => !cancelled && setError(errorText(e)))
      .finally(() => !cancelled && setLoadingChat(false));
    return () => {
      cancelled = true;
    };
  }, [chatId, resetKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  async function send(text: string, base: Message[] = messages) {
    const content = text.trim();
    if (!content || sending || loadingChat) return;

    setMessages([...base, { role: 'user', content }]);
    setInput('');
    setError(null);
    setSending(true);

    try {
      const data = await sendMessage(chatId, content);
      setMessages((m) => [...m, { role: 'assistant', content: data.reply, sources: data.sources }]);
      if (!chatId) skipLoadFor.current = data.chatId;
      onChatSaved({ id: data.chatId, title: data.title, updatedAt: data.updatedAt });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function retry() {
    const last = messages[messages.length - 1];
    if (last?.role !== 'user') return;
    const base = messages.slice(0, -1);
    send(last.content, base);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  const canRetry = error && messages[messages.length - 1]?.role === 'user';

  return (
    <div className="shell">
      <header className="bar">
        <button className="menu-btn ghost" onClick={onOpenMenu} aria-label="Open chat history">
          ☰
        </button>
        <h1>Education Law Assistant</h1>
        <ThemeToggle />
      </header>

      <main className="thread" aria-live="polite">
        {loadingChat && <p className="hint">Loading chat…</p>}

        {!loadingChat && messages.length === 0 && !error && (
          <section className="empty">
            <h2>Ask about Bangladesh education law</h2>
            <p>Answers come from the Acts in the dataset, with the sections they used.</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <div className="col">
              <div className="bubble">{m.content}</div>
              {m.sources && m.sources.length > 0 && (
                <details className="sources">
                  <summary>Sources ({m.sources.length})</summary>
                  <ol>
                    {m.sources.map((src) => (
                      <li key={src.id}>
                        <strong>
                          {src.act}
                          {src.section ? `, Section ${src.section}` : ''}
                        </strong>
                        {src.title && <span> — {src.title}</span>}
                        <p>{src.excerpt}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="msg assistant" aria-label="Assistant is typing">
            <div className="bubble typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}

        {error && (
          <div className="error" role="alert">
            <span>{error}</span>
            {canRetry && (
              <button className="ghost" onClick={retry}>
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </main>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the assistant"
          rows={1}
          maxLength={8000}
          aria-label="Message"
        />
        <button type="submit" disabled={sending || loadingChat || !input.trim()}>
          Send
        </button>
      </form>
      <p className="note">General information only, not legal advice. Check the cited sections.</p>
    </div>
  );
}
