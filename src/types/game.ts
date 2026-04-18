import type { AdventureEvent, Item, ItemRarity, ItemType, ShopItem, ShopRarity, VirtualCharacter } from "@/types/db";

/** 与 onboarding / userProfile 一致，避免循环依赖 */
export type GameClassKey = "warrior" | "mage" | "explorer" | "artisan" | "guardian";

export type GameRace =
  | "earlybird"
  | "nightowl"
  | "lonewolf"
  | "socialite"
  | "multitasker"
  | "ambient";

export type { AdventureEvent, Item, ItemRarity, ItemType, VirtualCharacter };

const SHOP_RARITY_TO_GAME: Record<ShopRarity, ItemRarity> = {
  Common: "common",
  Rare: "rare",
  Epic: "epic"
};

/** 将 Supabase shop_items 行映射为游戏 Item（无 type 列时默认 consumable） */
export function shopItemToGameItem(shop: ShopItem, type: ItemType = "consumable"): Item {
  return {
    id: shop.id,
    shopItemId: shop.id,
    name: shop.name,
    type,
    rarity: SHOP_RARITY_TO_GAME[shop.rarity] ?? "common",
    effects: {},
    description: shop.description
  };
}

const JOB_STAT_BIAS: Record<string, Partial<Pick<VirtualCharacter, "str" | "int" | "agi" | "cha" | "con">>> = {
  学生: { int: 2, con: 1 },
  职场新人: { agi: 2, cha: 1 },
  中层管理: { cha: 3, str: 2 },
  自由职业: { agi: 2, cha: 2 },
  博士在读: { int: 4, con: 1 },
  创业者: { str: 2, cha: 3 },
  其他: { str: 1, int: 1, agi: 1, cha: 1, con: 1 }
};

const CLASS_PRIMARY_STAT: Record<
  GameClassKey,
  keyof Pick<VirtualCharacter, "str" | "int" | "agi" | "cha" | "con">
> = {
  warrior: "str",
  mage: "int",
  explorer: "agi",
  artisan: "cha",
  guardian: "con"
};

const RACE_STAT_BIAS: Partial<
  Record<GameRace, Partial<Pick<VirtualCharacter, "str" | "int" | "agi" | "cha" | "con">>>
> = {
  earlybird: { agi: 1, con: 1 },
  nightowl: { int: 1, agi: 1 },
  lonewolf: { str: 1, int: 1 },
  socialite: { cha: 2 },
  multitasker: { agi: 1, int: 1 },
  ambient: {}
};

function clampStat(n: number, min = 5, max = 30): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export type VirtualCharacterInput = {
  realJob: string;
  race: string;
  primaryClass: string;
  secondaryClass: string;
};

/** 根据 onboarding 画像生成默认虚拟角色（基础属性 + 空装备 + 空日志） */
export function createDefaultVirtualCharacter(profile: VirtualCharacterInput): VirtualCharacter {
  const base = { str: 10, int: 10, agi: 10, cha: 10, con: 10 };
  const job = JOB_STAT_BIAS[profile.realJob] ?? JOB_STAT_BIAS["其他"];
  const raceKey = profile.race as GameRace;
  const race = RACE_STAT_BIAS[raceKey] ?? {};

  for (const k of ["str", "int", "agi", "cha", "con"] as const) {
    base[k] += (job[k] ?? 0) + (race[k] ?? 0);
  }

  const pClass = profile.primaryClass as GameClassKey;
  const sClass = profile.secondaryClass as GameClassKey;
  const pKey = CLASS_PRIMARY_STAT[pClass] ?? "str";
  const sKey = CLASS_PRIMARY_STAT[sClass] ?? "agi";
  base[pKey] += 4;
  if (sKey !== pKey) base[sKey] += 2;

  const str = clampStat(base.str);
  const int = clampStat(base.int);
  const agi = clampStat(base.agi);
  const cha = clampStat(base.cha);
  const con = clampStat(base.con);

  const maxHp = 80 + con * 8 + str * 2;
  const maxMp = 40 + int * 6 + agi * 2;

  return {
    str,
    int,
    agi,
    cha,
    con,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    equipment: {},
    adventureLog: [],
    stash: []
  };
}

export function appendAdventureLog(
  vc: VirtualCharacter,
  event: Omit<AdventureEvent, "id" | "at"> & { id?: string; at?: number }
): VirtualCharacter {
  const genId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now());
  const entry: AdventureEvent = {
    id: event.id ?? genId,
    at: event.at ?? Date.now(),
    kind: event.kind,
    message: event.message,
    meta: event.meta
  };
  return {
    ...vc,
    adventureLog: [entry, ...vc.adventureLog].slice(0, 100)
  };
}
