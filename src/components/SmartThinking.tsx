import { useState, useEffect } from 'react';

const THINKING_MESSAGES = [
  "Scanning resume for relevant experience...",
  "Analyzing skills matrix for proof points...",
  "Searching project repositories for code examples...",
  "Checking for Power BI and DAX implementations...",
  "Reviewing Azure Synapse and data pipeline work...",
  "Finding Python and data engineering projects...",
  "Locating evidence links and GitHub repos...",
  "Validating skills against portfolio evidence...",
  "Cross-referencing technologies mentioned...",
  "Preparing evidence-grounded response..."
];

const MADISON_THINKING_MESSAGES = [
  ...THINKING_MESSAGES,
  "Thinking: love message..."
];

type SmartThinkingProps = {
  isActive: boolean;
  isMadison?: boolean;
  isFastPath?: boolean;
};

export default function SmartThinking({ isActive, isMadison = false, isFastPath = false }: SmartThinkingProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedMessage, setDisplayedMessage] = useState('');

  useEffect(() => {
    if (!isActive) {
      setDisplayedMessage('');
      return;
    }

    // Fast-path: very brief display or skip
    if (isFastPath) {
      const briefMessage = "Thinking...";
      setDisplayedMessage(briefMessage);
      return;
    }

    const messages = isMadison ? MADISON_THINKING_MESSAGES : THINKING_MESSAGES;
    const messageInterval = isMadison ? 1200 : 1500; // Slightly slower for Madison

    // Cycle through messages
    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, messageInterval);

    // Typewriter effect for current message
    const currentMessage = messages[currentMessageIndex];
    let charIndex = 0;
    setDisplayedMessage('');

    const typewriter = setInterval(() => {
      if (charIndex < currentMessage.length) {
        setDisplayedMessage(currentMessage.substring(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typewriter);
      }
    }, 30);

    return () => {
      clearInterval(interval);
      clearInterval(typewriter);
    };
  }, [isActive, currentMessageIndex, isMadison, isFastPath]);

  if (!isActive) return null;

  return (
    <div className="flex justify-start">
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 max-w-[85%]">
        <div className="flex items-center gap-2 text-slate-400">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
            <div className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
            <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-xs font-mono">
            {displayedMessage}
            <span className="animate-pulse">▊</span>
          </span>
        </div>
      </div>
    </div>
  );
}
