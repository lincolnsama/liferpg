"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { COSMETICS_UPDATED_EVENT, loadCosmetics } from "@/lib/cosmetics";

type FocusBgId = string;

const POMO_SEC = 25 * 60;

const bgClass: Record<string, string> = {
  "focus-rain": "bg-gradient-to-b from-slate-900 via-slate-800 to-emerald-950/80 focus-bg-rain",
  "focus-cafe": "bg-gradient-to-br from-amber-950 via-slate-900 to-orange-950/70",
  "focus-cosmic": "bg-gradient-to-b from-indigo-950 via-slate-950 to-black focus-bg-stars"
};

export default function FocusPage() {
  const [focusId, setFocusId] = useState<FocusBgId>(() => loadCosmetics().equippedFocusBgId);
  const [left, setLeft] = useState(POMO_SEC);
  const [running, setRunning] = useState(false);

  const syncFocusBg = useCallback(() => setFocusId(loadCosmetics().equippedFocusBgId), []);

  useEffect(() => {
    window.addEventListener(COSMETICS_UPDATED_EVENT, syncFocusBg);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, syncFocusBg);
  }, [syncFocusBg]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          setRunning(false);
          return POMO_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const shellClass = bgClass[focusId] ?? bgClass["focus-rain"];

  const reset = useCallback(() => {
    setRunning(false);
    setLeft(POMO_SEC);
  }, []);

  return (
    <div className={`relative fixed inset-0 z-[100] flex flex-col text-slate-100 ${shellClass}`}>
      <div className="flex items-center justify-between p-4">
        <Link href="/shop" className="text-sm text-cyan-200 hover:text-white">
          ← 商店 / 换背景
        </Link>
        <span className="text-xs text-slate-400">装备背景：{focusId}</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-300">Pomodoro</p>
        <p className="text-6xl font-mono font-bold tabular-nums md:text-8xl">
          {mm}:{ss}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="rounded-full bg-cyan-600 px-6 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            {running ? "暂停" : "开始"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-slate-500 px-6 py-2 text-sm text-slate-200 hover:border-slate-300"
          >
            重置
          </button>
        </div>
      </div>
    </div>
  );
}
