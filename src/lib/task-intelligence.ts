import type { Difficulty } from "@/types/db";

const STUDY_RE = /阅读|学习|写作|复盘|课程|论文|考试|记忆|公开课|背单词/;

/** 学习/认知类任务标题检测 */
export function isStudyLikeTitle(title: string): boolean {
  return STUDY_RE.test(title.trim());
}

/**
 * INT 越高，学习类任务越难被判定为「简单」：从简单上调一档（Normal）。
 * 体现「能力越强、标准越高」。
 */
export function adjustStudyDifficultyByInt(
  base: Difficulty,
  title: string,
  effectiveInt: number
): Difficulty {
  if (!isStudyLikeTitle(title) || effectiveInt < 14) return base;
  if (base !== "Simple") return base;
  return "Normal";
}

/**
 * 学习类任务完成 XP 加成：INT 越高加成越高（上限约 +35%）。
 * 「学有所成」——与难度上调配套。
 */
export function studyCompletionXpMultiplier(title: string, effectiveInt: number): number {
  if (!isStudyLikeTitle(title) || effectiveInt < 10) return 1;
  return 1 + Math.min(0.35, (effectiveInt - 10) * 0.02);
}
