import type { Item } from "@/types/game";

export type GearDef = {
  id: string;
  /** null = 不在晶石商店出售（仅掉落 / 成就） */
  shopCrystals: number | null;
  dropOnly?: boolean;
  /** 连续 7 天打卡时自动发放一次 */
  streakSevenReward?: boolean;
  item: Omit<Item, "id" | "catalogId">;
};

export const GEAR_DEFINITIONS: GearDef[] = [
  {
    id: "gear-dawnblade",
    shopCrystals: 280,
    item: {
      name: "晨光剑",
      type: "weapon",
      rarity: "rare",
      description:
        "剑身镀有薄曦，据说只在决心早起的冒险者手中才会嗡鸣。对「早起线」任务，虚拟冒险中的攻击力大幅提升。",
      effects: {
        str: 3,
        morningAttackMultiplier: 0.5
      }
    }
  },
  {
    id: "gear-scholar-robe",
    shopCrystals: 260,
    item: {
      name: "学者长袍",
      type: "armor",
      rarity: "rare",
      description:
        "袖口缝满细小符文，能压缩「阅读」类任务的心流阻力——预计耗时在规则上略微缩短。",
      effects: {
        int: 2,
        readingMinuteReduction: 10
      }
    }
  },
  {
    id: "gear-coffee-charm",
    shopCrystals: 120,
    item: {
      name: "咖啡护符",
      type: "accessory",
      rarity: "epic",
      description:
        "豆香封印在琥珀里。每个自然日的首个任务，叙事上 MP 消耗减半——映射为创建时预计耗时折半（下限保留）。",
      effects: {
        firstDailyMinuteFactor: 0.5
      }
    }
  },
  {
    id: "gear-focus-potion",
    shopCrystals: 40,
    item: {
      name: "专注药剂",
      type: "consumable",
      rarity: "common",
      description: "摇晃时泛起薄荷色泡沫。饮用后，下一次完成任务时 XP 额外 +50%。",
      effects: {
        xpBonus: 0.5
      }
    }
  },
  {
    id: "gear-starfang-blade",
    shopCrystals: null,
    dropOnly: true,
    item: {
      name: "星辉短刃",
      type: "weapon",
      rarity: "rare",
      description: "困难任务中偶得的折光碎片锻成，刃纹像未完成的星图。",
      effects: { str: 2, agi: 1 }
    }
  },
  {
    id: "gear-daybreak-crown",
    shopCrystals: null,
    streakSevenReward: true,
    item: {
      name: "破晓冠冕",
      type: "accessory",
      rarity: "epic",
      description:
        "连续七日与晨光同步的证明。冠冕轻若无物，却能让「学有所成」的回报在叙事上更显赫。",
      effects: { int: 1, cha: 1 }
    }
  }
];

export function getGearDef(id: string): GearDef | undefined {
  return GEAR_DEFINITIONS.find((g) => g.id === id);
}

export function itemFromGearDef(def: GearDef): Item {
  return {
    ...def.item,
    id: def.id,
    catalogId: def.id
  };
}

export function shopGearList(): GearDef[] {
  return GEAR_DEFINITIONS.filter((g) => g.shopCrystals != null && g.shopCrystals > 0);
}

export const DROP_TABLE_HARD: { id: string; weight: number }[] = [
  { id: "gear-starfang-blade", weight: 1 }
];
