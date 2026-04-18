import {
  DIFFICULTY_CRYSTAL_REWARD,
  DIFFICULTY_ESTIMATED_MINUTES,
  DIFFICULTY_XP_REWARD,
  type Task,
  type TaskMode
} from "@/types/db";

export function getTaskMode(task: Task): TaskMode {
  return task.task_mode === "log" ? "log" : "focus";
}

/** 实际耗时相对预计耗时的缩放系数，用于晶石 / XP 基准 */
export function rewardDurationFactor(actualMinutes: number, estimatedMinutes: number): number {
  const est = Math.max(5, estimatedMinutes);
  const act = Math.max(1, actualMinutes);
  return Math.min(1.35, Math.max(0.22, act / est));
}

export type RewardComputationInput = {
  task: Task;
  actualMinutes: number;
  /** 来自 `computeTaskMultiplier` 的倍率（晶石与经验基准共用） */
  dynamicMult: number;
  comaMode: boolean;
  studyMult: number;
  pendMult: number;
};

export type RewardComputationResult = {
  finalCrystal: number;
  finalXp: number;
  isCheatWarning: boolean;
};

/**
 * 基于难度锚点 + 实际耗时比例计算最终奖励；事后记录再打 8 折（在动态加成之后）。
 */
export function computeFinalTaskRewards(input: RewardComputationInput): RewardComputationResult {
  const { task, actualMinutes, dynamicMult, comaMode, studyMult, pendMult } = input;
  const mode = getTaskMode(task);
  const estimatedMinutes = task.estimated_minutes ?? DIFFICULTY_ESTIMATED_MINUTES[task.difficulty];
  const factor = rewardDurationFactor(actualMinutes, estimatedMinutes);

  let finalCrystal = Math.round(
    DIFFICULTY_CRYSTAL_REWARD[task.difficulty] * factor * dynamicMult
  );
  let finalXp = Math.round(
    DIFFICULTY_XP_REWARD[task.difficulty] * factor * dynamicMult * studyMult * pendMult
  );

  const isCheatWarning =
    mode === "focus" && task.difficulty === "Hard" && actualMinutes <= 5;

  if (isCheatWarning) {
    finalCrystal = Math.max(1, Math.floor(finalCrystal / 2));
    finalXp = Math.max(1, Math.floor(finalXp / 2));
  }

  if (comaMode) {
    finalCrystal = Math.max(1, Math.floor(finalCrystal * 0.5));
    finalXp = Math.max(1, Math.floor(finalXp * 0.5));
  }

  if (mode === "log") {
    finalCrystal = Math.max(1, Math.round(finalCrystal * 0.8));
    finalXp = Math.max(1, Math.round(finalXp * 0.8));
  }

  return { finalCrystal, finalXp, isCheatWarning };
}

export function logTaskDailyCountKey(ymd: string): string {
  return `life-rpg-log-count-${ymd}`;
}

export function getLogTaskCountToday(ymd: string): number {
  return Number(localStorage.getItem(logTaskDailyCountKey(ymd)) ?? "0");
}

export function incrementLogTaskCountToday(ymd: string): void {
  const k = logTaskDailyCountKey(ymd);
  localStorage.setItem(k, String(getLogTaskCountToday(ymd) + 1));
}

/** 与任务列表、首页展示一致：是否可走「完成任务」结算 */
export function deriveTaskExploreUiState(task: Task): "pending" | "ready" | "coma" {
  if (task.is_completed) return "pending";
  if (getTaskMode(task) === "log") return "ready";
  if (task.explore_coma) return "coma";
  if (task.focus_ready) return "ready";
  return "pending";
}

export function isFocusCountdownRunning(task: Task): boolean {
  return (
    getTaskMode(task) === "focus" &&
    !task.is_completed &&
    !task.focus_ready &&
    !task.explore_coma &&
    !!task.explore_started_at &&
    typeof task.explore_total_seconds === "number" &&
    task.explore_total_seconds > 0
  );
}

/** 0–1，用于首页 / 列表进度条 */
export function focusCountdownProgress(task: Task, nowMs: number): number {
  if (!isFocusCountdownRunning(task)) return 0;
  const start = new Date(task.explore_started_at as string).getTime();
  const elapsedSec = (nowMs - start) / 1000;
  const total = task.explore_total_seconds as number;
  return Math.min(1, Math.max(0, elapsedSec / total));
}
