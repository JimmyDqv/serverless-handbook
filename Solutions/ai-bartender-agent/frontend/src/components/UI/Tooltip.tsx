import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

interface TooltipPosition {
  top: number;
  left: number;
  actualPosition: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 0,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return null;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipHeight = 32; // Approximate height
    const tooltipPadding = 8;
    const arrowSize = 6;

    let actualPosition = position;
    let top = 0;
    let left = 0;

    // Check if preferred position has enough space, otherwise flip
    if (position === 'top' && triggerRect.top < tooltipHeight + tooltipPadding + arrowSize) {
      actualPosition = 'bottom';
    } else if (position === 'bottom' && window.innerHeight - triggerRect.bottom < tooltipHeight + tooltipPadding + arrowSize) {
      actualPosition = 'top';
    }

    switch (actualPosition) {
      case 'top':
        top = triggerRect.top - tooltipPadding - arrowSize;
        left = triggerRect.left + triggerRect.width / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + tooltipPadding + arrowSize;
        left = triggerRect.left + triggerRect.width / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2;
        left = triggerRect.left - tooltipPadding - arrowSize;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2;
        left = triggerRect.right + tooltipPadding + arrowSize;
        break;
    }

    return { top, left, actualPosition };
  }, [position]);

  const showTooltip = useCallback(() => {
    const show = () => {
      const pos = calculatePosition();
      if (pos) {
        setTooltipPosition(pos);
        setIsVisible(true);
      }
    };

    if (delay > 0) {
      timeoutRef.current = setTimeout(show, delay);
    } else {
      show();
    }
  }, [calculatePosition, delay]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
    setTooltipPosition(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getTooltipStyles = (): React.CSSProperties => {
    if (!tooltipPosition) return {};

    const { top, left, actualPosition } = tooltipPosition;

    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      zIndex: 9999,
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyles,
          top: `${top}px`,
          left: `${left}px`,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: `${top}px`,
          left: `${left}px`,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          ...baseStyles,
          top: `${top}px`,
          left: `${left}px`,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          ...baseStyles,
          top: `${top}px`,
          left: `${left}px`,
          transform: 'translate(0, -50%)',
        };
    }
  };

  const getArrowStyles = (): React.CSSProperties => {
    if (!tooltipPosition) return {};

    const { actualPosition } = tooltipPosition;

    const baseStyles: React.CSSProperties = {
      position: 'absolute',
      width: 0,
      height: 0,
      borderWidth: '5px',
      borderStyle: 'solid',
    };

    switch (actualPosition) {
      case 'top':
        return {
          ...baseStyles,
          bottom: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderColor: 'rgb(17 24 39) transparent transparent transparent',
        };
      case 'bottom':
        return {
          ...baseStyles,
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          borderColor: 'transparent transparent rgb(17 24 39) transparent',
        };
      case 'left':
        return {
          ...baseStyles,
          right: '-10px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderColor: 'transparent transparent transparent rgb(17 24 39)',
        };
      case 'right':
        return {
          ...baseStyles,
          left: '-10px',
          top: '50%',
          transform: 'translateY(-50%)',
          borderColor: 'transparent rgb(17 24 39) transparent transparent',
        };
    }
  };

  const tooltipElement = isVisible && content && tooltipPosition && (
    <div
      ref={tooltipRef}
      role="tooltip"
      style={getTooltipStyles()}
      className="px-2.5 py-1.5 text-xs font-medium text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg whitespace-nowrap pointer-events-none"
    >
      {content}
      <span style={getArrowStyles()} className="dark:border-gray-700" />
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className="inline-flex"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {typeof document !== 'undefined' && createPortal(tooltipElement, document.body)}
    </>
  );
};

export default Tooltip;
