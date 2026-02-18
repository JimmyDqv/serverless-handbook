import React from 'react';

interface SkeletonProps {
  className?: string;
  shimmer?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  shimmer = true,
}) => {
  const baseClasses = 'skeleton';
  const shimmerClasses = shimmer ? 'skeleton-shimmer' : '';
  
  const classes = [baseClasses, shimmerClasses, className].join(' ');

  return <div className={classes} />;
};

// Predefined skeleton components
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div className={`card p-4 space-y-4 ${className}`}>
    <Skeleton className="h-48 w-full" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  </div>
);

export const SkeletonButton: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <Skeleton className={`h-10 w-24 rounded-lg ${className}`} />
);

export default Skeleton;