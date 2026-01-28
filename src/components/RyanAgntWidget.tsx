import { useState, useEffect } from 'react';
import RyanAgntDrawer from './RyanAgntDrawer';
import Toast from './Toast';

type RyanAgntWidgetProps = {
  isHomePage?: boolean;
};

export default function RyanAgntWidget({ isHomePage = false }: RyanAgntWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showThoughtBubble, setShowThoughtBubble] = useState(false);

  useEffect(() => {
    // Check if toast was already shown this session
    const toastShown = sessionStorage.getItem('ryanAgntToastShown');
    if (!toastShown && isHomePage) {
      // Show thought bubble immediately on home page
      setShowThoughtBubble(true);
      
      // Hide thought bubble after 4 seconds
      const bubbleTimer = setTimeout(() => {
        setShowThoughtBubble(false);
      }, 4000);

      // Show toast after 2 seconds
      const toastTimer = setTimeout(() => {
        setShowToast(true);
        sessionStorage.setItem('ryanAgntToastShown', 'true');
      }, 2000);

      // Stop bounce animation after 5 seconds
      const bounceTimer = setTimeout(() => {
        setHasAnimated(true);
      }, 5000);

      return () => {
        clearTimeout(bubbleTimer);
        clearTimeout(toastTimer);
        clearTimeout(bounceTimer);
      };
    } else {
      setHasAnimated(true); // Skip animations if toast was already shown
    }
  }, [isHomePage]);

  // Position classes based on page
  const positionClasses = isHomePage
    ? 'relative inline-block' // Inline on home page
    : 'fixed bottom-6 right-6 z-50';

  return (
    <>
      {/* Floating Button with Thought Bubble */}
      <div className={positionClasses}>
        {/* Thought Bubble */}
        {showThoughtBubble && isHomePage && (
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 animate-fade-in z-[101]">
            <div className="relative bg-white text-slate-900 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold whitespace-nowrap border-2 border-cyan-400/30">
              <span>💭 Ask me anything about Ryan's skills!</span>
              {/* Bubble tail */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[12px] border-transparent border-t-white"></div>
              </div>
            </div>
          </div>
        )}

        {/* Button */}
        <button
          onClick={() => setIsOpen(true)}
          className={`px-6 py-4 rounded-2xl text-slate-900 font-bold text-base shadow-2xl hover:shadow-cyan-500/50 transition-all duration-300 hover:scale-110 active:scale-95 ${
            !hasAnimated && isHomePage 
              ? 'animate-bounce-subtle animate-gradient-shift' 
              : hasAnimated && isHomePage
              ? 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 opacity-50'
              : 'bg-gradient-to-r from-cyan-400 to-fuchsia-500'
          }`}
          style={
            !hasAnimated && isHomePage
              ? {
                  background: 'linear-gradient(90deg, #22d3ee, #a855f7, #22d3ee)',
                  backgroundSize: '200% 100%',
                  animation: 'gradient-shift 3s ease infinite, bounce-subtle 0.6s ease infinite'
                }
              : undefined
          }
          aria-label="Open RyAgent"
        >
          <div className="flex items-center gap-2">
            <span>💬</span>
            <span>RyAgent</span>
          </div>
        </button>
      </div>

      {/* Toast - only show on non-home pages */}
      {showToast && !isHomePage && (
        <Toast
          message="Message RyAgent to learn more"
          onClose={() => setShowToast(false)}
        />
      )}

      {/* Drawer */}
      <RyanAgntDrawer isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
