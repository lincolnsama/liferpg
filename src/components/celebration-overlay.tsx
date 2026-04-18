"use client";

import { AnimatePresence, motion } from "framer-motion";

type Props = {
  show: boolean;
};

const confettiPieces = Array.from({ length: 24 });

export default function CelebrationOverlay({ show }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
        >
          {confettiPieces.map((_, i) => (
            <motion.span
              key={i}
              className="absolute block h-2 w-2 rounded-full bg-cyan-400"
              initial={{
                x: `${(i * 31) % 100}vw`,
                y: "-5vh",
                rotate: 0,
                opacity: 0.9
              }}
              animate={{
                y: "110vh",
                rotate: 360,
                opacity: 0
              }}
              transition={{
                duration: 1.4 + (i % 4) * 0.35,
                ease: "easeOut"
              }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
