import React from 'react';
import { motion } from 'framer-motion';
import { pageVariants, getAnimationVariants } from '../../utils/animations';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={getAnimationVariants(pageVariants)}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export default PageTransition;