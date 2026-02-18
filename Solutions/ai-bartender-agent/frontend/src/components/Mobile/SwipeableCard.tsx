import React, { useState } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { useHaptics } from '../../hooks/useHaptics';

interface SwipeAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  action: () => void;
}

interface SwipeableCardProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  threshold?: number;
  disabled?: boolean;
  className?: string;
}

const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  leftAction,
  rightAction,
  threshold = 100,
  disabled = false,
  className = '',
}) => {
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const { hapticFeedback } = useHaptics();
  
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-threshold, 0, threshold], [1, 0, 1]);
  const leftActionOpacity = useTransform(x, [0, threshold], [0, 1]);
  const rightActionOpacity = useTransform(x, [-threshold, 0], [1, 0]);

  const handleDragStart = () => {
    if (disabled) return;
    setIsSwipeActive(true);
    hapticFeedback.light();
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (disabled) return;
    
    setIsSwipeActive(false);
    const swipeDistance = info.offset.x;

    if (swipeDistance > threshold && rightAction) {
      hapticFeedback.success();
      rightAction.action();
    } else if (swipeDistance < -threshold && leftAction) {
      hapticFeedback.success();
      leftAction.action();
    } else {
      hapticFeedback.light();
    }

    x.set(0);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Left Action Background */}
      {leftAction && (
        <motion.div
          style={{ opacity: rightActionOpacity }}
          className={`absolute inset-y-0 left-0 right-1/2 flex items-center justify-start pl-4 ${leftAction.color}`}
        >
          <div className="flex items-center space-x-2 text-white">
            {leftAction.icon}
            <span className="font-medium">{leftAction.label}</span>
          </div>
        </motion.div>
      )}

      {/* Right Action Background */}
      {rightAction && (
        <motion.div
          style={{ opacity: leftActionOpacity }}
          className={`absolute inset-y-0 right-0 left-1/2 flex items-center justify-end pr-4 ${rightAction.color}`}
        >
          <div className="flex items-center space-x-2 text-white">
            <span className="font-medium">{rightAction.label}</span>
            {rightAction.icon}
          </div>
        </motion.div>
      )}

      {/* Card Content */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        style={{ x, opacity: isSwipeActive ? opacity : 1 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-white dark:bg-gray-800"
      >
        {children}
      </motion.div>

      {/* Swipe Indicators */}
      {isSwipeActive && (
        <div className="absolute inset-x-0 top-0 h-1 bg-gray-200 dark:bg-gray-700">
          <motion.div
            style={{ 
              scaleX: useTransform(x, [-threshold, 0, threshold], [1, 0, 1]),
              backgroundColor: useTransform(
                x, 
                [-threshold, 0, threshold], 
                [leftAction?.color || '#6B7280', '#6B7280', rightAction?.color || '#6B7280']
              )
            }}
            className="h-full origin-center"
          />
        </div>
      )}
    </div>
  );
};

export default SwipeableCard;