"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Flag, Pause, Play, Trophy } from "lucide-react";
import { useState } from "react";
import AppShell from "@/components/app-shell";
import { useLongTermQuests } from "@/hooks/useLongTermQuests";
import type { EpicQuest } from "@/types/quests";

export default function EpicQuestsPage() {
  const { epicQuests, createEpicQuest, advanceEpicStage, toggleEpicPause } = useLongTermQuests();
  const [showCreateModal, setShowCreateModal] = useState(false);
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-3xl font-bold text-transparent">
              史诗征程
            </h1>
            <p className="mt-1 text-slate-400">人生主线剧情，多阶段长线挑战</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 font-bold text-slate-900 transition-all hover:bg-amber-600"
          >
            <Flag className="h-5 w-5" />
            开启新征程
          </button>
        </div>

        <div className="space-y-6">
          {epicQuests.filter((q) => q.isActive).map((quest) => (
            <EpicQuestCard
              key={quest.id}
              quest={quest}
              onAdvance={() => advanceEpicStage(quest.id)}
              onTogglePause={() => toggleEpicPause(quest.id)}
            />
          ))}
          {epicQuests.filter((q) => q.isActive).length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800/50 py-20 text-center">
              <p className="text-slate-500">暂无进行中的史诗任务</p>
              <p className="mt-2 text-sm text-slate-600">比如：博士论文冲刺 / 90天减脂计划。</p>
            </div>
          )}
        </div>

        {epicQuests.some((q) => !q.isActive) && (
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold text-slate-400">已完成的历史</h2>
            <div className="grid gap-4 opacity-70 md:grid-cols-2">
              {epicQuests
                .filter((q) => !q.isActive)
                .map((quest) => (
                  <div key={quest.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                    <div className="mb-2 flex items-center gap-2 text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-bold">已完成</span>
                    </div>
                    <h3 className="text-lg font-bold">{quest.title}</h3>
                    <p className="text-sm text-slate-500">
                      {quest.stages.length}章 · {quest.savePoint.totalProgress}%
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateEpicModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(data) => {
              createEpicQuest(data);
              setShowCreateModal(false);
            }}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function EpicQuestCard({
  quest,
  onAdvance,
  onTogglePause
}: {
  quest: EpicQuest;
  onAdvance: () => void;
  onTogglePause: () => void;
}) {
  const currentStage = quest.stages[quest.currentStage];
  const progress = (currentStage.completedTasks / Math.max(1, currentStage.requiredTasks)) * 100;
  return (
    <motion.div layout className="relative overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
      <div
        className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500"
        style={{ width: `${(quest.currentStage / Math.max(1, quest.totalStages)) * 100}%` }}
      />
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-400">
              第{quest.currentStage + 1}/{quest.totalStages}章
            </span>
            {quest.isPaused && (
              <span className="flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-400">
                <Pause className="h-3 w-3" /> 已暂停
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold">{quest.title}</h2>
          <p className="mt-1 text-slate-400">{quest.description}</p>
        </div>
        <button onClick={onTogglePause} className="rounded-full p-2 hover:bg-slate-700" title="暂停/继续">
          {quest.isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>
      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {quest.stages.map((stage, idx) => (
          <div key={idx} className="flex items-center">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-bold ${
                idx < quest.currentStage
                  ? "border-green-500 bg-green-500 text-slate-900"
                  : idx === quest.currentStage
                    ? "animate-pulse border-amber-500 bg-amber-500 text-slate-900"
                    : "border-slate-600 bg-slate-800 text-slate-500"
              }`}
            >
              {idx < quest.currentStage ? <CheckCircle className="h-5 w-5" /> : idx + 1}
            </div>
            {idx < quest.stages.length - 1 && (
              <div className={`h-0.5 w-8 ${idx < quest.currentStage ? "bg-green-500" : "bg-slate-700"}`} />
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-bold text-amber-200">{currentStage.title}</h3>
          <span className="text-sm text-slate-400">
            {currentStage.completedTasks}/{currentStage.requiredTasks} 任务
          </span>
        </div>
        {currentStage.taskCategory.length > 0 && (
          <p className="mb-3 text-xs text-violet-300">
            阶段过滤：{currentStage.taskCategory.join(" · ")}
          </p>
        )}
        <div className="mb-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div className="h-full bg-gradient-to-r from-amber-500 to-orange-500" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">
            阶段奖励：{currentStage.reward.crystals}晶石 + {currentStage.reward.xp}XP
          </span>
          {progress >= 100 ? (
            <button onClick={onAdvance} className="flex animate-bounce items-center gap-1 rounded-full bg-green-500 px-4 py-2 font-bold text-slate-900 hover:bg-green-600">
              <Trophy className="h-4 w-4" />
              完成阶段！
            </button>
          ) : (
            <span className="text-slate-500">继续推进任务...</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function CreateEpicModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (quest: Partial<EpicQuest>) => void;
}) {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const TAGS = ["阅读", "写作", "运动", "社交", "工作", "学习", "Hard", "Normal", "Simple"];
  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]));
  };
  const templates = [
    {
      title: "博士论文冲刺",
      category: "mage" as const,
      stages: [
        { title: "资料收集期", tasks: 5, desc: "完成5个深度阅读任务" },
        { title: "框架搭建期", tasks: 3, desc: "完成大纲与开题" },
        { title: "深度写作期", tasks: 8, desc: "完成核心章节写作" },
        { title: "润色收尾期", tasks: 4, desc: "修改、查重、提交" }
      ]
    },
    {
      title: "90天减脂计划",
      category: "guardian" as const,
      stages: [
        { title: "适应期", tasks: 7, desc: "每天运动30分钟，持续7天" },
        { title: "燃脂期", tasks: 20, desc: "累计运动20小时" },
        { title: "冲刺期", tasks: 3, desc: "完成阶段冲刺" },
        { title: "维持期", tasks: 14, desc: "保持习惯14天" }
      ]
    }
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-5">
        <h3 className="text-lg font-semibold">快速创建史诗任务</h3>
        <div className="mt-3">
          <p className="text-xs text-slate-400">任务过滤标签（用于阶段推进条件）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`rounded-full border px-2 py-1 text-xs ${
                  selectedTags.includes(tag)
                    ? "border-violet-400 bg-violet-500/20 text-violet-200"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <button
              key={t.title}
              onClick={() =>
                onCreate({
                  title: t.title,
                  category: t.category,
                  totalStages: t.stages.length,
                  description: `${t.title} · ${t.stages.length}章`,
                  stages: t.stages.map((s, i) => ({
                    index: i,
                    title: s.title,
                    description: s.desc,
                    requiredTasks: s.tasks,
                    completedTasks: 0,
                    taskCategory: selectedTags,
                    reward: { crystals: 100 * (i + 1), xp: 200 * (i + 1) },
                    accumulatedXP: 0,
                    accumulatedCrystals: 0
                  }))
                })
              }
              className="rounded-xl border border-slate-700 bg-slate-900 p-4 text-left hover:border-amber-500/60"
            >
              <p className="font-semibold text-amber-200">{t.title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {t.stages.map((s) => s.title).join(" · ")}
              </p>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-300">
          关闭
        </button>
      </div>
    </motion.div>
  );
}
