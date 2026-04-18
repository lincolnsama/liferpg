"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { TaskBriefing } from "@/lib/task-adventure-flow";
import type { Task } from "@/types/db";
import { ADVENTURE_SCENE_BACKDROP, backdropKeyFromSceneName } from "@/lib/adventure-run-ui";

function TypewriterLine({ text, speedMs = 18 }: { text: string; speedMs?: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    setShown(0);
  }, [text]);
  useEffect(() => {
    if (shown >= text.length) return;
    const id = window.setTimeout(() => setShown((s) => s + 1), speedMs);
    return () => window.clearTimeout(id);
  }, [shown, text, speedMs]);
  return <span className="whitespace-pre-wrap">{text.slice(0, shown)}</span>;
}

type Phase = "battle" | "victory";

type Props = {
  task: Task;
  briefing: TaskBriefing;
  /** 每秒一条累积战报（文字 RPG） */
  exploreFeed: string[];
  /** 叙事用虚拟回合上限（≈ 预计分钟 / 5） */
  totalBattleTurns: number;
  totalSec: number;
  initialHp: number;
  maxHp: number;
  /** 探索阶段结束时角色 HP（未做战后治疗） */
  combatEndHp: number;
  /** 本场受到的总伤害（用于 HP 条动画） */
  damageTakenPreview: number;
  /** 预计耗时（分钟），用于提前完成校验 */
  estimatedMinutes: number;
  onSuccess: (hp: number) => void;
  onComa: () => void;
  onAbandon: () => void;
  /** 提前结束倒计时：提交实际耗时（分钟）与当前 HP，须小于预计耗时 */
  onEarlyComplete: (actualMinutes: number, endHp: number) => void;
};

export default function TaskExploreOverlay({
  task,
  briefing,
  exploreFeed,
  totalBattleTurns,
  totalSec,
  initialHp,
  maxHp,
  combatEndHp,
  damageTakenPreview,
  onSuccess,
  onComa,
  onAbandon,
  estimatedMinutes,
  onEarlyComplete
}: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState<Phase>("battle");
  const hpRef = useRef(initialHp);
  const bg = ADVENTURE_SCENE_BACKDROP[backdropKeyFromSceneName(briefing.scene)];
  type EarlyStep = "closed" | "confirm" | "minutes" | "fastWarn";
  const [earlyStep, setEarlyStep] = useState<EarlyStep>("closed");
  const [earlyMinutes, setEarlyMinutes] = useState(
    Math.max(1, Math.min(estimatedMinutes - 1, Math.floor(estimatedMinutes * 0.6) || 1))
  );

  const displayText = useMemo(() => {
    if (exploreFeed.length === 0) return "";
    const i = Math.min(exploreFeed.length - 1, Math.max(0, elapsed));
    return exploreFeed[i] ?? "";
  }, [exploreFeed, elapsed]);

  const virtualRound = useMemo(() => {
    if (totalSec <= 0) return 1;
    return Math.min(totalBattleTurns, Math.max(1, Math.ceil(((elapsed + 1) / totalSec) * totalBattleTurns)));
  }, [elapsed, totalSec, totalBattleTurns]);

  const displayHp = useMemo(() => {
    const t = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 1;
    const lost = Math.floor(t * damageTakenPreview);
    return Math.max(0, initialHp - lost);
  }, [elapsed, totalSec, damageTakenPreview, initialHp]);

  useEffect(() => {
    hpRef.current = displayHp;
  }, [displayHp]);

  useEffect(() => {
    if (phase !== "battle") return;
    const id = window.setInterval(() => {
      setElapsed((e) => (e >= totalSec ? totalSec : e + 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase, totalSec]);

  useEffect(() => {
    if (phase !== "battle") return;
    if (displayHp <= 0) return;
    if (elapsed < totalSec) return;
    setPhase("victory");
  }, [elapsed, phase, totalSec, displayHp]);

  useEffect(() => {
    if (phase !== "victory") return;
    const id = window.setTimeout(() => {
      onSuccess(combatEndHp);
    }, 2400);
    return () => window.clearTimeout(id);
  }, [phase, onSuccess, combatEndHp]);

  if (displayHp <= 0 && phase === "battle") {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-slate-950 px-6 text-center"
      >
        <p className="max-w-md text-lg leading-relaxed text-rose-100">
          任务失败：你在迷宫中昏迷，被队友救出。将只能领取约 50% 的晶石与经验奖励。
        </p>
        <button
          type="button"
          onClick={onComa}
          className="mt-8 rounded-lg bg-slate-800 px-8 py-3 text-sm font-medium text-slate-100 hover:bg-slate-700"
        >
          返回任务列表
        </button>
      </motion.div>
    );
  }

  const progress = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 1;
  const rem = Math.max(0, totalSec - elapsed);
  const maxEarly = Math.max(1, estimatedMinutes - 1);

  const submitEarlyMinutes = () => {
    const m = Math.round(earlyMinutes);
    if (!Number.isFinite(m) || m < 1) return;
    if (m >= estimatedMinutes) return;
    if (m < estimatedMinutes * 0.5) {
      setEarlyStep("fastWarn");
      return;
    }
    onEarlyComplete(m, displayHp);
    setEarlyStep("closed");
  };

  const confirmFastEarly = () => {
    const m = Math.round(earlyMinutes);
    if (m >= 1 && m < estimatedMinutes) {
      onEarlyComplete(m, displayHp);
      setEarlyStep("closed");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[110] flex flex-col text-slate-100"
      style={{ background: bg }}
    >
      <div className="absolute inset-0 bg-black/35" />

      {earlyStep !== "closed" && (
        <div className="absolute inset-0 z-[130] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-700/50 bg-slate-950 px-5 py-5 shadow-xl">
            {earlyStep === "confirm" && (
              <>
                <p className="text-center text-base font-medium text-amber-100">现实中已提前完成？</p>
                <p className="mt-2 text-center text-sm text-slate-400">
                  提前结束将按你填写的实际耗时结算奖励（须小于预计 {estimatedMinutes} 分钟）。
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEarlyStep("closed")}
                    className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => setEarlyStep("minutes")}
                    className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white hover:bg-amber-500"
                  >
                    是的，填写耗时
                  </button>
                </div>
              </>
            )}
            {earlyStep === "minutes" && (
              <>
                <p className="text-center text-sm font-medium text-slate-100">实际耗时（分钟）</p>
                <p className="mt-1 text-center text-xs text-slate-500">
                  必须小于预计 {estimatedMinutes} 分钟（1–{maxEarly}）
                </p>
                <input
                  type="number"
                  min={1}
                  max={maxEarly}
                  value={earlyMinutes}
                  onChange={(e) => setEarlyMinutes(Number(e.target.value))}
                  className="mt-4 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-center text-lg text-slate-100"
                />
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEarlyStep("confirm")}
                    className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={submitEarlyMinutes}
                    className="flex-1 rounded-lg bg-cyan-600 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    确认结算
                  </button>
                </div>
              </>
            )}
            {earlyStep === "fastWarn" && (
              <>
                <p className="text-center text-base font-medium text-rose-100">确定完成得这么快？</p>
                <p className="mt-2 text-center text-sm text-slate-400">
                  你填写的时间不足预计耗时的 50%，请确认没有误填。
                </p>
                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEarlyStep("minutes")}
                    className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
                  >
                    回去修改
                  </button>
                  <button
                    type="button"
                    onClick={confirmFastEarly}
                    className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-medium text-white hover:bg-rose-500"
                  >
                    确认，继续结算
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <header className="relative z-10 border-b border-white/10 px-4 py-3 md:px-8">
        <p className="text-center text-xs text-white/70">任务：{task.title}</p>
        <p className="mt-1 text-center text-sm font-medium text-amber-100">全屏冒险 · 文字 RPG</p>
        <p className="mt-0.5 text-center text-xs text-cyan-200/90">场景：{briefing.scene}</p>
        <div className="mx-auto mt-3 max-w-md">
          <div className="mb-1 flex justify-between text-[11px] text-slate-300">
            <span>战斗回合（每 5 分钟现实时间 = 1 回合）</span>
            <span>
              第 {virtualRound} / {totalBattleTurns} 回合
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-600 to-rose-500 transition-all duration-1000 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            距本场结束约 <span className="tabular-nums text-slate-300">{rem}</span> 秒
          </p>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-6 py-6">
        <div className="max-h-[min(52vh,480px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-black/45 px-5 py-6 shadow-inner backdrop-blur-sm md:px-8">
          <p className="text-center text-[11px] uppercase tracking-widest text-slate-500">战斗日志</p>
          <div className="mt-4 text-left text-sm leading-relaxed text-slate-100 md:text-base">
            <TypewriterLine text={displayText} key={displayText} />
          </div>
        </div>

        <div className="mt-6 w-full max-w-xs shrink-0">
          <div className="mb-1 flex justify-between text-[11px] text-rose-100/90">
            <span>冒险者 HP</span>
            <span>
              {displayHp} / {maxHp}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-600 to-amber-400 transition-[width] duration-500"
              style={{ width: `${maxHp > 0 ? Math.min(100, Math.round((displayHp / maxHp) * 100)) : 0}%` }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {phase === "victory" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/55"
          >
            <motion.p
              initial={{ y: 16 }}
              animate={{ y: 0 }}
              className="text-3xl font-bold tracking-widest text-emerald-200 drop-shadow-lg md:text-4xl"
            >
              战斗胜利
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="relative z-10 shrink-0 space-y-2 border-t border-white/10 bg-black/30 px-4 py-4">
        <button
          type="button"
          onClick={() => {
            if (phase === "battle" && estimatedMinutes > 1) {
              setEarlyMinutes(Math.max(1, Math.min(maxEarly, Math.floor(estimatedMinutes * 0.6) || 1)));
              setEarlyStep("confirm");
            }
          }}
          disabled={phase === "victory" || earlyStep !== "closed" || estimatedMinutes <= 1}
          className="mx-auto block w-full max-w-md rounded-lg border border-cyan-700/50 bg-cyan-950/40 py-2 text-sm text-cyan-100 hover:bg-cyan-900/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          提前完成
        </button>
        <button
          type="button"
          onClick={onAbandon}
          disabled={phase === "victory"}
          className="mx-auto block w-full max-w-md rounded-lg border border-amber-800/60 bg-amber-950/40 py-2 text-sm text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          放弃任务（逃跑：遗失装备耐久度）
        </button>
      </footer>
    </motion.div>
  );
}
