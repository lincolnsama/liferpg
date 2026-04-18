"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { useLongTermQuests } from "@/hooks/useLongTermQuests";
import { createClient } from "@/lib/supabase-browser";

export default function WeeklyPage() {
  const { weekly, claimWeeklyReward } = useLongTermQuests();
  const [toast, setToast] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  if (!weekly) {
    return (
      <AppShell>
        <div className="card">加载周常中...</div>
      </AppShell>
    );
  }
  const completedCount = weekly.completedSlots.length;
  const handleClaim = async (tier: "small" | "medium" | "large", crystals: number) => {
    const ok = claimWeeklyReward(tier);
    if (!ok) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("crystals").eq("id", user.id).single();
      const curr = Number((data as { crystals?: number } | null)?.crystals ?? 0);
      await supabase.from("profiles").update({ crystals: curr + crystals }).eq("id", user.id);
    }
    setToast(`领取成功：${tier === "small" ? "小" : tier === "medium" ? "中" : "大"}宝箱 +${crystals} 晶石`);
    setTimeout(() => setToast(null), 1800);
  };
  const chestState = {
    small: completedCount >= 2,
    medium: completedCount >= 4,
    large: completedCount >= 7
  } as const;
  const claimed = new Set(weekly.claimedRewards);
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-3xl font-bold text-transparent">
            {weekly.theme}
          </h1>
          <p className="mt-2 text-slate-400">
            本周第{weekly.weekNumber}周 · {completedCount}/7 完成
          </p>
          <div className="mt-4 flex justify-center gap-2">
            {[2, 4, 7].map((t) => (
              <div
                key={t}
                className={`rounded-full px-3 py-1 text-xs ${
                  completedCount >= t
                    ? "border border-amber-500 bg-amber-500/20 text-amber-400"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {t === 2 ? "小宝箱" : t === 4 ? "中宝箱" : "大宝箱"}
              </div>
            ))}
          </div>
        </div>
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          {[
            { key: "small", label: "小宝箱", req: 2, crystals: 120 },
            { key: "medium", label: "中宝箱", req: 4, crystals: 260 },
            { key: "large", label: "大宝箱", req: 7, crystals: 520 }
          ].map((c) => {
            const k = c.key as "small" | "medium" | "large";
            const unlocked = chestState[k];
            const already = claimed.has(k);
            return (
              <div key={c.key} className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">
                <p className="text-sm font-semibold text-amber-300">{c.label}</p>
                <p className="mt-1 text-xs text-slate-400">完成{c.req}格解锁 · 奖励 {c.crystals} 晶石</p>
                <button
                  type="button"
                  disabled={!unlocked || already}
                  onClick={() => void handleClaim(k, c.crystals)}
                  className={`mt-3 w-full rounded px-3 py-1.5 text-sm ${
                    already
                      ? "bg-emerald-700/40 text-emerald-200"
                      : unlocked
                        ? "animate-pulse bg-amber-500 text-slate-900"
                        : "bg-slate-700 text-slate-500"
                  }`}
                >
                  {already ? "已领取" : unlocked ? "领取宝箱" : "未解锁"}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-3">
          {weekly.challenges.map((challenge, idx) => {
            const isCompleted = challenge.completed;
            const row = Math.floor(idx / 3);
            const isEvenRow = row % 2 === 0;
            const marginLeft = isEvenRow
              ? idx % 3 === 0
                ? "ml-0"
                : idx % 3 === 1
                  ? "ml-4"
                  : "ml-8"
              : idx % 3 === 0
                ? "ml-8"
                : idx % 3 === 1
                  ? "ml-4"
                  : "ml-0";
            return (
              <motion.div
                key={challenge.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.08 }}
                className={`relative -mt-4 h-32 w-28 first:mt-0 ${marginLeft}`}
              >
                <div className={`relative h-full w-full transition-all duration-300 ${isCompleted ? "scale-95" : "hover:scale-105"}`}>
                  <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
                    <polygon
                      points="50,3 93,25 93,75 50,97 7,75 7,25"
                      fill={isCompleted ? "#10b981" : "#1e293b"}
                      stroke={isCompleted ? "#059669" : "#475569"}
                      strokeWidth="2"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                    <p className={`text-xs font-bold leading-tight ${isCompleted ? "text-white" : "text-slate-300"}`}>{challenge.title}</p>
                    {!isCompleted && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {Math.round(challenge.progress)}/{challenge.target}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-12 space-y-3">
          <h2 className="mb-4 text-lg font-bold text-slate-300">本周挑战详情</h2>
          {weekly.challenges.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between rounded-xl border p-4 ${
                c.completed ? "border-green-500/30 bg-green-500/10" : "border-slate-700 bg-slate-800"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                    {c.type === "fixed" ? "固定" : "随机"}
                  </span>
                  <h3 className={`font-bold ${c.completed ? "text-green-400" : "text-white"}`}>{c.title}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-400">{c.description}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-amber-400">+{c.reward.crystals}</div>
                <div className="text-xs text-slate-500">晶石</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="pointer-events-none fixed right-6 top-6 z-[120] rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 shadow-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
