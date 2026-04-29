export type MainQuestOption = {
  id: string;
  title: string;
  objective: string;
};

export type DailyMainQuest = {
  id: string;
  title: string;
  objective: string;
  ymd: string;
  selectedAt: number;
};

export type DailyMainQuestProgress = {
  ymd: string;
  progressed: boolean;
  confirmedAt: number;
};

import { notifyDailyLoopUpdated } from "@/lib/daily-loop-events";

export const DAILY_MAIN_QUEST_KEY = "life-rpg-daily-main-quest";
export const DAILY_MAIN_QUEST_PROGRESS_KEY = "life-rpg-daily-main-quest-progress";

/** Quick-create task title prefix from tasks page when locking today’s main quest */
export const MAIN_QUEST_QUICK_PREFIX = "主线推进：";

export const MAIN_QUEST_OPTIONS: MainQuestOption[] = [
  {
    id: "health-reset",
    title: "健康恢复",
    objective: "优先把作息、运动或饮食中的一个关键动作做出来。"
  },
  {
    id: "career-growth",
    title: "职业成长",
    objective: "推进一个能带来长期职业复利的关键任务。"
  },
  {
    id: "study-breakthrough",
    title: "学习突破",
    objective: "完成一次高质量学习冲刺，并沉淀成可复用笔记。"
  },
  {
    id: "life-rebuild",
    title: "生活重建",
    objective: "清理一个阻碍执行的生活摩擦点。"
  },
  {
    id: "creative-project",
    title: "创造项目",
    objective: "把想法推进成可展示的一段作品或产出。"
  }
];

function ymd(date = new Date()): string {
  return date.toISOString().split("T")[0] ?? "";
}

export function saveDailyMainQuest(option: MainQuestOption): DailyMainQuest | null {
  if (typeof window === "undefined") return null;
  const payload: DailyMainQuest = {
    id: option.id,
    title: option.title,
    objective: option.objective,
    ymd: ymd(),
    selectedAt: Date.now()
  };
  localStorage.setItem(DAILY_MAIN_QUEST_KEY, JSON.stringify(payload));
  notifyDailyLoopUpdated();
  void import("@/lib/batch1-supabase-sync").then((m) => m.schedulePushDayLoopCache());
  return payload;
}

export function loadDailyMainQuest(): DailyMainQuest | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_MAIN_QUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyMainQuest;
    if (!parsed?.title || !parsed?.ymd) return null;
    if (parsed.ymd !== ymd()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDailyMainQuestProgress(progressed: boolean): DailyMainQuestProgress | null {
  if (typeof window === "undefined") return null;
  const payload: DailyMainQuestProgress = {
    ymd: ymd(),
    progressed,
    confirmedAt: Date.now()
  };
  localStorage.setItem(DAILY_MAIN_QUEST_PROGRESS_KEY, JSON.stringify(payload));
  notifyDailyLoopUpdated();
  void import("@/lib/batch1-supabase-sync").then((m) => m.schedulePushDayLoopCache());
  return payload;
}

/** When a completed task matches the quick-create main-line title for today, persist loop progress. */
export function maybeAutoMarkMainQuestProgressFromTaskTitle(taskTitle: string): boolean {
  if (typeof window === "undefined") return false;
  const mq = loadDailyMainQuest();
  if (!mq) return false;
  const t = taskTitle.trim();
  if (!t.startsWith(MAIN_QUEST_QUICK_PREFIX)) return false;
  const rest = t.slice(MAIN_QUEST_QUICK_PREFIX.length).trim();
  if (rest !== mq.title.trim()) return false;
  saveDailyMainQuestProgress(true);
  return true;
}

export function loadDailyMainQuestProgress(): DailyMainQuestProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_MAIN_QUEST_PROGRESS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DailyMainQuestProgress;
    if (parsed?.ymd !== ymd()) return null;
    return parsed;
  } catch {
    return null;
  }
}
