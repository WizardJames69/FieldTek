import React from "react";
import { motion, type Variants } from "framer-motion";

interface AnimatedGroupProps {
  children: React.ReactNode;
  variants: {
    container: Variants;
    item: Variants;
  };
  className?: string;
}

export function AnimatedGroup({ children, variants, className }: AnimatedGroupProps) {
  return (
    <motion.div
      variants={variants.container}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div variants={variants.item}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
