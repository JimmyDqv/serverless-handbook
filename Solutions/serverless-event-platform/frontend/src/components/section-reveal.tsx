import { motion } from "framer-motion";
import { ReactNode } from "react";

interface SectionRevealProps {
  children: ReactNode;
  className?: string;
}

export function SectionReveal({ children, className }: SectionRevealProps) {
  return (
    <motion.section
      className={`flex flex-1 flex-col justify-center ${className ?? ""}`}
      initial={{ opacity: 0, filter: "blur(12px)", y: 20 }}
      animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
      transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}
    >
      {children}
    </motion.section>
  );
}
