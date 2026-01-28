import { useEffect, useState } from 'react';

type ToastProps = {
  message: string;
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, onClose, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for fade out
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 animate-fade-in">
      <div className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 max-w-sm">
        <p className="text-sm text-slate-200 flex-1">{message}</p>
        <button
          onClick={() => {
            setVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
