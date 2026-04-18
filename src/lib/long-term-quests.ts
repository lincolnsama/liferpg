import type { Task } from "@/types/db";
import type { EpicQuest, EpicQuestStage, WeeklyChallenge, WeeklyChallengeItem } from "@/types/quests";

const EPIC_KEY = "epicQuests";
const WEEKLY_PREFIX = "weekly_";

const WEEKLY_THEMES = ["突破之周", "探索之周", "深耕之周", "平衡之周", "社交之周"];

function nowIso() {
  return new Date().toISOString();
}

export function getCurrentWeekId(date = new Date()): string {
  const year = date.getFullYear();
  const first = new Date(year, 0, 1);
  const dayOfYear = Math.floor((date.getTime() - first.getTime()) / 86400000) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function generateDefaultStages(total: number): EpicQuestStage[] {
  return Array.from({ length: total }, (_, i) => ({
    index: i,
    title: `第${i + 1}章`,
    description: "完成本阶段目标",
    requiredTasks: 3 + i * 2,
    completedTasks: 0,
    taskCategory: [],
    reward: {
      crystals: 100 * (i + 1),
      xp: 200 * (i + 1)
    },
    accumulatedXP: 0,
    accumulatedCrystals: 0
  }));
}

export function loadEpicQuests(): EpicQuest[] {
  try {
    const raw = localStorage.getItem(EPIC_KEY);
    return raw ? (JSON.parse(raw) as EpicQuest[]) : [];
  } catch {
    return [];
  }
}

export function saveEpicQuests(items: EpicQuest[]): void {
  localStorage.setItem(EPIC_KEY, JSON.stringify(items));
}

export function generateWeeklyChallenges(weekId: string): WeeklyChallenge {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const fixed: WeeklyChallengeItem[] = [
    {
      id: `${weekId}-1`,
      title: "困难征服者",
      description: "完成3个困难任务",
      type: "fixed",
      requirement: { count: 3, difficulty: "hard" },
      progress: 0,
      target: 3,
      completed: false,
      reward: { crystals: 50, type: "small" }
    },
    {
      id: `${weekId}-2`,
      title: "自律 streak",
      description: "连续5天完成任务（简化为完成5个任务）",
      type: "fixed",
      requirement: { count: 5 },
      progress: 0,
      target: 5,
      completed: false,
      reward: { crystals: 50, type: "small" }
    },
    {
      id: `${weekId}-3`,
      title: "高效日",
      description: "单周累计获得200+ XP",
      type: "fixed",
      requirement: { count: 200, category: "xp" },
      progress: 0,
      target: 200,
      completed: false,
      reward: { crystals: 50, type: "small" }
    }
  ];
  const randomPool: Array<{ title: string; description: string; requirement: WeeklyChallengeItem["requirement"] }> =
    [
      { title: "跨界者", description: "完成3个非主职业任务", requirement: { count: 3, category: "new" } },
      { title: "征服者", description: "完成1个史诗章节", requirement: { count: 1, category: "epic" } },
      { title: "深度工作", description: "累计专注时长10小时", requirement: { totalHours: 10 } },
      { title: "早起鸟", description: "3次上午任务", requirement: { count: 3, category: "early" } },
      { title: "夜行者", description: "3次夜间任务", requirement: { count: 3, category: "night" } },
      { title: "艰难推进", description: "再完成2个困难任务", requirement: { count: 2, difficulty: "hard" } }
    ];
  const random = [...randomPool]
    .sort(() => 0.5 - Math.random())
    .slice(0, 4)
    .map((item, idx) => ({
      id: `${weekId}-${idx + 4}`,
      title: item.title,
      description: item.description,
      type: "random" as const,
      requirement: item.requirement,
      progress: 0,
      target: item.requirement.count ?? item.requirement.totalHours ?? 1,
      completed: false,
      reward: { crystals: 50, type: "small" as const }
    }));

  return {
    weekId,
    weekNumber: Number(weekId.split("-W")[1] ?? 1),
    theme: WEEKLY_THEMES[Math.floor(Math.random() * WEEKLY_THEMES.length)] as string,
    startDate: weekStart.toISOString(),
    endDate: weekEnd.toISOString(),
    challenges: [...fixed, ...random],
    completedSlots: [],
    claimedRewards: [],
    isCurrent: true
  };
}

export function loadOrCreateWeekly(weekId = getCurrentWeekId()): WeeklyChallenge {
  const key = `${WEEKLY_PREFIX}${weekId}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as WeeklyChallenge;
  } catch {
    // noop
  }
  const created = generateWeeklyChallenges(weekId);
  localStorage.setItem(key, JSON.stringify(created));
  return created;
}

export function saveWeekly(weekly: WeeklyChallenge): void {
  localStorage.setItem(`${WEEKLY_PREFIX}${weekly.weekId}`, JSON.stringify(weekly));
}

export function processTaskForLongTerm(task: Task, gainedXp: number, focusHours: number): {
  bonusXp: number;
  bonusCrystals: number;
  notices: string[];
} {
  const notices: string[] = [];
  let bonusXp = 0;
  let bonusCrystals = 0;

  const epics = loadEpicQuests();
  let epicChanged = false;
  for (const q of epics) {
    if (!q.isActive || q.isPaused) continue;
    const stage = q.stages[q.currentStage];
    const categoryMatch =
      q.category === "mixed" || q.category.toLowerCase() === task.profession.toLowerCase();
    const customMatch =
      stage.taskCategory.length === 0 ||
      stage.taskCategory.some((c) => {
        if (c === "Hard" || c === "Normal" || c === "Simple") return task.difficulty === c;
        return task.title.includes(c) || task.profession.includes(c);
      });
    if (!categoryMatch || !customMatch) continue;
    stage.completedTasks += 1;
    stage.accumulatedXP += gainedXp;
    stage.accumulatedCrystals += task.reward;
    q.savePoint.lastActiveDate = nowIso();
    if (stage.completedTasks >= stage.requiredTasks && !stage.completed) {
      stage.completed = true;
      bonusXp += stage.reward.xp;
      bonusCrystals += stage.reward.crystals;
      notices.push(`史诗任务「${q.title}」${stage.title}完成！+${stage.reward.xp}XP +${stage.reward.crystals}晶石`);
      if (q.currentStage + 1 < q.totalStages) {
        q.currentStage += 1;
      } else {
        q.isActive = false;
        notices.push(`史诗任务「${q.title}」全章完结！`);
      }
    }
    q.savePoint.totalProgress = Math.round(((q.currentStage + (stage.completed ? 1 : 0)) / q.totalStages) * 100);
    epicChanged = true;
  }
  if (epicChanged) saveEpicQuests(epics);

  const weekly = loadOrCreateWeekly();
  const prevCompleted = weekly.completedSlots.length;
  const updated = weekly.challenges.map((c) => {
    if (c.completed) return c;
    let progress = c.progress;
    const hour = new Date().getHours();
    const diff = task.difficulty === "Hard" ? "hard" : task.difficulty === "Normal" ? "medium" : "easy";
    if (c.requirement.category === "xp") {
      progress += gainedXp;
    } else if (c.requirement.totalHours) {
      progress += focusHours;
    } else if (c.requirement.difficulty && c.requirement.difficulty === diff) {
      progress += 1;
    } else if (c.requirement.category === "early" && hour < 8) {
      progress += 1;
    } else if (c.requirement.category === "night" && hour >= 22) {
      progress += 1;
    } else if (!c.requirement.difficulty && !c.requirement.category && !c.requirement.totalHours) {
      progress += 1;
    } else if (c.requirement.category === "new") {
      progress += 1;
    }
    const done = progress >= c.target;
    if (done && !c.completed) {
      notices.push(`周常「${c.title}」已完成，可领取 +${c.reward.crystals} 晶石`);
    }
    return { ...c, progress: Math.min(progress, c.target), completed: done };
  });
  weekly.challenges = updated;
  weekly.completedSlots = updated.map((c, i) => (c.completed ? i : -1)).filter((x) => x >= 0);
  const nowCompleted = weekly.completedSlots.length;
  if (prevCompleted < 2 && nowCompleted >= 2) notices.push("周常小宝箱已解锁");
  if (prevCompleted < 4 && nowCompleted >= 4) notices.push("周常中宝箱已解锁");
  if (prevCompleted < 7 && nowCompleted >= 7) notices.push("周常大宝箱已解锁");
  saveWeekly(weekly);

  return { bonusXp, bonusCrystals, notices };
}
