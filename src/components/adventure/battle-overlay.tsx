"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ADVENTURE_SCENE_BACKDROP, backdropKeyFromSceneName } from "@/lib/adventure-run-ui";
import { cn } from "@/lib/utils";

type BattleOverlayProps = {
  open: boolean;
  sceneName: string;
  monsterName: string;
  /** 预生成、已 pad 到与 durationSec 等长的战报行 */
  logLines: string[];
  durationSec: number;
  onFlee: () => void;
  /** 倒计时自然结束视为专注完成 → 胜利 */
  onTimeVictory: () => void;
};

export default function BattleOverlay({
  open,
  sceneName,
  monsterName,
  logLines,
  durationSec,
  onFlee,
  onTimeVictory
}: BattleOverlayProps) {
  const [remaining, setRemaining] = useState(durationSec);
  const [ended, setEnded] = useState(false);
  const victoryFired = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);
  const backdropKey = backdropKeyFromSceneName(sceneName);
  const bg = ADVENTURE_SCENE_BACKDROP[backdropKey];

  useEffect(() => {
    if (!open) return;
    setRemaining(durationSec);
    setEnded(false);
    victoryFired.current = false;
  }, [open, durationSec, logLines]);

  useEffect(() => {
    if (!open || ended) return;
    const t = window.setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open, ended]);

  useEffect(() => {
    if (!open || ended || remaining > 0) return;
    if (victoryFired.current) return;
    victoryFired.current = true;
    setEnded(true);
    onTimeVictory();
  }, [open, ended, remaining, onTimeVictory]);

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [remaining, open, logLines.length]);

  if (!open) return null;

  const elapsed = durationSec - remaining;
  const progress = durationSec > 0 ? Math.min(1, elapsed / durationSec) : 1;
  const lineCount = Math.max(1, logLines.length);
  const shownLines = logLines.slice(0, Math.min(lineCount, Math.ceil(progress * lineCount)));
  const monsterHpPct = Math.max(0, Math.round((1 - progress) * 100));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col text-slate-100"
      style={{ background: bg }}
    >
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" />

      <header className="relative z-10 border-b border-white/10 px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 md:flex-row md:justify-center md:gap-8">
          <span className="text-sm font-semibold tracking-widest text-white/90">你</span>
          <span className="rounded-full border border-amber-500/40 bg-black/30 px-3 py-0.5 text-xs text-amber-200">VS</span>
          <div className="text-center md:text-left">
            <p className="text-lg font-semibold text-white">{monsterName}</p>
            <p className="text-[11px] text-white/60">{sceneName}</p>
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-md">
          <div className="mb-1 flex justify-between text-[11px] text-rose-100/80">
            <span>魔物 HP</span>
            <span>{monsterHpPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-rose-600 to-orange-400"
              animate={{ width: `${monsterHpPct}%` }}
              transition={{ type: "tween", ease: "linear", duration: 0.35 }}
            />
          </div>
        </div>
      </header>

      <div
        ref={logRef}
        className="relative z-10 mx-auto mt-4 flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-2 overflow-y-auto rounded-xl border border-white/10 bg-black/35 px-4 py-4 text-sm leading-relaxed shadow-inner md:px-6"
      >
        {shownLines.map((line, i) => (
          <p key={i} className="text-slate-100/95">
            {line}
          </p>
        ))}
        {shownLines.length === 0 && <p className="text-slate-400">战斗日志加载中……</p>}
      </div>

      <footer className="relative z-10 border-t border-white/10 bg-black/35 px-4 py-4 md:px-8">
        <div className="mx-auto max-w-md space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-[11px] text-cyan-100/90">
              <span>专注倒计时</span>
              <span>
                {Math.max(0, remaining)}s / {durationSec}s
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-900/80">
              <div
                className={cn(
                  "h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-1000 ease-linear"
                )}
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={onFlee}
            className="w-full rounded-lg border border-rose-500/50 bg-rose-950/60 py-2.5 text-sm font-medium text-rose-100 transition hover:bg-rose-900/70"
          >
            逃跑
          </button>
        </div>
      </footer>
    </motion.div>
  );
}
