import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'landscape';
  lazy?: boolean;
  blur?: boolean;
  sizes?: string;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'square',
  lazy = true,
  blur = true,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  priority = false,
  onLoad,
  onError
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(!lazy || priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || priority || inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before the image enters viewport
        threshold: 0.1
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority, inView]);

  // Generate WebP and fallback URLs
  const getOptimizedSrc = (originalSrc: string, format: 'webp' | 'jpeg' = 'webp') => {
    if (!originalSrc) return '';
    
    // If it's already a WebP or if we want JPEG, return as is
    if (originalSrc.includes('.webp') || format === 'jpeg') {
      return originalSrc;
    }
    
    // Try to convert to WebP by replacing extension
    const webpSrc = originalSrc.replace(/\.(jpg|jpeg|png)$/i, '.webp');
    return format === 'webp' ? webpSrc : originalSrc;
  };

  // Generate blur placeholder (simple base64 SVG)
  const getBlurPlaceholder = () => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#grad)" />
      </svg>
    `)}`;
  };

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  const aspectRatioClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]'
  };

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden bg-gray-100 dark:bg-gray-700 ${aspectRatioClasses[aspectRatio]} ${className}`}
    >
      {/* Loading placeholder */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0">
          {blur ? (
            <img
              src={getBlurPlaceholder()}
              alt=""
              className="w-full h-full object-cover filter blur-sm scale-110"
              aria-hidden="true"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}
        </div>
      )}

      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
          <div className="text-center text-gray-400 dark:text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
            </svg>
            <p className="text-xs">Image unavailable</p>
          </div>
        </div>
      )}

      {/* Main image with WebP support */}
      {inView && !imageError && src && (
        <picture>
          <source 
            srcSet={getOptimizedSrc(src, 'webp')} 
            type="image/webp"
            sizes={sizes}
          />
          <motion.img
            ref={imgRef}
            src={getOptimizedSrc(src, 'jpeg')}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            sizes={sizes}
            loading={lazy && !priority ? 'lazy' : 'eager'}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            initial={{ scale: blur ? 1.05 : 1 }}
            animate={{ 
              scale: 1,
              opacity: imageLoaded ? 1 : 0
            }}
            transition={{ 
              duration: 0.5,
              ease: [0.25, 0.46, 0.45, 0.94] // Custom easing for smooth animation
            }}
            style={{
              // GPU acceleration
              transform: 'translateZ(0)',
              willChange: imageLoaded ? 'auto' : 'transform, opacity'
            }}
          />
        </picture>
      )}
    </div>
  );
};

export default OptimizedImage;