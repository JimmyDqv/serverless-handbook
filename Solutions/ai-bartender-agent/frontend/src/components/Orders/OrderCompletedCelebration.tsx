import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
// Generate a celebration "da dum ta" sound using Web Audio API
const playCelebrationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playNote = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startTime);

      // Envelope for a pleasant sound
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;

    // "Da" - C note
    playNote(523.25, now, 0.15, 'triangle');
    // "Dum" - E note
    playNote(659.25, now + 0.15, 0.15, 'triangle');
    // "Ta!" - G note (higher, longer for emphasis)
    playNote(783.99, now + 0.3, 0.3, 'triangle');

    // Add a subtle harmony on the final note
    playNote(523.25, now + 0.3, 0.25, 'sine');

  } catch (error) {
    console.log('Audio playback not supported');
  }
};

interface OrderCompletedCelebrationProps {
  isVisible: boolean;
  onComplete?: () => void;
}

const OrderCompletedCelebration: React.FC<OrderCompletedCelebrationProps> = ({
  isVisible,
  onComplete,
}) => {
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (isVisible) {
      setShowConfetti(true);

      // Play celebration sound
      playCelebrationSound();

      // Update window size for confetti
      const updateSize = () => {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      };

      updateSize();
      window.addEventListener('resize', updateSize);

      // Stop confetti after 3 seconds
      const timer = setTimeout(() => {
        setShowConfetti(false);
        onComplete?.();
      }, 3000);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateSize);
      };
    }
  }, [isVisible, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          {/* Confetti */}
          {showConfetti && (
            <Confetti
              width={windowSize.width}
              height={windowSize.height}
              recycle={false}
              numberOfPieces={200}
              gravity={0.3}
              colors={['#00D9C0', '#8B5CF6', '#FFD93D', '#FF6B6B', '#3B82F6']}
            />
          )}

          {/* Celebration Modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ 
                type: 'spring', 
                damping: 15, 
                stiffness: 300,
                duration: 0.5 
              }}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 text-center max-w-sm mx-4 shadow-2xl"
            >
              {/* Animated Drink Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ 
                  scale: [0, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{ 
                  duration: 0.8,
                  times: [0, 0.6, 1],
                  ease: 'easeOut'
                }}
                className="text-6xl mb-4"
              >
                🍹
              </motion.div>

              {/* Success Message */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2"
              >
                🎉 Ready for Pickup!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-gray-600 dark:text-gray-400 mb-6"
              >
                Your drink is ready! Head to the bar to collect your order.
              </motion.p>

              {/* Pulsing Glow Effect */}
              <motion.div
                animate={{
                  boxShadow: [
                    '0 0 0 0 rgba(0, 217, 192, 0.4)',
                    '0 0 0 20px rgba(0, 217, 192, 0)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                className="w-16 h-16 bg-primary-500 rounded-full mx-auto flex items-center justify-center"
              >
                <span className="text-white text-2xl">✨</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OrderCompletedCelebration;