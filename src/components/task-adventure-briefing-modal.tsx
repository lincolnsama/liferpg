"use client";

import { motion } from "framer-motion";
import type { TaskBriefing } from "@/lib/task-adventure-flow";

type Props = {
  open: boolean;
  briefing: TaskBriefing | null;
  onCancel: () => void;
  onConfirm: (hpMode: "full" | "inherit") => void;
};

export default function TaskAdventureBriefingModal({ open, briefing, onCancel, onConfirm }: Props) {
  if (!open || !briefing) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-700/40 bg-slate-950 p-6 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">出发前简报</p>
        <h2 className="mt-2 text-lg font-semibold text-slate-100">即将进入冒险</h2>

        <div className="mt-5 space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-200">
          <p>
            即将进入<span className="font-medium text-cyan-300">「{briefing.scene}」</span>
            ，预计遭遇
            <span className="text-amber-200">「{briefing.monsterArchetype}」</span>
            （预览目标：<span className="text-slate-300">{briefing.monsterName}</span>
            ，预估 HP <span className="tabular-nums text-amber-200">{briefing.monsterHp}</span>）。
          </p>
          <p className="text-slate-400">
            确认后将创建任务并进入全屏文字冒险；战斗按回合推进（每 5 分钟现实时间 ≈ 1 回合），中央为战斗日志。
          </p>
        </div>

        <div className="mt-4 rounded-xl border border-violet-900/50 bg-violet-950/30 p-4 text-sm text-violet-100">
          <p className="text-xs font-medium text-violet-300">推荐装备</p>
          <p className="mt-1 text-slate-200">{briefing.gearTip}</p>
        </div>

        <div className="mt-6">
          <p className="mb-2 text-xs text-slate-500">出发时 HP / MP</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => onConfirm("full")}
              className="flex-1 rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
            >
              满状态出发
            </button>
            <button
              type="button"
              onClick={() => onConfirm("inherit")}
              className="flex-1 rounded-lg border border-slate-600 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
            >
              继承当前状态
            </button>
          </div>
        </div>

        <button type="button" onClick={onCancel} className="mt-4 w-full text-center text-xs text-slate-500 hover:text-slate-300">
          取消
        </button>
      </motion.div>
    </motion.div>
  );
}
