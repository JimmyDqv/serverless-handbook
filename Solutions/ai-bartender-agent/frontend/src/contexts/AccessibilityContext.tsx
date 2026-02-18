import React, { createContext, useContext, useEffect, useState } from 'react';
import { announceToScreenReader, prefersReducedMotion, prefersHighContrast } from '../utils/accessibility';

interface AccessibilityContextType {
  // Motion preferences
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  
  // Contrast preferences
  highContrast: boolean;
  setHighContrast: (enabled: boolean) => void;
  
  // Text size
  textSize: 'small' | 'medium' | 'large';
  setTextSize: (size: 'small' | 'medium' | 'large') => void;
  
  // Screen reader announcements
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  
  // Focus management
  focusMode: boolean;
  setFocusMode: (enabled: boolean) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (context === undefined) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

export const AccessibilityProvider: React.FC<AccessibilityProviderProps> = ({ children }) => {
  const [reducedMotion, setReducedMotionState] = useState(() => {
    const saved = localStorage.getItem('accessibility-reduced-motion');
    return saved ? JSON.parse(saved) : prefersReducedMotion();
  });
  
  const [highContrast, setHighContrastState] = useState(() => {
    const saved = localStorage.getItem('accessibility-high-contrast');
    return saved ? JSON.parse(saved) : prefersHighContrast();
  });
  
  const [textSize, setTextSizeState] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('accessibility-text-size');
    return saved ? saved as 'small' | 'medium' | 'large' : 'medium';
  });
  
  const [focusMode, setFocusModeState] = useState(() => {
    const saved = localStorage.getItem('accessibility-focus-mode');
    return saved ? JSON.parse(saved) : false;
  });

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Reduced motion
    if (reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    // High contrast
    if (highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    // Text size
    root.classList.remove('text-small', 'text-medium', 'text-large');
    root.classList.add(`text-${textSize}`);
    
    // Focus mode
    if (focusMode) {
      root.classList.add('focus-mode');
    } else {
      root.classList.remove('focus-mode');
    }
  }, [reducedMotion, highContrast, textSize, focusMode]);

  // Listen for system preference changes
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: high)');
    
    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('accessibility-reduced-motion')) {
        setReducedMotionState(e.matches);
      }
    };
    
    const handleContrastChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('accessibility-high-contrast')) {
        setHighContrastState(e.matches);
      }
    };
    
    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);
    
    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  const setReducedMotion = (enabled: boolean) => {
    setReducedMotionState(enabled);
    localStorage.setItem('accessibility-reduced-motion', JSON.stringify(enabled));
  };

  const setHighContrast = (enabled: boolean) => {
    setHighContrastState(enabled);
    localStorage.setItem('accessibility-high-contrast', JSON.stringify(enabled));
  };

  const setTextSize = (size: 'small' | 'medium' | 'large') => {
    setTextSizeState(size);
    localStorage.setItem('accessibility-text-size', size);
  };

  const setFocusMode = (enabled: boolean) => {
    setFocusModeState(enabled);
    localStorage.setItem('accessibility-focus-mode', JSON.stringify(enabled));
  };

  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  };

  const value = {
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    textSize,
    setTextSize,
    focusMode,
    setFocusMode,
    announce,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
};