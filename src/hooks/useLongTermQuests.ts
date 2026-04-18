"use client";

import { useCallback, useEffect, useState } from "react";
import {
  generateDefaultStages,
  getCurrentWeekId,
  loadEpicQuests,
  loadOrCreateWeekly,
  saveEpicQuests,
  saveWeekly
} from "@/lib/long-term-quests";
import type { EpicQuest, MonthlyMilestone, WeeklyChallenge } from "@/types/quests";

export const useLongTermQuests = () => {
  const [epicQuests, setEpicQuests] = useState<EpicQuest[]>([]);
  const [weekly, setWeekly] = useState<WeeklyChallenge | null>(null);
  const [monthly, setMonthly] = useState<MonthlyMilestone | null>(null);

  useEffect(() => {
    const epics = loadEpicQuests();
    setEpicQuests(epics);
    const week = loadOrCreateWeekly(getCurrentWeekId());
    setWeekly(week);
    const monthId = new Date().toISOString().slice(0, 7);
    const rawMonthly = localStorage.getItem(`monthly_${monthId}`);
    if (rawMonthly) setMonthly(JSON.parse(rawMonthly) as MonthlyMilestone);
  }, []);

  const createEpicQuest = useCallback(
    (questData: Partial<EpicQuest>) => {
      const totalStages = questData.totalStages ?? 4;
      const newQuest: EpicQuest = {
        id: `epic_${Date.now()}`,
        title: questData.title || "未命名史诗",
        description: questData.description || "",
        category: questData.category || "mixed",
        totalStages,
        currentStage: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date().toISOString(),
        deadline: questData.deadline,
        stages: questData.stages ?? generateDefaultStages(totalStages),
        savePoint: {
          lastActiveDate: new Date().toISOString(),
          totalProgress: 0
        }
      };
      const updated = [...epicQuests, newQuest];
      setEpicQuests(updated);
      saveEpicQuests(updated);
      return newQuest;
    },
    [epicQuests]
  );

  const advanceEpicStage = useCallback((questId: string) => {
    setEpicQuests((prev) => {
      const updated = prev.map((q) => {
        if (q.id !== questId) return q;
        const curr = q.stages[q.currentStage];
        if (curr.completedTasks < curr.requiredTasks) return q;
        const nextStage = q.currentStage + 1;
        const isComplete = nextStage >= q.totalStages;
        return {
          ...q,
          currentStage: isComplete ? q.currentStage : nextStage,
          isActive: !isComplete,
          stages: q.stages.map((s, idx) => (idx === q.currentStage ? { ...s, completed: true } : s)),
          savePoint: {
            lastActiveDate: new Date().toISOString(),
            totalProgress: Math.round((Math.min(nextStage, q.totalStages) / q.totalStages) * 100)
          }
        };
      });
      saveEpicQuests(updated);
      return updated;
    });
  }, []);

  const toggleEpicPause = useCallback((questId: string) => {
    setEpicQuests((prev) => {
      const updated = prev.map((q) => (q.id === questId ? { ...q, isPaused: !q.isPaused } : q));
      saveEpicQuests(updated);
      return updated;
    });
  }, []);

  const claimWeeklyReward = useCallback(
    (tier: "small" | "medium" | "large") => {
      if (!weekly) return false;
      const required = tier === "small" ? 2 : tier === "medium" ? 4 : 7;
      if (weekly.completedSlots.length < required) return false;
      if (weekly.claimedRewards.includes(tier)) return false;
      const next = { ...weekly, claimedRewards: [...weekly.claimedRewards, tier] };
      setWeekly(next);
      saveWeekly(next);
      return true;
    },
    [weekly]
  );

  return {
    epicQuests,
    weekly,
    monthly,
    createEpicQuest,
    advanceEpicStage,
    toggleEpicPause,
    claimWeeklyReward
  };
};
