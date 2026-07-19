import { useState, useRef, useEffect } from 'react';
import type { SportsDashboardOp, SportsTileContext } from './sportsTypes';

/**
 * RyAgent panel for the MLB sports page — a docked side panel (Intelligence-
 * style: slides in from the right, the dashboard stays visible and mutates live)
 * rather than a pop-up. One conversation both BUILDS the dashboard (streamed
 * ops from /api/sports/chat) and ANSWERS questions from governed queries. It
 * can also kick off the ingest job to pull fresh scores.
 */

type Message = {
  role: 'user' | 'assistant';
  content: string;
  trace?: string[];
  status?: string;
};

const SUGGESTIONS = [
  'Build me a complete standings dashboard',
  'Who has the best run differential?',
  'Chart the Dodgers’ wins over the season',
  'Pull in the latest games',
];

const TOOL_STATUS: Record<string, string> = {
  query_data: 'Querying the warehouse…',
  add_stat: 'Adding a KPI…',
  update_stat: 'Updating a KPI…',
  add_chart: 'Adding a chart…',
  update_chart: 'Updating a chart…',
  refresh_data: 'Running the ingest job…',
};

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
  tiles: SportsTileContext[];
  onApplyOp: (op: SportsDashboardOp) => void;
  getSessionId: () => string | undefined;
};

export default function SportsRyAgentPanel({ open, onClose, tiles, onApplyOp, getSessionId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Read the freshest tiles at send time (props can lag inside a closure).
  const tilesRef = useRef<SportsTileContext[]>(tiles);
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
    // Refresh jobs hit ESPN for several days — allow more time than a plain chat.
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const resp = await fetch('/api/sports/chat', {
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
          else if (ev.type === 'tool_start') patchLast(() => ({ status: TOOL_STATUS[ev.name] || 'Working on your dashboard…' }));
          else if (ev.type === 'tool_end') patchLast((m) => ({ trace: [...(m.trace || []), ev.summary], status: 'Composing…' }));
          else if (ev.type === 'dashboard_op') onApplyOp(ev.op as SportsDashboardOp);
          else if (ev.type === 'text') patchLast((m) => ({ content: m.content + ev.content, status: undefined }));
          else if (ev.type === 'done') streamDone = true;
          else if (ev.type === 'error') {
            patchLast(() => ({ content: 'RyAgent hit a snag. Please try again.', status: undefined }));
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
    <>
      {/* Mobile backdrop only — on desktop the dashboard stays interactive beside the panel. */}
      <div className="fixed inset-0 z-[55] bg-black/50 lg:hidden" onClick={onClose} />
      <aside
        className="fixed z-[60] inset-x-0 bottom-0 h-[82vh] lg:inset-x-auto lg:right-0 lg:top-0 lg:bottom-0 lg:h-auto lg:w-[400px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-700 shadow-2xl flex flex-col rounded-t-2xl lg:rounded-none"
        aria-label="RyAgent sports panel"
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>🤖</span>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">RyAgent</h3>
              <p className="text-[11px] text-slate-400">Ask about the data or tell me what to build</p>
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
              <p className="text-slate-400 text-sm mb-3">
                I can build entire dashboards, reshape single charts, answer questions with live numbers, and pull fresh games into the warehouse.
              </p>
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
                Everything runs through a governed semantic layer — RyAgent picks curated metrics and filters, never raw SQL.
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
              placeholder="e.g. build me a standings dashboard"
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
      </aside>
    </>
  );
}
