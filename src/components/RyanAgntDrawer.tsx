import { useState, useRef, useEffect } from 'react';
import SmartThinking from './SmartThinking';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  skills_confirmed?: string[];
  evidence_links?: { title: string; url: string }[];
  missing_info?: string[];
  trace?: string[];
  meta?: {
    blocked?: boolean;
    locked_until?: string;
    strikes?: number;
  };
};

const SUGGESTED_QUESTIONS = [
  "Does Ryan have Power BI experience?",
  "What projects prove Python skills?",
  "Show evidence of Azure Synapse experience",
  "Does Ryan have A/B testing experience?",
  "What's Ryan's strongest skill area?",
  "Can Ryan build production BI platforms?"
];

const RYAN_PHONE = "(215) 485-6592";

type RyanAgntDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function RyanAgntDrawer({ isOpen, onClose }: RyanAgntDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [lastPhoneShownAt, setLastPhoneShownAt] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      // Only scroll to bottom when new messages are added, not on initial open
      if (messages.length > 0) {
        scrollToBottom();
      }
      inputRef.current?.focus();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    // Load messages from sessionStorage on mount
    const saved = sessionStorage.getItem('ryanAgntMessages');
    const savedCount = sessionStorage.getItem('ryanAgntMessageCount');
    const savedLastPhone = sessionStorage.getItem('ryanAgntLastPhone');
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
        
        // Restore message count
        if (savedCount) {
          const count = parseInt(savedCount, 10);
          setMessageCount(count);
        } else {
          // Count user messages if count not saved
          const userMsgCount = parsed.filter((m: Message) => m.role === 'user').length;
          setMessageCount(userMsgCount);
        }
        
        // Restore last phone shown
        if (savedLastPhone) {
          setLastPhoneShownAt(parseInt(savedLastPhone, 10));
        }
        
        // Check if locked
        const lastMessage = parsed[parsed.length - 1];
        if (lastMessage?.meta?.locked_until) {
          const lockTime = new Date(lastMessage.meta.locked_until).getTime();
          if (Date.now() < lockTime) {
            setIsLocked(true);
            setLockedUntil(lastMessage.meta.locked_until);
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    // Save messages to sessionStorage
    if (messages.length > 0) {
      sessionStorage.setItem('ryanAgntMessages', JSON.stringify(messages));
      sessionStorage.setItem('ryanAgntMessageCount', messageCount.toString());
      sessionStorage.setItem('ryanAgntLastPhone', lastPhoneShownAt.toString());
    }
  }, [messages, messageCount, lastPhoneShownAt]);

  const handleSend = async () => {
    if (!input.trim() || loading || isLocked) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim()
    };

    const isMadisonMessage = userMessage.content.toLowerCase().includes('madison');
    const isAcknowledgement = /^(ok|okay|cool|thanks|thank you|got it|sounds good|nice|alright|sure|yep|yeah|yes|no|nope)$/i.test(userMessage.content.trim());

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Fast-path: minimal loading for acknowledgements
    if (!isAcknowledgement) {
      setLoading(true);
    }
    setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const requestStartTime = Date.now();
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
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.answer || errorData.error || `Error: ${response.statusText}`);
        }

        const data = await response.json();
        const requestDuration = Date.now() - requestStartTime;
      
      // Fast-path responses: add minimal delay for perceived intelligence
      if (data.meta?.fast_path && !isAcknowledgement) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Brief delay
      }
      
      // Increment message count
      const newMessageCount = messageCount + 1;
      setMessageCount(newMessageCount);
      
      // Determine if we should show phone number
      // Show after 3+ questions, then every 3 messages after that
      const shouldShowPhone = newMessageCount >= 3 && (newMessageCount - lastPhoneShownAt >= 3 || lastPhoneShownAt === 0);
      
      let answerText = data.answer || 'No answer provided.';
      if (shouldShowPhone && !data.meta?.fast_path) {
        answerText += ' For further clarification call my human friend, the real Ryan, for answers at 215-485-6592';
        setLastPhoneShownAt(newMessageCount);
      }
      
      // Display trace with delays if present and request took >700ms
      if (data.trace && Array.isArray(data.trace) && data.trace.length > 0 && requestDuration > 700) {
        // Add trace messages one by one with delays
        for (let i = 0; i < data.trace.length; i++) {
          const traceMessage: Message = {
            role: 'assistant',
            content: data.trace[i],
            skills_confirmed: [],
            evidence_links: [],
            missing_info: [],
            trace: [data.trace[i]] // Mark as trace message
          };
          setMessages(prev => [...prev, traceMessage]);
          // Delay between trace lines (150-250ms)
          if (i < data.trace.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 100));
          }
        }
        // Small delay before final answer
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: answerText,
        skills_confirmed: data.skills_confirmed || [],
        evidence_links: data.evidence_links || [],
        missing_info: data.missing_info || [],
        trace: data.trace,
        meta: data.meta
      };

      // Check if locked
      if (data.meta?.locked_until) {
        setIsLocked(true);
        setLockedUntil(data.meta.locked_until);
      }

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      
      let errorMessage = 'RyAgent hit a snag—try again, or text Ryan: ' + RYAN_PHONE;
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again, or text Ryan: ' + RYAN_PHONE;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again, or text Ryan: ' + RYAN_PHONE,
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

  const getLockedMessage = () => {
    if (!lockedUntil) return null;
    const lockTime = new Date(lockedUntil).getTime();
    const now = Date.now();
    if (now >= lockTime) {
      setIsLocked(false);
      setLockedUntil(null);
      return null;
    }
    const minutesLeft = Math.ceil((lockTime - now) / 60000);
    return `Chat locked. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`;
  };

  const lockedMessage = getLockedMessage();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-[15%] left-[10%] sm:top-0 sm:right-0 sm:left-auto h-[85%] sm:h-full w-[90%] sm:w-[420px] bg-slate-900 border-l border-slate-800 z-50 transform transition-transform duration-300 ease-out shadow-2xl rounded-t-2xl sm:rounded-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">RyAgent</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Evidence-grounded answers about skills & projects
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <p className="text-slate-400 mb-4 text-sm">Ask a question to get started:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestedQuestion(q)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 hover:bg-slate-800 hover:border-slate-600 transition-colors text-slate-300"
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
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30'
                      : msg.meta?.blocked
                      ? 'bg-red-900/20 border border-red-800/50'
                      : msg.trace && Array.isArray(msg.trace) && msg.trace.length > 0 && (!msg.skills_confirmed || msg.skills_confirmed.length === 0)
                      ? 'bg-slate-800/40 border border-slate-700/50 italic'
                      : 'bg-slate-800/60 border border-slate-700'
                  }`}
                >
                  <p className={`whitespace-pre-wrap ${
                    msg.trace && Array.isArray(msg.trace) && msg.trace.length > 0 && (!msg.skills_confirmed || msg.skills_confirmed.length === 0)
                      ? 'text-slate-400 text-xs'
                      : 'text-slate-100'
                  }`}>{msg.content}</p>

                  {msg.skills_confirmed && msg.skills_confirmed.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Skills:</p>
                      <div className="flex flex-wrap gap-1">
                        {msg.skills_confirmed.map((skill, i) => (
                          <span
                            key={i}
                            className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {msg.evidence_links && msg.evidence_links.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs font-medium text-slate-400 mb-1.5">Evidence:</p>
                      <div className="space-y-1">
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

                  {msg.missing_info && msg.missing_info.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700">
                      <p className="text-xs font-medium text-slate-500 mb-1">Not evidenced:</p>
                      <ul className="text-xs text-slate-500 space-y-0.5">
                        {msg.missing_info.map((info, i) => (
                          <li key={i} className="list-disc list-inside">{info}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <SmartThinking 
                isActive={true} 
                isMadison={messages.length > 0 && messages[messages.length - 1]?.role === 'user' && messages[messages.length - 1]?.content.toLowerCase().includes('madison')}
                isFastPath={false}
              />
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl px-3 py-2 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/40">
            {lockedMessage && (
              <div className="mb-2 px-3 py-2 bg-red-900/20 border border-red-800/50 rounded-lg text-xs text-red-300">
                {lockedMessage} Text Ryan: {RYAN_PHONE}
              </div>
            )}
            
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isLocked ? "Chat is locked..." : "Ask about skills, projects..."}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-sm"
                disabled={loading || isLocked}
              />
              <button
                onClick={handleSend}
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
