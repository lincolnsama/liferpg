import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCrystalSpend } from "@/lib/crystal-spend-log";
import type { ShopRarity } from "@/types/db";

export type ShopCategory = "theme" | "focus_bg" | "frame";

export type UnlockType = "crystal" | "achievement" | "streak7";

/** 非数据库道具/皮肤目录项（道具类仍走 shop_items + RPC） */
export type CatalogItem = {
  id: string;
  category: ShopCategory;
  name: string;
  description: string;
  rarity: ShopRarity;
  unlock: UnlockType;
  /** 晶石价格；成就/打卡类为 0 */
  price: number;
  /** 成就 key：本地计数满足后可领取 */
  achievementKey?: "tasks_10" | "level_5";
};

export type CosmeticsState = {
  ownedIds: string[];
  equippedThemeId: string;
  equippedFrameId: string;
  equippedFocusBgId: string;
  /** 连续打卡（自然日） */
  checkInStreak: number;
  lastCheckInKey: string;
  /** 本地累计完成任务次数（用于成就框） */
  tasksCompletedLocal: number;
};

const STORAGE_KEY = "life-rpg-cosmetics";

export const COSMETICS_UPDATED_EVENT = "life-rpg-cosmetics-updated";

export const dispatchCosmeticsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(COSMETICS_UPDATED_EVENT));
};

export const CATALOG: CatalogItem[] = [
  {
    id: "theme-cyber",
    category: "theme",
    name: "赛博蓝",
    description: "经典霓虹蓝紫科技风主色。",
    rarity: "Common",
    unlock: "crystal",
    price: 0
  },
  {
    id: "theme-forest",
    category: "theme",
    name: "森林绿",
    description: "自然沉稳，护眼向主色。",
    rarity: "Common",
    unlock: "crystal",
    price: 180
  },
  {
    id: "theme-samurai",
    category: "theme",
    name: "武士红",
    description: "凌厉赤色，执行力拉满。",
    rarity: "Common",
    unlock: "crystal",
    price: 180
  },
  {
    id: "theme-mage",
    category: "theme",
    name: "法师紫",
    description: "奥术紫罗兰，偏认知与魔法感。",
    rarity: "Common",
    unlock: "crystal",
    price: 180
  },
  {
    id: "focus-rain",
    category: "focus_bg",
    name: "雨声森林",
    description: "番茄专注全屏背景：细雨与深林。",
    rarity: "Common",
    unlock: "crystal",
    price: 120
  },
  {
    id: "focus-cafe",
    category: "focus_bg",
    name: "咖啡厅午后",
    description: "番茄专注全屏背景：暖光与咖啡香气。",
    rarity: "Common",
    unlock: "crystal",
    price: 120
  },
  {
    id: "focus-cosmic",
    category: "focus_bg",
    name: "宇宙深空",
    description: "番茄专注全屏背景：星云与深空粒子。",
    rarity: "Epic",
    unlock: "streak7",
    price: 0
  },
  {
    id: "frame-none",
    category: "frame",
    name: "无框",
    description: "默认头像框。",
    rarity: "Common",
    unlock: "crystal",
    price: 0
  },
  {
    id: "frame-bronze",
    category: "frame",
    name: "青铜冒险者",
    description: "稀有：完成 10 个任务后解锁领取。",
    rarity: "Rare",
    unlock: "achievement",
    price: 0,
    achievementKey: "tasks_10"
  },
  {
    id: "frame-gold",
    category: "frame",
    name: "黄金徽记",
    description: "稀有：角色等级达到 Lv.5 后解锁领取。",
    rarity: "Rare",
    unlock: "achievement",
    price: 0,
    achievementKey: "level_5"
  },
  {
    id: "frame-streak-epic",
    category: "frame",
    name: "七日誓约",
    description: "史诗：连续 7 天打卡后解锁领取。",
    rarity: "Epic",
    unlock: "streak7",
    price: 0
  }
];

export const THEME_DATA_ATTR: Record<string, string> = {
  "theme-cyber": "cyber",
  "theme-forest": "forest",
  "theme-samurai": "samurai",
  "theme-mage": "mage"
};

export const defaultCosmetics = (): CosmeticsState => ({
  ownedIds: ["theme-cyber", "frame-none", "focus-rain"],
  equippedThemeId: "theme-cyber",
  equippedFrameId: "frame-none",
  equippedFocusBgId: "focus-rain",
  checkInStreak: 0,
  lastCheckInKey: "",
  tasksCompletedLocal: 0
});

export function loadCosmetics(): CosmeticsState {
  if (typeof window === "undefined") return defaultCosmetics();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCosmetics();
    const parsed = JSON.parse(raw) as CosmeticsState;
    const base = defaultCosmetics();
    return {
      ...base,
      ...parsed,
      ownedIds: Array.from(new Set([...base.ownedIds, ...(parsed.ownedIds ?? [])]))
    };
  } catch {
    return defaultCosmetics();
  }
}

export function saveCosmetics(next: CosmeticsState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  dispatchCosmeticsUpdated();
}

export function getCatalogByCategory(category: ShopCategory) {
  return CATALOG.filter((c) => c.category === category);
}

export function getCollectibleCatalog() {
  return CATALOG;
}

export function collectionStats(state: CosmeticsState) {
  const all = getCollectibleCatalog();
  const owned = all.filter((c) => state.ownedIds.includes(c.id));
  const pct = all.length === 0 ? 0 : Math.round((owned.length / all.length) * 100);
  return { total: all.length, owned: owned.length, pct };
}

/** 自然日打卡：连续 +1；中断则重置为 1 */
export function recordDailyCheckIn(): CosmeticsState {
  const state = loadCosmetics();
  const today = new Date();
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (state.lastCheckInKey === key) {
    return state;
  }
  let streak = 1;
  if (state.lastCheckInKey) {
    const prev = new Date(`${state.lastCheckInKey}T12:00:00`);
    const todayNoon = new Date(`${key}T12:00:00`);
    const diffDays = Math.round((todayNoon.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) streak = state.checkInStreak + 1;
    else streak = 1;
  }
  const next = { ...state, lastCheckInKey: key, checkInStreak: streak };
  saveCosmetics(next);
  return next;
}

export function incrementLocalTaskComplete(): CosmeticsState {
  const state = loadCosmetics();
  const next = { ...state, tasksCompletedLocal: state.tasksCompletedLocal + 1 };
  saveCosmetics(next);
  return next;
}

export function catalogItemById(id: string) {
  return CATALOG.find((c) => c.id === id);
}

export function equipCatalogItem(id: string): CosmeticsState | null {
  const item = catalogItemById(id);
  if (!item) return null;
  const state = loadCosmetics();
  if (!state.ownedIds.includes(id)) return null;
  const next = { ...state };
  if (item.category === "theme") next.equippedThemeId = id;
  if (item.category === "focus_bg") next.equippedFocusBgId = id;
  if (item.category === "frame") next.equippedFrameId = id;
  saveCosmetics(next);
  return next;
}

export async function purchaseWithCrystals(
  supabase: SupabaseClient,
  profileId: string,
  currentCrystals: number,
  item: CatalogItem
): Promise<{ ok: boolean; error?: string; newCrystals?: number }> {
  if (item.unlock !== "crystal") {
    return { ok: false, error: "非晶石商品" };
  }
  if (item.price > 0 && currentCrystals < item.price) {
    return { ok: false, error: "晶石不足" };
  }
  if (item.price <= 0) {
    return { ok: false, error: "请直接领取" };
  }
  const newCrystals = currentCrystals - item.price;
  const { error } = await supabase.from("profiles").update({ crystals: newCrystals }).eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  appendCrystalSpend(item.price, `外观：${item.name}`);
  const state = loadCosmetics();
  const owned = new Set(state.ownedIds);
  owned.add(item.id);
  const next: CosmeticsState = {
    ...state,
    ownedIds: Array.from(owned)
  };
  if (item.category === "theme") next.equippedThemeId = item.id;
  if (item.category === "focus_bg") next.equippedFocusBgId = item.id;
  if (item.category === "frame") next.equippedFrameId = item.id;
  saveCosmetics(next);
  return { ok: true, newCrystals };
}

export function canClaimAchievement(item: CatalogItem, level: number, cosmetics: CosmeticsState): boolean {
  if (item.unlock !== "achievement" || !item.achievementKey) return false;
  if (cosmetics.ownedIds.includes(item.id)) return false;
  if (item.achievementKey === "tasks_10") return cosmetics.tasksCompletedLocal >= 10;
  if (item.achievementKey === "level_5") return level >= 5;
  return false;
}

export function canClaimStreak7(item: CatalogItem, cosmetics: CosmeticsState): boolean {
  if (item.unlock !== "streak7") return false;
  if (cosmetics.ownedIds.includes(item.id)) return false;
  return cosmetics.checkInStreak >= 7;
}

export function claimFreeItem(item: CatalogItem): CosmeticsState | null {
  const state = loadCosmetics();
  const owned = new Set(state.ownedIds);
  owned.add(item.id);
  const next: CosmeticsState = { ...state, ownedIds: Array.from(owned) };
  if (item.category === "theme") next.equippedThemeId = item.id;
  if (item.category === "focus_bg") next.equippedFocusBgId = item.id;
  if (item.category === "frame") next.equippedFrameId = item.id;
  saveCosmetics(next);
  return next;
}

export const FRAME_RING_CLASS: Record<string, string> = {
  "frame-none": "ring-1 ring-slate-600",
  "frame-bronze": "ring-2 ring-amber-600/80 ring-offset-2 ring-offset-slate-950 shadow-amber-500/20",
  "frame-gold": "ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-950 shadow-yellow-400/30",
  "frame-streak-epic": "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-slate-950 shadow-fuchsia-500/40"
};

export const THEME_LABEL: Record<string, string> = {
  "theme-cyber": "赛博蓝",
  "theme-forest": "森林绿",
  "theme-samurai": "武士红",
  "theme-mage": "法师紫"
};
