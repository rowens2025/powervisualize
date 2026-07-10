import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import type { ChartSpec, ChartRow } from './RyAgentChart';

// recharts is heavy and only needed on the mortgage page — load it on demand.
const RyAgentChart = lazy(() => import('./RyAgentChart'));

type Message = {
  role: 'user' | 'assistant';
  content: string;
  evidence_links?: { title: string; url: string }[];
  trace?: string[];
  chart?: { spec: ChartSpec; rows: ChartRow[] };
  meta?: { blocked?: boolean; locked_until?: string; strikes?: number };
  /** "Take it further" refinement prompts shown under a rendered chart. */
  suggestions?: string[];
  suggestHint?: string;
};

type MetricChip = { id: string; label: string; example: string; kind: 'trend' | 'breakdown'; hint?: string; followUps: string[] };

const SUGGESTED_QUESTIONS = [
  'Show me a data product where AI builds custom charts',
  'Does Ryan have Power BI experience?',
  'What projects prove Python skills?',
  'Does Ryan have A/B testing experience?',
];

// On the mortgage page — nudge visitors into the Fannie Mae data so they chart-build.
const MORTGAGE_SUGGESTIONS = [
  'Show the 30+ delinquency rate trend',
  'Which states have the most loans?',
  'Chart active UPB over time',
  'Build me a cool chart from this data',
];

const MORTGAGE_SLUG = 'mortgage-portfolio-intelligence';

type RyanAgntDrawerProps = { isOpen: boolean; onClose: () => void; vizRequest?: number };

export default function RyanAgntDrawer({ isOpen, onClose, vizRequest = 0 }: RyanAgntDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);

  // viz-builder state (mortgage page only)
  const [isMortgagePage, setIsMortgagePage] = useState(false);
  const [vizOpen, setVizOpen] = useState(false);
  const [vizMetrics, setVizMetrics] = useState<MetricChip[]>([]);
  const [vizInput, setVizInput] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    if (isOpen) {
      if (messages.length > 0) scrollToBottom();
      inputRef.current?.focus();
      // detect mortgage project page each time the drawer opens (SPA nav)
      const onMortgage = typeof window !== 'undefined' && window.location.pathname.includes(MORTGAGE_SLUG);
      setIsMortgagePage(onMortgage);
      if (onMortgage && vizMetrics.length === 0) loadVizMetrics();
    }
  }, [messages, isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Page asked to open straight into the viz builder (mortgage page callout).
  useEffect(() => {
    if (vizRequest > 0) {
      const onMortgage = typeof window !== 'undefined' && window.location.pathname.includes(MORTGAGE_SLUG);
      setIsMortgagePage(onMortgage);
      if (onMortgage) {
        setVizOpen(true);
        if (vizMetrics.length === 0) loadVizMetrics();
      }
    }
  }, [vizRequest]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const saved = sessionStorage.getItem('ryanAgntMessages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
        const last = parsed[parsed.length - 1];
        if (last?.meta?.locked_until && Date.now() < new Date(last.meta.locked_until).getTime()) {
          setIsLocked(true);
          setLockedUntil(last.meta.locked_until);
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) sessionStorage.setItem('ryanAgntMessages', JSON.stringify(messages));
  }, [messages]);

  // --- update the trailing assistant message immutably as SSE events arrive ---
  const patchLast = (mut: (m: Message) => Partial<Message>) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy[copy.length - 1];
      copy[copy.length - 1] = { ...last, ...mut(last) };
      return copy;
    });
  };

  // Stable per-browser id so the owner can group a visitor's turns in the log.
  // Anonymous (random) — not tied to any identity.
  const getSessionId = (): string | undefined => {
    try {
      const existing = localStorage.getItem('ryagent_sid');
      if (existing) return existing;
      const id: string =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `sid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem('ryagent_sid', id);
      return id;
    } catch {
      return undefined;
    }
  };

  const getPageContext = () => ({
    path: window.location.pathname,
    title: document.title,
    pageSlug: window.location.pathname.split('/').filter(Boolean).pop() || '',
    pageType: window.location.pathname.startsWith('/data-projects/')
      ? 'data-project'
      : window.location.pathname.startsWith('/dashboards/')
        ? 'dashboard'
        : window.location.pathname === '/'
          ? 'home'
          : 'other',
  });

  const handleSend = async (override?: string) => {
    const raw = override ?? input;
    if (!raw.trim() || loading || isLocked) return;
    const question = raw.trim();
    setInput('');
    setError(null);
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { role: 'assistant', content: '', evidence_links: [], trace: [] },
    ]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const resp = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, pageContext: getPageContext(), sessionId: getSessionId() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const ct = resp.headers.get('content-type') || '';
      if (!resp.ok || !ct.includes('event-stream') || !resp.body) {
        // non-streaming path: blocked / rate-limited / misconfig
        const data = await resp.json().catch(() => ({}));
        if (data.locked_until) {
          setIsLocked(true);
          setLockedUntil(data.locked_until);
        }
        patchLast(() => ({
          content: data.answer || data.error || 'Sorry, I could not answer that. Please try again.',
          meta: { blocked: !!data.blocked, locked_until: data.locked_until },
        }));
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
          const raw = buf.slice(0, nl);
          buf = buf.slice(nl + 2);
          const line = raw.split('\n').find((l) => l.startsWith('data:'));
          if (!line) continue;
          let ev: any;
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (ev.type === 'tool_end') {
            patchLast((m) => ({
              trace: [...(m.trace || []), ev.summary],
              evidence_links: mergeEvidence(m.evidence_links, ev.evidence),
            }));
          } else if (ev.type === 'chart') {
            patchLast(() => ({ chart: { spec: ev.chartSpec, rows: ev.rows } }));
          } else if (ev.type === 'text') {
            patchLast((m) => ({ content: m.content + ev.content }));
          } else if (ev.type === 'done') {
            if (ev.meta?.locked_until) {
              setIsLocked(true);
              setLockedUntil(ev.meta.locked_until);
            }
            streamDone = true;
          } else if (ev.type === 'error') {
            patchLast(() => ({ content: 'RyAgent hit a snag. Please try again, or visit the contact section.' }));
            streamDone = true;
          }
        }
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      const msg = err?.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Sorry, I encountered an error. Please try again.';
      setError(msg);
      patchLast(() => ({ content: msg }));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // --- viz builder ---
  const loadVizMetrics = async () => {
    try {
      const resp = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'list' }),
      });
      const data = await resp.json();
      if (Array.isArray(data.metrics)) {
        setVizMetrics(
          data.metrics.map((m: any) => ({
            id: m.id,
            label: m.label,
            example: m.example,
            kind: m.kind,
            hint: m.hint,
            followUps: Array.isArray(m.followUps) ? m.followUps : [],
          })),
        );
      }
    } catch {
      /* viz stays unavailable */
    }
  };

  const runViz = async (payload: { mode: 'run'; spec: { metricId: string } } | { mode: 'resolve'; description: string }, userLabel: string) => {
    if (loading) return;
    setError(null);
    setLoading(true);
    setVizOpen(false);
    setVizInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userLabel }, { role: 'assistant', content: '', trace: [] }]);
    try {
      const resp = await fetch('/api/visualize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok || !data.chartSpec) {
        patchLast(() => ({ content: data.error || 'I could not build that visualization. Try one of the example metrics.' }));
        return;
      }
      const spec: ChartSpec = data.chartSpec;
      const rows: ChartRow[] = data.rows || [];
      const metric = vizMetrics.find((m) => m.id === spec.metricId);
      patchLast(() => ({
        content: `Here's ${spec.title.toLowerCase()} from the Fannie Mae portfolio (${rows.length} data point${rows.length !== 1 ? 's' : ''}).`,
        chart: { spec, rows },
        suggestions: metric?.followUps ?? [],
        suggestHint: metric?.hint,
      }));
    } catch {
      patchLast(() => ({ content: 'The mortgage data source is unavailable right now. Please try again.' }));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const lockedMessage = (() => {
    if (!lockedUntil) return null;
    const lockTime = new Date(lockedUntil).getTime();
    if (Date.now() >= lockTime) return null;
    const minutesLeft = Math.ceil((lockTime - Date.now()) / 60000);
    return `Chat locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`;
  })();

  const isTraceOnly = (m: Message) => m.role === 'assistant' && !m.content && !m.chart && (m.trace?.length || 0) > 0;

  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />}

      <div
        className={`fixed top-[15%] left-[10%] sm:top-0 sm:right-0 sm:left-auto h-[85%] sm:h-full w-[90%] sm:w-[440px] bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-300 ease-out shadow-2xl rounded-t-2xl sm:rounded-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">RyAgent</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isMortgagePage ? 'Ask about the portfolio — or build a chart from the data' : 'Evidence-grounded answers about skills & projects'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200" aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4 text-sm">
                  {isMortgagePage ? 'Explore the Fannie Mae data — tap one to start:' : 'Ask a question to get started:'}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {(isMortgagePage ? MORTGAGE_SUGGESTIONS : SUGGESTED_QUESTIONS).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 transition-colors text-slate-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                {!isMortgagePage && (
                  <p className="mt-4 text-[11px] leading-relaxed text-slate-500 max-w-[18rem] mx-auto">
                    💡 One of the datasets — <span className="text-slate-400">Mortgage Portfolio Intelligence</span> — lets you
                    build custom charts on the fly. Just describe what you want and I&apos;ll render it live.
                  </p>
                )}
              </div>
            )}

            {messages.map((msg, idx) => {
              // skip the empty assistant placeholder until content/trace/chart streams in
              if (msg.role === 'assistant' && !msg.content && !msg.chart && !(msg.trace && msg.trace.length)) return null;
              return (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30'
                      : msg.meta?.blocked
                        ? 'bg-red-900/20 border border-red-800/50'
                        : isTraceOnly(msg)
                          ? 'bg-slate-800/40 border border-slate-700/50'
                          : 'bg-slate-800/60 border border-slate-700'
                  }`}
                >
                  {/* trace lines (search narration) */}
                  {msg.trace && msg.trace.length > 0 && (
                    <div className="space-y-0.5 mb-1">
                      {msg.trace.map((t, i) => (
                        <p key={i} className="text-[11px] text-slate-400 italic">{t}</p>
                      ))}
                    </div>
                  )}

                  {msg.content && <p className="whitespace-pre-wrap text-slate-100">{msg.content}</p>}

                  {msg.chart && (
                    <Suspense fallback={<p className="text-xs text-slate-400 mt-1">Rendering chart…</p>}>
                      <RyAgentChart spec={msg.chart.spec} rows={msg.chart.rows} />
                    </Suspense>
                  )}

                  {msg.chart && msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-700/70">
                      <p className="text-[11px] text-slate-400 mb-1.5 leading-relaxed">
                        {msg.suggestHint ?? 'Make it your own — tap a refinement and I’ll rebuild it live:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => handleSend(s)}
                            disabled={loading}
                            className="px-2 py-1 text-[11px] rounded-md border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/15 hover:border-cyan-500/50 transition-colors text-cyan-200 disabled:opacity-50"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.evidence_links && msg.evidence_links.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Evidence:</p>
                      <div className="space-y-1">
                        {msg.evidence_links.map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="block text-xs text-cyan-400 hover:text-cyan-300 underline truncate">
                            {link.title} →
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              );
            })}

            {error && <div className="bg-red-900/20 border border-red-800 rounded-xl px-3 py-2 text-red-300 text-xs">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {/* Viz composer (mortgage page) */}
          {isMortgagePage && vizOpen && (
            <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/70">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-200">Build a visualization</p>
                <button onClick={() => setVizOpen(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">Describe a chart, or pick a metric:</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {vizMetrics.slice(0, 6).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => runViz({ mode: 'run', spec: { metricId: m.id } }, m.label)}
                    disabled={loading}
                    className="px-2 py-1 text-[11px] rounded-md border border-slate-700 hover:bg-slate-800 hover:border-cyan-500/40 transition-colors text-slate-300 disabled:opacity-50"
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={vizInput}
                  onChange={(e) => setVizInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && vizInput.trim() && !loading) runViz({ mode: 'resolve', description: vizInput.trim() }, vizInput.trim());
                  }}
                  placeholder="e.g. delinquency rate over time"
                  className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                  disabled={loading}
                />
                <button
                  onClick={() => vizInput.trim() && runViz({ mode: 'resolve', description: vizInput.trim() }, vizInput.trim())}
                  disabled={!vizInput.trim() || loading}
                  className="px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold text-sm disabled:opacity-50"
                >
                  Chart
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/40">
            {lockedMessage && (
              <div className="mb-2 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg text-xs text-red-300">
                {lockedMessage} Visit the <a href="/contact" className="underline text-red-200 hover:text-red-100">contact section</a> for direct contact.
              </div>
            )}

            {isMortgagePage && !vizOpen && (
              <button
                onClick={() => {
                  setVizOpen(true);
                  if (vizMetrics.length === 0) loadVizMetrics();
                }}
                className="w-full mb-2 px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors text-cyan-300 text-sm font-medium flex items-center justify-center gap-2"
              >
                <span>📊</span> Build a visualization with RyAgent
              </button>
            )}

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isLocked ? 'Chat is locked...' : 'Ask about skills, projects...'}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm"
                disabled={loading || isLocked}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading || isLocked}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function mergeEvidence(existing: { title: string; url: string }[] = [], incoming: { title: string; url: string }[] = []) {
  const seen = new Set(existing.map((e) => e.url));
  const merged = [...existing];
  for (const e of incoming) {
    if (e && e.url && !seen.has(e.url)) {
      seen.add(e.url);
      merged.push(e);
    }
  }
  return merged.slice(0, 5);
}
