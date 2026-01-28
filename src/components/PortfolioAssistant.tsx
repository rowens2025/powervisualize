import { useState, useRef, useEffect } from 'react';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  skills_confirmed?: string[];
  evidence_links?: { title: string; url: string }[];
  missing_info?: string[];
  debugData?: any; // For debug mode
};

const SUGGESTED_QUESTIONS = [
  "Does Ryan have Power BI experience?",
  "What projects prove Python skills?",
  "Show evidence of Azure Synapse experience",
  "Does Ryan have A/B testing experience?",
  "What's Ryan's strongest skill area?",
  "Can Ryan build production BI platforms?",
  "Does Ryan have full-stack capability?",
  "Show geospatial analytics projects",
  "What DevOps tools does Ryan use?",
  "Does Ryan have data modeling experience?"
];

// Debug mode flag - set to true for local debugging
const DEBUG_MODE = false;

export default function PortfolioAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage.content,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait a moment and try again.');
        }
        // Try to parse error response
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.answer || errorData.error || `Error: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Ensure all fields exist with defaults
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer || 'No answer provided.',
        skills_confirmed: data.skills_confirmed || [],
        evidence_links: data.evidence_links || [],
        missing_info: data.missing_info || [],
        debugData: DEBUG_MODE ? data : undefined
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      let errorMessage = 'Failed to get response. Please try again.';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Always add error message to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        skills_confirmed: [],
        evidence_links: [],
        missing_info: []
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/40">
          <h2 className="text-xl font-semibold">Portfolio Assistant</h2>
          <p className="text-sm text-slate-400 mt-1">
            Ask questions about skills, projects, and experience. Answers are evidence-grounded.
          </p>
        </div>

        {/* Messages */}
        <div className="h-[500px] overflow-y-auto p-6 space-y-4 bg-slate-950/40">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-4">Ask a question to get started:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTED_QUESTIONS.slice(0, 6).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors text-slate-300"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30'
                    : 'bg-slate-800/60 border border-slate-700'
                }`}
              >
                <p className="text-slate-100 whitespace-pre-wrap">{msg.content}</p>

                {/* Skills confirmed */}
                {msg.skills_confirmed && msg.skills_confirmed.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs font-medium text-slate-400 mb-2">Skills Confirmed:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.skills_confirmed.map((skill, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-slate-300"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence links */}
                {msg.evidence_links && msg.evidence_links.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs font-medium text-slate-400 mb-2">Evidence Links:</p>
                    <div className="space-y-1.5">
                      {msg.evidence_links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-cyan-400 hover:text-cyan-300 underline truncate"
                        >
                          {link.title} →
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing info */}
                {msg.missing_info && msg.missing_info.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-xs font-medium text-slate-500 mb-2">Not evidenced on site yet:</p>
                    <ul className="text-xs text-slate-500 space-y-1">
                      {msg.missing_info.map((info, i) => (
                        <li key={i} className="list-disc list-inside">{info}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Debug mode - show raw JSON */}
                {DEBUG_MODE && msg.debugData && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <details className="text-xs">
                      <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                        Debug JSON
                      </summary>
                      <pre className="mt-2 p-2 bg-slate-900 rounded text-slate-400 overflow-auto max-h-40 text-[10px]">
                        {JSON.stringify(msg.debugData, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-xl px-4 py-3 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/40">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about skills, projects, or experience..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-900 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Send
            </button>
          </div>

          {/* Suggested questions */}
          {messages.length === 0 && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 mb-2">Suggested questions:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors text-slate-400"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800">
            Answers are based on evidence on this site and linked repos. No hallucinations.
          </p>
        </div>
      </div>
    </div>
  );
}
