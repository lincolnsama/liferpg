"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

type VictoryOverlayProps = {
  open: boolean;
  lootLabel: string;
  /** 如 STR +0.1 */
  statFloatLabel: string;
  onContinue: () => void;
};

export default function VictoryOverlay({ open, lootLabel, statFloatLabel, onContinue }: VictoryOverlayProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-600/40 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center justify-center gap-2 text-amber-200">
          <Sparkles className="h-6 w-6" />
          <h2 className="text-xl font-semibold tracking-wide">胜利</h2>
        </div>

        <div className="relative mb-10 flex h-32 items-center justify-center">
          <motion.div
            initial={{ rotate: -8, scale: 0.4, x: 0, y: 0, opacity: 0 }}
            animate={{
              rotate: [0, 360, 380],
              scale: [0.4, 1.1, 1],
              x: [0, 40, 120],
              y: [0, -30, -80],
              opacity: [0, 1, 0.85]
            }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="pointer-events-none absolute rounded-xl border border-amber-500/60 bg-amber-950/80 px-4 py-3 text-sm font-medium text-amber-100 shadow-lg"
          >
            战利品
          </motion.div>
          <p className="max-w-xs text-center text-sm text-slate-300">{lootLabel}</p>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: -28 }}
          transition={{ delay: 0.4, duration: 1.2, ease: "easeOut" }}
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 text-lg font-bold text-emerald-300 drop-shadow-[0_0_12px_rgba(52,211,153,0.6)]"
        >
          {statFloatLabel}
        </motion.p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className="flex-1 rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500"
          >
            继续冒险
          </button>
          <Link
            href="/"
            className="flex flex-1 items-center justify-center rounded-lg border border-slate-600 py-2.5 text-center text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            返回城镇
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}
