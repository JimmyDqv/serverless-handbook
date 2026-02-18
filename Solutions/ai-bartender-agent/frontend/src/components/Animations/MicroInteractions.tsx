import React from 'react';
import { motion, MotionProps } from 'framer-motion';
import { hoverScale, tapScale, hoverLift, getTransition } from '../../utils/animations';

// Enhanced button with micro-interactions
interface InteractiveButtonProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'scale' | 'lift';
}

export const InteractiveButton: React.FC<InteractiveButtonProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  variant = 'scale',
  ...motionProps
}) => {
  const getHoverAnimation = () => {
    switch (variant) {
      case 'lift':
        return hoverLift;
      case 'scale':
      default:
        return hoverScale;
    }
  };

  return (
    <motion.button
      whileHover={disabled ? {} : getHoverAnimation()}
      whileTap={disabled ? {} : tapScale}
      transition={getTransition({ duration: 0.15, ease: 'easeOut' })}
      onClick={onClick}
      disabled={disabled}
      className={className}
      {...motionProps}
    >
      {children}
    </motion.button>
  );
};

// Interactive card with hover effects
interface InteractiveCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export const InteractiveCard: React.FC<InteractiveCardProps> = ({
  children,
  className = '',
  onClick,
  disabled = false,
  ...motionProps
}) => {
  return (
    <motion.div
      whileHover={disabled ? {} : { y: -4, scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      transition={getTransition({ duration: 0.2, ease: 'easeOut' })}
      onClick={onClick}
      className={`${className} ${onClick && !disabled ? 'cursor-pointer' : ''}`}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};

// Floating action button with pulse effect
interface FloatingButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  pulse?: boolean;
}

export const FloatingButton: React.FC<FloatingButtonProps> = ({
  children,
  onClick,
  className = '',
  pulse = false,
}) => {
  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      animate={pulse ? { scale: [1, 1.05, 1] } : {}}
      transition={
        pulse
          ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
          : getTransition({ type: 'spring', damping: 15, stiffness: 300 })
      }
      onClick={onClick}
      className={`fixed bottom-6 right-6 w-14 h-14 bg-primary-500 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-50 ${className}`}
    >
      {children}
    </motion.button>
  );
};

// Ripple effect component
interface RippleEffectProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const RippleEffect: React.FC<RippleEffectProps> = ({
  children,
  className = '',
  onClick,
}) => {
  const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const newRipple = {
      id: Date.now(),
      x,
      y,
    };
    
    setRipples(prev => [...prev, newRipple]);
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
    
    onClick?.();
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
    >
      {children}
      {ripples.map(ripple => (
        <motion.div
          key={ripple.id}
          className="absolute bg-white/30 rounded-full pointer-events-none"
          style={{
            left: ripple.x - 10,
            top: ripple.y - 10,
            width: 20,
            height: 20,
          }}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

// Magnetic button effect
interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  strength?: number;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  className = '',
  onClick,
  strength = 0.3,
}) => {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    
    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  return (
    <motion.button
      ref={buttonRef}
      animate={{ x: position.x, y: position.y }}
      transition={getTransition({ type: 'spring', damping: 20, stiffness: 300 })}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
};