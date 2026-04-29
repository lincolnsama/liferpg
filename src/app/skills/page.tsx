"use client";

import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { MvpPageHeader } from "@/components/mvp-page-header";
import {
  CLASS_ICON,
  CLASS_LABEL,
  CLASS_TO_PROFESSION,
  loadUserProfile,
  UserProfile
} from "@/lib/user-profile";
import {
  ensureSkillTreeProgress,
  explainLastSkillUnlock,
  playSkillUnlockDing,
  skillTreeNextStep,
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
    const prof = loadUserProfile();
    setUserProfile(prof ? ensureSkillTreeProgress(prof) : null);
    const flashRaw = sessionStorage.getItem("skill-unlock-flash");
    if (!flashRaw) return;
    try {
      const data = JSON.parse(flashRaw) as FlashPayload;
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

  const secondaryProfession = userProfile
    ? CLASS_TO_PROFESSION[userProfile.secondaryClass]
    : null;
  const primaryStep =
    primaryProfession != null
      ? skillTreeNextStep(
          primaryProfession,
          progress.professionXp[primaryProfession],
          progress.unlockedTier[primaryProfession]
        )
      : null;
  const secondaryStep =
    secondaryProfession != null
      ? skillTreeNextStep(
          secondaryProfession,
          progress.professionXp[secondaryProfession],
          progress.unlockedTier[secondaryProfession]
        )
      : null;

  const profSnippet = primaryProfession
    ? `${CLASS_ICON[userProfile.primaryClass]} ${CLASS_LABEL[userProfile.primaryClass]}`
    : "主职业（档案）";
  const skillsDesc = `完成对应职业任务累计 XP 解锁节点；${profSnippet} 同系任务计入进度 ×1.5。`;

  return (
    <AppShell>
      <MvpPageHeader title="技能树" description={skillsDesc} />

      <section className="card mb-8 border-violet-500/25 bg-gradient-to-br from-violet-950/35 to-slate-900/80">
        <h3 className="text-base font-semibold text-violet-100">本周可解释的成长</h3>
        {progress.lastUnlock ? (
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{explainLastSkillUnlock(progress.lastUnlock)}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">完成任意任务并开始累积职业 XP 后，这里会记录最近一次解锁了哪一层。</p>
        )}
        {primaryStep && primaryProfession && (
          <div className="mt-4 rounded-lg border border-slate-700/80 bg-slate-950/50 p-3">
            <p className="text-xs font-medium text-cyan-300/90">主职业 · 下一节点</p>
            <p className="mt-1 text-sm text-slate-200">
              {primaryStep.atCap
                ? primaryStep.explanation
                : `「${primaryStep.nextNodeName}」· ${primaryStep.explanation}`}
            </p>
            {!primaryStep.atCap && (
              <div className="mt-2">
                <div className="mb-1 flex justify-between text-[10px] text-slate-500">
                  <span>
                    {primaryStep.segmentStart} → {primaryStep.segmentEnd} XP
                  </span>
                  <span>{Math.round(primaryStep.progressRatio * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                    style={{ width: `${Math.round(primaryStep.progressRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        {secondaryStep && secondaryProfession && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
            <p className="text-xs font-medium text-slate-400">副职业 · 下一节点</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              {secondaryStep.atCap ? secondaryStep.explanation : secondaryStep.explanation}
            </p>
            {!secondaryStep.atCap && (
              <div className="mt-2">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-slate-600"
                    style={{ width: `${Math.round(secondaryStep.progressRatio * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
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
