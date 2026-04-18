import type { Profession } from "@/types/db";
import type { Item } from "@/types/game";
import type { UserProfile } from "@/lib/user-profile";
import { CLASS_TO_PROFESSION } from "@/lib/user-profile";
import { hasMorningAttackBonus } from "@/lib/gear-inventory";

/** 场景背景：与职业常见场景对应的 CSS 渐变（战斗浮层全屏底） */
export const ADVENTURE_SCENE_BACKDROP: Record<string, string> = {
  library:
    "linear-gradient(160deg, #0f172a 0%, #1e1b4b 35%, #312e81 70%, #0c4a6e 100%)",
  forest:
    "linear-gradient(165deg, #022c22 0%, #064e3b 40%, #14532d 75%, #1c1917 100%)",
  arena:
    "linear-gradient(160deg, #1c1917 0%, #7f1d1d 45%, #431407 80%, #0f172a 100%)",
  workshop:
    "linear-gradient(165deg, #1c1917 0%, #713f12 38%, #78350f 72%, #0c0a09 100%)",
  temple:
    "linear-gradient(160deg, #0c0a09 0%, #1e3a8a 38%, #312e81 70%, #172554 100%)"
};

/** 根据场景关键词映射到 backdrop key */
export function backdropKeyFromSceneName(scene: string): keyof typeof ADVENTURE_SCENE_BACKDROP {
  if (/图书馆|奥术|禁忌/.test(scene)) return "library";
  if (/森林|迷雾|酒馆|边境/.test(scene)) return "forest";
  if (/竞技|要塞|黎明/.test(scene)) return "arena";
  if (/工坊|工匠|巨龙/.test(scene)) return "workshop";
  if (/圣殿|生命之泉|圣光/.test(scene)) return "temple";
  return "arena";
}

export function formatItemEffectsBrief(it: Item): string {
  const e = it.effects;
  const parts: string[] = [];
  if (e.str) parts.push(`STR +${e.str}`);
  if (e.int) parts.push(`INT +${e.int}`);
  if (e.agi) parts.push(`AGI +${e.agi}`);
  if (e.cha) parts.push(`CHA +${e.cha}`);
  if (e.con) parts.push(`CON +${e.con}`);
  if (e.xpBonus != null) parts.push(`任务 XP +${Math.round(e.xpBonus * 100)}%`);
  if (e.morningAttackMultiplier) parts.push(`早起线攻击 +${Math.round(e.morningAttackMultiplier * 100)}%`);
  return parts.join(" · ") || "—";
}

/** 自由冒险界面展示的 Buff 文案（与任务倍率规则对齐的可读版） */
export function getAdventureBuffDescriptions(profile: UserProfile | null, now = new Date()): string[] {
  if (!profile) return [];
  const hour = now.getHours();
  const out: string[] = [];
  if (profile.race === "earlybird" && hour >= 5 && hour < 12) {
    out.push("晨型人：上午攻击力 +20%");
  }
  if (profile.race === "earlybird" && hour >= 19) {
    out.push("晨型人：晚间攻击力 −10%");
  }
  if (profile.race === "nightowl" && hour >= 22) {
    out.push("夜行者：深夜攻击力 +30%");
  }
  const vc = profile.virtualCharacter;
  if (vc) {
    const m = hasMorningAttackBonus(vc, "晨间冒险热身");
    if (m > 0) {
      out.push(`晨光武装：晨间主题攻击 +${Math.round(m * 100)}%`);
    }
  }
  return out;
}

/** 与 `computeTaskMultiplier` 中种族时段一致的攻击乘数（仅战斗数值用） */
export function adventureAttackMultiplier(profile: UserProfile | null, now = new Date()): number {
  if (!profile) return 1;
  let m = 1;
  const hour = now.getHours();
  if (profile.race === "earlybird" && hour >= 5 && hour < 12) m *= 1.2;
  if (profile.race === "earlybird" && hour >= 19) m *= 0.9;
  if (profile.race === "nightowl" && hour >= 22) m *= 1.3;
  return m;
}

export function professionFromProfile(profile: UserProfile): Profession {
  return CLASS_TO_PROFESSION[profile.primaryClass];
}
