import { useState, useRef, useEffect } from 'react';
import type { DashboardOp, TileContext } from './dashboardTypes';

/**
 * RyAgent Dashboard Builder — a pop-up chat, separate from the main RyAgent
 * drawer, that composes and edits the mortgage dashboard by conversation.
 * It streams dashboard operations from /api/dashboard-chat and hands each one to
 * the composer (onApplyOp) to mutate the live grid. Every message is logged to
 * Neon server-side (intent 'dashboard-builder').
 */

type Message = {
  role: 'user' | 'assistant';
  content: string;
  trace?: string[];
  status?: string;
};

const SUGGESTIONS = [
  'Build me a delinquency-focused dashboard',
  'Add loans by state for purchase loans only',
  'Show originations by year for California',
  'Sort the states chart and show the top 5',
];

function Dots({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="flex gap-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400/90 animate-pulse" style={{ animationDelay: `${i * 220}ms`, animationDuration: '1.1s' }} />
        ))}
      </span>
      <span className="text-[11px] italic text-slate-400">{label || 'Thinking…'}</span>
    </div>
  );
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Latest dashboard tiles, recomputed by the parent each render. */
  tiles: TileContext[];
  onApplyOp: (op: DashboardOp) => void;
  getSessionId: () => string | undefined;
};

export default function RyAgentDashboardBuilder({ open, onClose, tiles, onApplyOp, getSessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read the freshest tiles at send time (props can lag inside a closure).
  const tilesRef = useRef<TileContext[]>(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, messages]);

  const patchLast = (mut: (m: Message) => Partial<Message>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      copy[copy.length - 1] = { ...copy[copy.length - 1], ...mut(copy[copy.length - 1]) };
      return copy;
    });
  };

  const getPageContext = () => ({
    path: window.location.pathname,
    title: document.title,
    pageSlug: window.location.pathname.split('/').filter(Boolean).pop() || '',
    pageType: 'data-project',
  });

  const send = async (override?: string) => {
    const raw = override ?? input;
    if (!raw.trim() || loading) return;
    const question = raw.trim();
    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: question }, { role: 'assistant', content: '', trace: [], status: 'Thinking…' }]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const resp = await fetch('/api/dashboard-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          dashboard: tilesRef.current,
          pageContext: getPageContext(),
          sessionId: getSessionId(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok || !ct.includes('event-stream') || !resp.body) {
        const data = await resp.json().catch(() => ({}));
        patchLast(() => ({ content: data.error || 'Sorry, I could not do that. Please try again.', status: undefined }));
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n\n')) !== -1) {
          const line = buf.slice(0, nl).split('\n').find((l) => l.startsWith('data:'));
          buf = buf.slice(nl + 2);
          if (!line) continue;
          let ev: any;
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (ev.type === 'thinking') patchLast(() => ({ status: 'Thinking…' }));
          else if (ev.type === 'tool_start') patchLast(() => ({ status: 'Updating your dashboard…' }));
          else if (ev.type === 'tool_end') patchLast((m) => ({ trace: [...(m.trace || []), ev.summary], status: 'Composing…' }));
          else if (ev.type === 'dashboard_op') onApplyOp(ev.op as DashboardOp);
          else if (ev.type === 'text') patchLast((m) => ({ content: m.content + ev.content, status: undefined }));
          else if (ev.type === 'done') streamDone = true;
          else if (ev.type === 'error') {
            patchLast(() => ({ content: 'The builder hit a snag. Please try again.', status: undefined }));
            streamDone = true;
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      patchLast(() => ({ content: err?.name === 'AbortError' ? 'That took too long — please try again.' : 'Something went wrong. Please try again.', status: undefined }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:w-[460px] h-[80vh] sm:h-[600px] bg-slate-900 border border-slate-700 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>🤖</span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">RyAgent Dashboard Builder</h3>
              <p className="text-[11px] text-slate-400">Build & edit your dashboard by chatting</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
          {messages.length === 0 && (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm mb-3">Tell me what to build — I’ll add and edit charts live.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 text-slate-300"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-slate-500 max-w-[20rem] mx-auto leading-relaxed">
                Try “limit it by dimension” — e.g. <span className="text-slate-400">purchase loans only</span> or <span className="text-slate-400">just California</span>.
              </p>
            </div>
          )}

          {messages.map((msg, idx) => {
            const pending = msg.role === 'assistant' && loading && idx === messages.length - 1 && !msg.content;
            if (msg.role === 'assistant' && !msg.content && !(msg.trace && msg.trace.length) && !pending) return null;
            return (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user' ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30' : 'bg-slate-800/60 border border-slate-700'
                  }`}
                >
                  {msg.trace && msg.trace.length > 0 && (
                    <div className="space-y-0.5 mb-1">
                      {msg.trace.map((t, i) => (
                        <p key={i} className="text-[11px] text-cyan-300/80 italic">✓ {t}</p>
                      ))}
                    </div>
                  )}
                  {pending && <Dots label={msg.status} />}
                  {msg.content && <p className="whitespace-pre-wrap text-slate-100">{msg.content}</p>}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="e.g. add loans by state, purchase only"
              disabled={loading}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
