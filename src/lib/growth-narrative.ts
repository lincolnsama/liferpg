import type { DailyLog } from "@/lib/daily-log";

/** 低能量日、失败与重新开始的温和叙事（用于日志 / 统计空状态）。 */
export const GENTLE_COPY = {
  lowEnergyWeek:
    "这一周出征不多也没关系：休整是长线冒险的一部分，下一周从轻量日常任务开始就好。",
  noTasksYet: "还没有留下战报——从一个小任务开始，故事就会自己长出来。",
  retreatDay:
    "有撤退或低能量记录的日子同样值得被看见：你选择了保存实力，这不是失败，而是战术。",
  restartHint: "随时可以重新开始计数：新的一天、新的篝火封存，进度条会跟上你的节奏。",
  journalIntro:
    "这里汇聚每日冒险、夜间封存与里程碑。云端封存会在你登录后自动合并，换设备也能读到已封存的日子。"
} as const;

export function weekToneFromLogs(logs: DailyLog[], lastDays = 7): "rich" | "quiet" | "mixed" {
  const cutoff = Date.now() - lastDays * 24 * 3600 * 1000;
  let taskSum = 0;
  let retreat = 0;
  for (const log of logs) {
    const t = new Date(`${log.date}T12:00:00`).getTime();
    if (t < cutoff) continue;
    taskSum += log.summary.totalTasks;
    retreat += log.adventures.filter((a) => a.result === "retreat").length;
  }
  if (taskSum === 0) return "quiet";
  if (retreat >= 2) return "mixed";
  if (taskSum >= 5) return "rich";
  return "mixed";
}

export function statsWeekNarrative(logs: DailyLog[]): string {
  const tone = weekToneFromLogs(logs, 7);
  if (tone === "quiet") return GENTLE_COPY.lowEnergyWeek;
  if (tone === "mixed") return `${GENTLE_COPY.retreatDay} ${GENTLE_COPY.restartHint}`;
  return "本周节奏不错：保持这个强度，等级与技能树会稳定向前。";
}
