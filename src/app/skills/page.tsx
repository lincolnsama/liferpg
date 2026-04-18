"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import {
  CLASS_ICON,
  CLASS_LABEL,
  CLASS_TO_PROFESSION,
  loadUserProfile,
  UserProfile
} from "@/lib/user-profile";
import {
  playSkillUnlockDing,
  SKILL_TREES,
  SKILL_XP_THRESHOLDS,
  type SkillTreeDef
} from "@/lib/skill-tree";
import type { Profession } from "@/types/db";

type FlashPayload = {
  profession: Profession;
  nodeIndex: number;
  nodeId: string;
  nodeName: string;
  at: number;
};

export default function SkillsPage() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [flash, setFlash] = useState<FlashPayload | null>(null);

  useEffect(() => {
    setUserProfile(loadUserProfile());
    const raw = sessionStorage.getItem("skill-unlock-flash");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as FlashPayload;
      if (Date.now() - data.at > 20000) {
        sessionStorage.removeItem("skill-unlock-flash");
        return;
      }
      setFlash(data);
      playSkillUnlockDing();
      const t = setTimeout(() => {
        sessionStorage.removeItem("skill-unlock-flash");
        setFlash(null);
      }, 2800);
      return () => clearTimeout(t);
    } catch {
      sessionStorage.removeItem("skill-unlock-flash");
    }
  }, []);

  const primaryProfession = userProfile ? CLASS_TO_PROFESSION[userProfile.primaryClass] : null;

  const progress = userProfile?.skillTreeProgress;

  if (!userProfile || !progress) {
    return (
      <AppShell>
        <div className="card">加载中...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">技能树</h2>
          <p className="mt-1 text-sm text-slate-400">
            完成对应职业任务累计 XP 解锁节点；主职业{" "}
            {primaryProfession && (
              <span className="text-cyan-300">
                {CLASS_ICON[userProfile.primaryClass]} {CLASS_LABEL[userProfile.primaryClass]}
              </span>
            )}{" "}
            同职业任务计入进度 ×1.5
          </p>
        </div>
      </section>

      <div className="space-y-8">
        {SKILL_TREES.map((tree) => (
          <SkillTreeRow
            key={tree.profession}
            tree={tree}
            xp={progress.professionXp[tree.profession]}
            unlockedTier={progress.unlockedTier[tree.profession]}
            isPrimary={tree.profession === primaryProfession}
            flash={flash}
          />
        ))}
      </div>
    </AppShell>
  );
}

function SkillTreeRow({
  tree,
  xp,
  unlockedTier,
  isPrimary,
  flash
}: {
  tree: SkillTreeDef;
  xp: number;
  unlockedTier: number;
  isPrimary: boolean;
  flash: FlashPayload | null;
}) {
  return (
    <motion.section
      layout
      className={`card ${
        isPrimary ? "ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-900/20" : ""
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{tree.title}</h3>
          <p className="text-xs text-slate-400">{tree.subtitle}</p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <p>
            累计 XP：<span className="text-cyan-300">{xp}</span>
            {isPrimary && <span className="ml-2 text-amber-300">主树 ×1.5 增速</span>}
          </p>
          <p className="mt-0.5">
            阈值：{SKILL_XP_THRESHOLDS.join(" / ")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch justify-between gap-3 md:gap-4">
        {tree.nodes.map((node, index) => {
          const unlocked = unlockedTier > index;
          const isFlash =
            flash &&
            flash.profession === tree.profession &&
            flash.nodeIndex === index &&
            Date.now() - flash.at < 20000;

          const Icon = node.Icon;

          return (
            <div key={node.id} className="flex min-w-[4.5rem] flex-1 flex-col items-center">
              <motion.div
                layout
                animate={
                  isFlash
                    ? { scale: [1, 1.15, 1], boxShadow: ["0 0 0 0 rgba(34,211,238,0)", "0 0 28px 6px rgba(34,211,238,0.45)", "0 0 0 0 rgba(34,211,238,0)"] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.6 }}
                className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 md:h-[4.5rem] md:w-[4.5rem] ${
                  unlocked
                    ? "border-cyan-400 bg-gradient-to-br from-cyan-500/25 to-blue-600/20 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-500"
                }`}
              >
                {unlocked ? (
                  <Icon className="h-7 w-7 md:h-8 md:w-8" strokeWidth={1.75} />
                ) : (
                  <Lock className="h-6 w-6 md:h-7 md:w-7" strokeWidth={1.5} />
                )}
                <span className="absolute -bottom-2 rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-slate-700">
                  Lv.{index + 1}
                </span>
              </motion.div>
              <p className={`mt-3 text-center text-[11px] md:text-xs ${unlocked ? "text-slate-200" : "text-slate-500"}`}>
                {node.name}
              </p>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
