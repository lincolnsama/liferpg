import { sumCrystalSpendBetween } from "@/lib/crystal-spend-log";
import { loadCosmetics } from "@/lib/cosmetics";
import { SKILL_XP_THRESHOLDS } from "@/lib/skill-tree";
import { getLevelFromXp } from "@/lib/utils";
import type { Profession, Task } from "@/types/db";
import type { UserProfile } from "@/lib/user-profile";
import { CLASS_TO_PROFESSION } from "@/lib/user-profile";

export const MAX_CHECKIN_STREAK_KEY = "life-rpg-max-checkin-streak";

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 本周一 00:00 至本周日 23:59（本地时区） */
export function getThisWeekRange(): { start: Date; end: Date; label: string } {
  const now = new Date();
  const dow = now.getDay();
  const monOffset = dow === 0 ? -6 : 1 - dow;
  const start = startOfDay(addDays(now, monOffset));
  const end = endOfDay(addDays(start, 6));
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return { start, end, label: `${fmt(start)}–${fmt(end)}` };
}

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function taskXp(t: Task): number {
  return typeof t.xp_reward === "number" && t.xp_reward > 0 ? t.xp_reward : 10;
}

export function filterCompletedInRange(tasks: Task[], start: Date, end: Date): Task[] {
  return tasks.filter((t) => {
    if (!t.is_completed || !t.completed_at) return false;
    const ct = new Date(t.completed_at).getTime();
    return ct >= start.getTime() && ct <= end.getTime();
  });
}

/** 本周 7 天（周一至周日）每日完成任务数 */
export function heatmapWeekCounts(tasks: Task[], weekStart: Date): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const ws = startOfDay(weekStart).getTime();
  for (const t of tasks) {
    if (!t.is_completed || !t.completed_at) continue;
    const ct = new Date(t.completed_at).getTime();
    if (ct < ws || ct > endOfDay(addDays(weekStart, 6)).getTime()) continue;
    const dayIndex = Math.floor((startOfDay(new Date(t.completed_at)).getTime() - ws) / 86400000);
    if (dayIndex >= 0 && dayIndex < 7) counts[dayIndex] += 1;
  }
  return counts;
}

const PROF_ORDER: Profession[] = ["Warrior", "Mage", "Explorer", "Artisan", "Guardian"];

export function professionCounts(tasks: Task[]): Record<Profession, number> {
  const base: Record<Profession, number> = {
    Warrior: 0,
    Mage: 0,
    Explorer: 0,
    Artisan: 0,
    Guardian: 0
  };
  for (const t of tasks) {
    if (!t.is_completed) continue;
    base[t.profession] = (base[t.profession] ?? 0) + 1;
  }
  return base;
}

const DIFF_RANK: Record<string, number> = { Hard: 3, Normal: 2, Simple: 1 };

export function pickHardestTaskThisWeek(weekTasks: Task[]): Task | null {
  let best: Task | null = null;
  let r = 0;
  for (const t of weekTasks) {
    const d = DIFF_RANK[t.difficulty] ?? 0;
    if (d > r) {
      r = d;
      best = t;
    } else if (d === r && best && (t.xp_reward ?? 0) > (best.xp_reward ?? 0)) {
      best = t;
    }
  }
  return best;
}

/** 近 30 天每日累计等级（由历史完成任务的 XP 反推） */
export function buildLevelSeriesLast30Days(allCompleted: Task[], currentXp: number): { day: string; level: number }[] {
  const today = startOfDay(new Date());
  const start = addDays(today, -29);
  const sorted = [...allCompleted]
    .filter((t) => t.completed_at)
    .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime());

  let sumInWindow = 0;
  for (const t of sorted) {
    const ct = new Date(t.completed_at!).getTime();
    if (ct >= start.getTime() && ct <= endOfDay(today).getTime()) sumInWindow += taskXp(t);
  }
  const xpBeforeWindow = Math.max(0, currentXp - sumInWindow);

  const dailyXp: number[] = [];
  for (let i = 0; i < 30; i++) {
    const day = addDays(start, i);
    const ds = startOfDay(day).getTime();
    const de = endOfDay(day).getTime();
    let d = 0;
    for (const t of sorted) {
      const ct = new Date(t.completed_at!).getTime();
      if (ct >= ds && ct <= de) d += taskXp(t);
    }
    dailyXp.push(d);
  }

  const out: { day: string; level: number }[] = [];
  let cum = xpBeforeWindow;
  for (let i = 0; i < 30; i++) {
    cum += dailyXp[i];
    out.push({ day: ymd(addDays(start, i)), level: getLevelFromXp(cum) });
  }
  return out;
}

export function sumTaskCrystalIncome(weekTasks: Task[]): number {
  return weekTasks.reduce((s, t) => s + (t.reward ?? 0), 0);
}

export function weekCrystalExpense(start: Date, end: Date): number {
  return sumCrystalSpendBetween(start.getTime(), end.getTime());
}

/** 规则模拟：超过 X% 冒险者（与本周完成数相关，稳定可复现） */
export function simulatedPercentileRank(weekCompleted: number, userId: string): number {
  const seed = weekCompleted * 17 + userId.length * 3;
  const base = 32 + weekCompleted * 6 + (seed % 23);
  return Math.min(97, Math.max(12, base));
}

export function updateMaxCheckinStreak(current: number): { max: number; isRecord: boolean } {
  if (typeof window === "undefined") return { max: current, isRecord: false };
  const prev = Number(localStorage.getItem(MAX_CHECKIN_STREAK_KEY) ?? "0");
  if (current > prev) {
    localStorage.setItem(MAX_CHECKIN_STREAK_KEY, String(current));
    return { max: current, isRecord: true };
  }
  return { max: Math.max(prev, current), isRecord: false };
}

function tierFromSkillXp(xp: number): number {
  let t = 0;
  for (let i = 0; i < SKILL_XP_THRESHOLDS.length; i++) {
    if (xp >= SKILL_XP_THRESHOLDS[i]) t = i + 1;
  }
  return t;
}

export function xpToNextSkillUnlock(professionXp: number): number {
  const tier = tierFromSkillXp(professionXp);
  if (tier >= SKILL_XP_THRESHOLDS.length) return 0;
  return SKILL_XP_THRESHOLDS[tier] - professionXp;
}

/** 近 7 天某职业任务获得的 XP 总量（用于技能预测） */
export function totalTaskXpLast7Days(tasks: Task[]): number {
  const end = endOfDay(new Date());
  const start = startOfDay(addDays(new Date(), -6));
  let s = 0;
  for (const t of tasks) {
    if (!t.is_completed || !t.completed_at) continue;
    const ct = new Date(t.completed_at).getTime();
    if (ct >= start.getTime() && ct <= end.getTime()) s += taskXp(t);
  }
  return s;
}

export function professionXpLast7Days(tasks: Task[], profession: Profession): number {
  const end = endOfDay(new Date());
  const start = startOfDay(addDays(new Date(), -6));
  let s = 0;
  for (const t of tasks) {
    if (!t.is_completed || !t.completed_at) continue;
    const ct = new Date(t.completed_at).getTime();
    if (ct < start.getTime() || ct > end.getTime()) continue;
    if (t.profession === profession) s += taskXp(t);
  }
  return s;
}

export function predictDaysToLevel(currentXp: number, last7dTaskXpSum: number): number | null {
  const perDay = last7dTaskXpSum / 7;
  if (perDay < 0.5) return null;
  const need = 1000 - (currentXp % 1000);
  if (need <= 0) return 1;
  return Math.max(1, Math.ceil(need / perDay));
}

export function predictDaysToSkillUnlock(
  profession: Profession,
  profile: UserProfile | null,
  last7dTasks: Task[]
): number | null {
  if (!profile?.skillTreeProgress) return null;
  const px = profile.skillTreeProgress.professionXp[profession] ?? 0;
  const need = xpToNextSkillUnlock(px);
  if (need <= 0) return null;
  const rate = professionXpLast7Days(last7dTasks, profession) / 7;
  if (rate < 0.3) return null;
  return Math.max(1, Math.ceil(need / rate));
}

export function primaryProfessionFromProfile(profile: UserProfile | null): Profession | null {
  if (!profile) return null;
  return CLASS_TO_PROFESSION[profile.primaryClass];
}

export { PROF_ORDER };
