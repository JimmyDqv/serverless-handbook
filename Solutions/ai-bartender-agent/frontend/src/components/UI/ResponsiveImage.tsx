import React, { useState, useRef, useEffect } from 'react';

type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large';

interface ResponsiveImageProps {
  drinkId: string;
  size: ImageSize;
  alt: string;
  className?: string;
  lazy?: boolean;
  cacheBuster?: string;  // Optional timestamp or version to bust cache
  objectFit?: 'cover' | 'contain' | 'fill';
}

const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN;

const getImageUrl = (drinkId: string, size: ImageSize, cacheBuster?: string): string => {
  const baseUrl = `${CLOUDFRONT_DOMAIN}/images/optimized/${size}/${drinkId}.webp`;
  // Add cache buster if provided to force refresh
  return cacheBuster ? `${baseUrl}?v=${cacheBuster}` : baseUrl;
};

const getImageDimensions = (size: ImageSize): { width: number; height: number } => {
  const dimensions = {
    thumbnail: { width: 150, height: 150 },
    small: { width: 400, height: 400 },
    medium: { width: 800, height: 800 },
    large: { width: 1200, height: 1200 },
  };
  return dimensions[size];
};

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  drinkId,
  size,
  alt,
  className = '',
  lazy = true,
  cacheBuster,
  objectFit = 'cover',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [inView, setInView] = useState(!lazy);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || inView) return;

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
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, inView]);

  const handleLoad = () => {
    setImageLoaded(true);
  };

  const handleError = () => {
    setImageError(true);
  };

  const dimensions = getImageDimensions(size);
  const imageUrl = getImageUrl(drinkId, size, cacheBuster);

  // Generate srcset for different pixel densities
  const srcSet = `${imageUrl} 1x`;

  const objectFitClass = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
  }[objectFit];

  if (imageError) {
    // Fallback: Show emoji placeholder - fills the container
    return (
      <div
        ref={containerRef}
        className={`flex items-center justify-center bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20 ${className}`}
      >
        <span className="text-6xl" role="img" aria-label={alt}>
          🍹
        </span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} ref={containerRef}>
      {/* Placeholder while loading - fills the container */}
      {!imageLoaded && inView && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 animate-pulse" />
      )}

      {/* Actual image - fills the container with object-fit */}
      {inView && (
        <img
          src={imageUrl}
          srcSet={srcSet}
          alt={alt}
          width={dimensions.width}
          height={dimensions.height}
          loading={lazy ? 'lazy' : 'eager'}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full ${objectFitClass} transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
};
