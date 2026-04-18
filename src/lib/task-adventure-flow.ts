import type { Difficulty, Profession } from "@/types/db";
import type { TaskAdventureMeta, UserProfile } from "@/lib/user-profile";
import { getGearDef } from "@/lib/equipment-catalog";
import { pickAdventureMonster, pickAdventureScene } from "@/lib/adventure-system";

export type TaskBriefing = {
  scene: string;
  monsterName: string;
  /** 随机生成的预览 HP */
  monsterHp: number;
  /** 预计遭遇类型（叙事） */
  monsterArchetype: string;
  gearTip: string;
  seed: string;
};

const MONSTER_ARCHETYPE: Record<Difficulty, string> = {
  Simple: "小型游荡魔物（史莱姆 / 地精类）",
  Normal: "精英级魔物（哥布林战士 / 暗影狼等）",
  Hard: "首领级威胁（论文恶魔 / deadline 巨龙等）"
};

function rand01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** 探索总时长：与预计分钟挂钩，限制在 2～20 分钟 */
export function exploreDurationSeconds(estimatedMinutes: number): number {
  const scaled = Math.round(estimatedMinutes * 4);
  return Math.min(20 * 60, Math.max(120, scaled));
}

export function buildTaskBriefing(input: {
  title: string;
  profession: Profession;
  difficulty: Difficulty;
}): TaskBriefing {
  const seed = `${input.title}|${input.profession}|${input.difficulty}|${Date.now()}`;
  const scene = pickAdventureScene(input.profession, seed);
  const monster = pickAdventureMonster(input.difficulty, seed + "pre");
  const gearTip = buildGearTip(input.title);
  return {
    scene,
    monsterName: monster.name,
    monsterHp: monster.hp,
    monsterArchetype: MONSTER_ARCHETYPE[input.difficulty],
    gearTip,
    seed
  };
}

function buildGearTip(title: string): string {
  const hour = new Date().getHours();
  const morningTask = /早起|晨跑|晨型|起床|黎明|清晨|早餐前/.test(title);
  const dawn = getGearDef("gear-dawnblade");
  if ((hour >= 5 && hour < 12) || morningTask) {
    return `建议携带「${dawn?.item.name ?? "晨光剑"}」应对晨间挑战。`;
  }
  const robe = getGearDef("gear-scholar-robe");
  if (/阅读|读书|论文|文献/.test(title)) {
    return `建议携带「${robe?.item.name ?? "学者长袍"}」压缩阅读类心流阻力。`;
  }
  return "检查武器与护甲是否已装备；饰品可带咖啡护符缩短每日首个任务预计耗时。";
}

export type QuarterKind = "encounter" | "chest" | "rest";

export function quarterPlan(difficulty: Difficulty): QuarterKind[] {
  if (difficulty === "Hard") return ["encounter", "encounter", "rest", "encounter"];
  if (difficulty === "Simple") return ["encounter", "rest", "chest", "encounter"];
  return ["encounter", "chest", "rest", "encounter"];
}

export function quarterNarration(input: {
  scene: string;
  profession: Profession;
  difficulty: Difficulty;
  kind: QuarterKind;
  quarterIndex: number;
  seed: string;
}): string {
  const { scene, kind, quarterIndex, seed } = input;
  const r = rand01(seed + "q" + quarterIndex);
  if (kind === "chest") {
    return `在「${scene}」的岔路，你发现一只覆尘的宝箱。锁扣已朽，轻轻一推便开——里面是些许晶尘与一张写着「专注」的便签。`;
  }
  if (kind === "rest") {
    return `你找到一处安全的休息点：石凳上刻着前人留下的鼓励语。你合上眼数息，呼吸与心跳重新对齐迷宫的节律。`;
  }
  const hits = ["阴影窜出", "风声骤紧", "地面微震"];
  const hit = hits[Math.floor(r * hits.length)]!;
  return `深入「${scene}」时，${hit}——一场短暂交锋展开。你稳住脚步，将威胁逼退。`;
}

export function bossNarration(scene: string, monsterName: string, seed: string): string {
  const r = rand01(seed + "boss");
  const flair = r < 0.33 ? "空气像被拉紧的弓弦" : r < 0.66 ? "回声在穹顶下叠成低吼" : "地面浮现不祥的符文光";
  return `BOSS 战：${flair}，${monsterName}挡在出口前。你集中残存的气力，准备终结这场迷宫试炼。`;
}

export function encounterHpLoss(maxHp: number, difficulty: Difficulty, seed: string): number {
  const r = rand01(seed + "dmg");
  const pct = difficulty === "Hard" ? 0.08 + r * 0.1 : difficulty === "Normal" ? 0.06 + r * 0.08 : 0.04 + r * 0.06;
  return Math.max(2, Math.floor(maxHp * pct));
}

export function chestHeal(maxHp: number, seed: string): number {
  return Math.max(3, Math.floor(maxHp * (0.06 + rand01(seed + "ch") * 0.05)));
}

export function restHeal(maxHp: number): number {
  return Math.max(4, Math.floor(maxHp * 0.1));
}

export function ensureTaskAdventureMeta(p: UserProfile): TaskAdventureMeta {
  return (
    p.taskAdventureMeta ?? {
      consecutiveComaFailures: 0,
      restCooldownUntil: 0
    }
  );
}

/** 冷却结束后清零连败计数，避免状态栏长期显示「3 连」 */
export function clearExpiredTaskAdventureCooldown(profile: UserProfile): UserProfile {
  const m = ensureTaskAdventureMeta(profile);
  if (m.consecutiveComaFailures >= 3 && Date.now() >= m.restCooldownUntil) {
    return {
      ...profile,
      taskAdventureMeta: { consecutiveComaFailures: 0, restCooldownUntil: 0 }
    };
  }
  return profile;
}

export function isTaskExploreBlocked(profile: UserProfile | null): { blocked: boolean; message?: string } {
  if (!profile) return { blocked: false };
  const m = ensureTaskAdventureMeta(profile);
  if (m.consecutiveComaFailures >= 3 && Date.now() < m.restCooldownUntil) {
    const mins = Math.ceil((m.restCooldownUntil - Date.now()) / 60000);
    return {
      blocked: true,
      message: `需要休息恢复 HP：连续 3 次在迷宫中昏迷，请在约 ${mins} 分钟后再开始新的冒险。`
    };
  }
  return { blocked: false };
}

export function onTaskComaFailure(profile: UserProfile): UserProfile {
  const prev = ensureTaskAdventureMeta(profile);
  const nextCount = prev.consecutiveComaFailures + 1;
  const restCooldownUntil =
    nextCount >= 3 ? Math.max(prev.restCooldownUntil, Date.now() + 45 * 60 * 1000) : prev.restCooldownUntil;
  return {
    ...profile,
    taskAdventureMeta: {
      consecutiveComaFailures: nextCount,
      restCooldownUntil
    }
  };
}

export function onTaskAdventureSuccess(profile: UserProfile): UserProfile {
  return {
    ...profile,
    taskAdventureMeta: {
      consecutiveComaFailures: 0,
      restCooldownUntil: 0
    }
  };
}
