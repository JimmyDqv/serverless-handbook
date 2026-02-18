import { useEffect } from 'react';
import { reportWebVitals } from '../../utils/performance';

interface PerformanceMonitorProps {
  enabled?: boolean;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ 
  enabled = process.env.NODE_ENV === 'production' 
}) => {
  useEffect(() => {
    if (!enabled) return;

    // Report Web Vitals
    reportWebVitals((metric) => {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Web Vital:', metric);
      }

      // In production, you could send to analytics service
      // Example: analytics.track('Web Vital', metric);
    });

    // Monitor long tasks
    if ('PerformanceObserver' in window) {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 50) { // Tasks longer than 50ms
            console.warn('Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        });
      });

      try {
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // longtask not supported
      }

      // Monitor layout shifts
      const layoutShiftObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.value > 0.1) { // CLS threshold
            console.warn('Layout shift detected:', {
              value: entry.value,
              sources: entry.sources
            });
          }
        });
      });

      try {
        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // layout-shift not supported
      }

      // Cleanup observers
      return () => {
        longTaskObserver.disconnect();
        layoutShiftObserver.disconnect();
      };
    }
  }, [enabled]);

  return null; // This component doesn't render anything
};

export default PerformanceMonitor;