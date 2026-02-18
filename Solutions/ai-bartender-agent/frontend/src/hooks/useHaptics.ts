import { useCallback } from 'react';

type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'impact' | 'notification';

export const useHaptics = () => {
  const isHapticsSupported = useCallback(() => {
    return 'vibrate' in navigator || 'hapticFeedback' in navigator;
  }, []);

  const triggerHaptic = useCallback((type: HapticType = 'light') => {
    // Check if device supports haptics
    if (!isHapticsSupported()) return;

    // Try modern Haptic Feedback API first (iOS Safari)
    if ('hapticFeedback' in navigator) {
      try {
        switch (type) {
          case 'light':
            (navigator as any).hapticFeedback.impact('light');
            break;
          case 'medium':
            (navigator as any).hapticFeedback.impact('medium');
            break;
          case 'heavy':
            (navigator as any).hapticFeedback.impact('heavy');
            break;
          case 'selection':
            (navigator as any).hapticFeedback.selection();
            break;
          case 'notification':
            (navigator as any).hapticFeedback.notification('success');
            break;
          default:
            (navigator as any).hapticFeedback.impact('light');
        }
        return;
      } catch (error) {
        console.warn('Haptic feedback failed:', error);
      }
    }

    // Fallback to vibration API
    if ('vibrate' in navigator) {
      try {
        let pattern: number | number[];
        
        switch (type) {
          case 'light':
            pattern = 10;
            break;
          case 'medium':
            pattern = 20;
            break;
          case 'heavy':
            pattern = 50;
            break;
          case 'selection':
            pattern = [10, 10, 10];
            break;
          case 'impact':
            pattern = 30;
            break;
          case 'notification':
            pattern = [50, 50, 50];
            break;
          default:
            pattern = 10;
        }
        
        navigator.vibrate(pattern);
      } catch (error) {
        console.warn('Vibration failed:', error);
      }
    }
  }, [isHapticsSupported]);

  // Specific haptic functions for common use cases
  const hapticFeedback = {
    light: () => triggerHaptic('light'),
    medium: () => triggerHaptic('medium'),
    heavy: () => triggerHaptic('heavy'),
    selection: () => triggerHaptic('selection'),
    impact: () => triggerHaptic('impact'),
    notification: () => triggerHaptic('notification'),
    
    // Contextual haptics
    buttonTap: () => triggerHaptic('light'),
    orderPlaced: () => triggerHaptic('notification'),
    statusChange: () => triggerHaptic('medium'),
    error: () => triggerHaptic('heavy'),
    success: () => triggerHaptic('notification'),
  };

  return {
    isHapticsSupported: isHapticsSupported(),
    triggerHaptic,
    hapticFeedback,
  };
};