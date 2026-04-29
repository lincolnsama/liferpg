export type Profession = "Warrior" | "Mage" | "Explorer" | "Artisan" | "Guardian";

export type Difficulty = "Simple" | "Normal" | "Hard";

/** 专注番茄钟 / 事后记账 */
export type TaskMode = "focus" | "log";

/** 每日闭环：主线 / 支线 / 日常（可空表示未分类） */
export type TaskTrack = "main" | "side" | "daily";

export const DIFFICULTY_CRYSTAL_REWARD: Record<Difficulty, number> = {
  Simple: 10,
  Normal: 20,
  Hard: 40
};

export const DIFFICULTY_XP_REWARD: Record<Difficulty, number> = {
  Simple: 10,
  Normal: 25,
  Hard: 60
};

export const DIFFICULTY_ESTIMATED_MINUTES: Record<Difficulty, number> = {
  Simple: 10,
  Normal: 30,
  Hard: 90
};

export type Profile = {
  id: string;
  profession: Profession | null;
  xp: number;
  crystals: number;
};

export type Task = {
  id: string;
  user_id: string;
  title: string;
  profession: Profession;
  difficulty: Difficulty;
  reward: number;
  xp_reward?: number;
  estimated_minutes?: number;
  /**
   * 实际耗时（分钟），用于结算与防刷。
   * 产品侧可视为 `actualDuration`；数据库列为 `actual_minutes`。
   */
  actual_minutes?: number | null;
  /** 专注 `focus` / 事后记账 `log`（列名 `task_mode`） */
  task_mode?: TaskMode | null;
  focus_ready?: boolean | null;
  explore_coma?: boolean | null;
  explore_started_at?: string | null;
  explore_total_seconds?: number | null;
  early_complete?: boolean | null;
  /** 任务页创建时选的轨道；旧数据为 null */
  task_track?: TaskTrack | null;
  profession_bonus_applied?: boolean;
  anti_cheat_flag?: boolean;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
};

export type ShopRarity = "Common" | "Rare" | "Epic";

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  rarity: ShopRarity;
  created_at: string;
};

export type UserItem = {
  id: string;
  user_id: string;
  item_id: string;
  quantity: number;
  acquired_at: string;
  shop_items?: ShopItem;
};

/** 装备稀有度（与商店 `ShopRarity` 映射在 `game.ts` 的 `shopItemToGameItem`） */
export type ItemRarity = "common" | "rare" | "epic" | "legendary";

export type ItemType = "weapon" | "armor" | "accessory" | "consumable";

/**
 * 装备 / 道具（虚拟冒险与背包共用）。
 * 与 `UserProfile.virtualCharacter`、装备目录一致。
 */
export type Item = {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  catalogId?: string;
  shopItemId?: string;
  effects: {
    str?: number;
    int?: number;
    agi?: number;
    cha?: number;
    con?: number;
    xpBonus?: number;
    timeReduction?: number;
    morningAttackMultiplier?: number;
    readingMinuteReduction?: number;
    firstDailyMinuteFactor?: number;
  };
  description: string;
};

/** 冒险日志单条（文字 RPG 事件流与战报） */
export type AdventureEvent = {
  id: string;
  at: number;
  kind:
    | "dungeon_enter"
    | "task_complete"
    | "shop_buy"
    | "level_up"
    | "note"
    | "adventure_chronicle";
  message: string;
  meta?: Record<string, string | number | boolean>;
};

/**
 * 虚拟角色面板（序列化在本地 `UserProfile.virtualCharacter`）。
 */
export type VirtualCharacter = {
  str: number;
  int: number;
  agi: number;
  cha: number;
  con: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  equipment: {
    weapon?: Item;
    armor?: Item;
    accessory?: Item;
  };
  currentDungeon?: string;
  adventureLog: AdventureEvent[];
  stash?: Array<{ catalogId: string; quantity: number }>;
};
