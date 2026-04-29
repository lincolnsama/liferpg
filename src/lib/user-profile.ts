import type { Profession } from "@/types/db";
import {
  createDefaultVirtualCharacter,
  type AdventureEvent,
  type Item,
  type VirtualCharacter
} from "@/types/game";

/** 与 `types/game` 一致，供业务模块直接 `import type { VirtualCharacter } from '@/lib/user-profile'` */
export type { AdventureEvent, Item, VirtualCharacter };
import type { SkillTreeProgress } from "@/types/skill-progress";
import { defaultSkillTreeProgress } from "@/types/skill-progress";

export type Race =
  | "earlybird"
  | "nightowl"
  | "lonewolf"
  | "socialite"
  | "multitasker"
  | "ambient";

export type ClassKey = "warrior" | "mage" | "explorer" | "artisan" | "guardian";

export type UserGearFlags = {
  /** 连续 7 天打卡史诗装备是否已发放 */
  streakSevenEpicGranted?: boolean;
};

export type UserGearDaily = {
  /** 自然日首个任务创建后写入 YYYY-MM-DD，用于咖啡护符 */
  firstTaskCreatedYmd?: string;
};

export type UserCheckInMeta = {
  recorderBadgeUnlocked?: boolean;
};

/** 任务嵌入冒险：连续昏迷失败与强制休息冷却 */
export type TaskAdventureMeta = {
  consecutiveComaFailures: number;
  restCooldownUntil: number;
};

export type UserProfile = {
  nickname: string;
  realJob: string;
  mbti: string;
  birthMonth?: number;
  birthDay?: number;
  constellation: string;
  lifeStage?: string;
  education?: string;
  heightCm?: number;
  weightKg?: number;
  currentChallenge?: string;
  desiredSelf?: string;
  firstMainQuest?: string;
  race: Race;
  primaryClass: ClassKey;
  secondaryClass: ClassKey;
  matchScore: number;
  createdAt: number;
  /**
   * 虚拟角色：六维属性、HP/MP、三装备槽、`currentDungeon`（任务→地下城映射）、`adventureLog`。
   * 装备 / 消耗品为 `Item`，可与 `shop_items` 通过 `shopItemToGameItem` 打通。
   */
  virtualCharacter?: VirtualCharacter;
  /** 五职业技能树进度 */
  skillTreeProgress?: SkillTreeProgress;
  /** 使用专注药剂等：下一次完成任务 XP 乘数（如 1.5） */
  pendingXpMultiplier?: number;
  gearFlags?: UserGearFlags;
  gearDaily?: UserGearDaily;
  checkInMeta?: UserCheckInMeta;
  /** 任务嵌入冒险：连续昏迷失败与强制休息冷却 */
  taskAdventureMeta?: TaskAdventureMeta;
};

export const CLASS_TO_PROFESSION: Record<ClassKey, Profession> = {
  warrior: "Warrior",
  mage: "Mage",
  explorer: "Explorer",
  artisan: "Artisan",
  guardian: "Guardian"
};

export const PROFESSION_TO_CLASS: Record<Profession, ClassKey> = {
  Warrior: "warrior",
  Mage: "mage",
  Explorer: "explorer",
  Artisan: "artisan",
  Guardian: "guardian"
};

export const CLASS_LABEL: Record<ClassKey, string> = {
  warrior: "Warrior",
  mage: "Mage",
  explorer: "Explorer",
  artisan: "Artisan",
  guardian: "Guardian"
};

export const CLASS_ICON: Record<ClassKey, string> = {
  warrior: "⚔️",
  mage: "🔮",
  explorer: "🧭",
  artisan: "🛠️",
  guardian: "🛡️"
};

export const RACE_META: Record<Race, { name: string; icon: string; desc: string }> = {
  earlybird: { name: "晨型人", icon: "🌅", desc: "一日之计在于晨，上午任务额外加成" },
  nightowl: { name: "夜行者", icon: "🌙", desc: "夜色越深越高效，深夜任务收益提升" },
  lonewolf: { name: "独行侠", icon: "🐺", desc: "独处专注者，个人挑战更有爆发力" },
  socialite: { name: "社交蝴蝶", icon: "🦋", desc: "在互动中成长，社交类任务经验更高" },
  multitasker: { name: "多线程处理器", icon: "🧠", desc: "擅长连击推进，多任务日有额外收益" },
  ambient: { name: "环境型", icon: "🎧", desc: "平衡稳定，无惩罚型特性" }
};

export type ProfileHydrationRow = {
  nickname: string | null;
  real_job: string | null;
  mbti: string | null;
  birth_month: number | null;
  birth_day: number | null;
  constellation: string | null;
  life_stage: string | null;
  education: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  current_challenge: string | null;
  desired_self: string | null;
  first_main_quest: string | null;
  race: string | null;
  primary_class: string | null;
  secondary_class: string | null;
  match_score: number | null;
  created_at: string | null;
};

function isRace(value: string | null): value is Race {
  return Boolean(value && value in RACE_META);
}

function isClassKey(value: string | null): value is ClassKey {
  return Boolean(value && classOrderSet.has(value as ClassKey));
}

const classOrderSet = new Set<ClassKey>(["warrior", "mage", "explorer", "artisan", "guardian"]);

export function userProfileFromProfileRow(row: ProfileHydrationRow | null): UserProfile | null {
  if (!row?.nickname || !isRace(row.race) || !isClassKey(row.primary_class) || !isClassKey(row.secondary_class)) {
    return null;
  }

  return {
    nickname: row.nickname,
    realJob: row.real_job ?? "其他",
    mbti: row.mbti ?? "我不知道",
    birthMonth: row.birth_month ?? undefined,
    birthDay: row.birth_day ?? undefined,
    constellation: row.constellation ?? "未知",
    lifeStage: row.life_stage ?? undefined,
    education: row.education ?? undefined,
    heightCm: row.height_cm ?? undefined,
    weightKg: row.weight_kg ?? undefined,
    currentChallenge: row.current_challenge ?? undefined,
    desiredSelf: row.desired_self ?? undefined,
    firstMainQuest: row.first_main_quest ?? undefined,
    race: row.race,
    primaryClass: row.primary_class,
    secondaryClass: row.secondary_class,
    matchScore: row.match_score ?? 60,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    virtualCharacter: createDefaultVirtualCharacter({
      realJob: row.real_job ?? "其他",
      race: row.race,
      primaryClass: row.primary_class,
      secondaryClass: row.secondary_class
    }),
    skillTreeProgress: defaultSkillTreeProgress()
  };
}

export const loadUserProfile = (): UserProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("userProfile");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserProfile;
    let changed = false;
    if (!parsed.virtualCharacter && parsed.nickname) {
      parsed.virtualCharacter = createDefaultVirtualCharacter({
        realJob: parsed.realJob,
        race: parsed.race,
        primaryClass: parsed.primaryClass,
        secondaryClass: parsed.secondaryClass
      });
      changed = true;
    }
    if (!parsed.skillTreeProgress) {
      parsed.skillTreeProgress = defaultSkillTreeProgress();
      changed = true;
    }
    if (parsed.virtualCharacter && !parsed.virtualCharacter.stash) {
      parsed.virtualCharacter = { ...parsed.virtualCharacter, stash: [] };
      changed = true;
    }
    if (changed) {
      localStorage.setItem("userProfile", JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return null;
  }
};

export const saveUserProfile = (profile: UserProfile) => {
  if (typeof window === "undefined") return;
  localStorage.setItem("userProfile", JSON.stringify(profile));
};

type BonusResult = {
  multiplier: number;
  tags: string[];
};

export const computeTaskMultiplier = (
  profile: UserProfile | null,
  taskProfession: Profession,
  taskTitle: string,
  completionTime: Date,
  tasksCompletedToday: number
): BonusResult => {
  if (!profile) return { multiplier: 1, tags: [] };

  let multiplier = 1;
  const tags: string[] = [];

  const primary = CLASS_TO_PROFESSION[profile.primaryClass];
  const secondary = CLASS_TO_PROFESSION[profile.secondaryClass];

  if (taskProfession === primary) {
    multiplier *= 1.5;
    tags.push("主职业加成x1.5");
  } else if (taskProfession === secondary) {
    multiplier *= 1.25;
    tags.push("副职业加成x1.25");
  }

  const hour = completionTime.getHours();
  const text = taskTitle;

  if (profile.race === "earlybird" && hour >= 5 && hour < 12) {
    multiplier *= 1.2;
    tags.push("晨型人时段加成x1.2");
  }
  if (profile.race === "earlybird" && hour >= 19) {
    multiplier *= 0.9;
    tags.push("晨型人晚间衰减x0.9");
  }
  if (profile.race === "nightowl" && hour >= 22) {
    multiplier *= 1.3;
    tags.push("夜行者时段加成x1.3");
  }
  if (profile.race === "lonewolf" && !/社交|会议|协作|人脉|朋友|谈判/.test(text)) {
    multiplier *= 1.2;
    tags.push("独行侠个人任务加成x1.2");
  }
  if (profile.race === "socialite" && /社交|会议|协作|人脉|朋友|谈判/.test(text)) {
    multiplier *= 1.5;
    tags.push("社交蝴蝶社交任务加成x1.5");
  }
  if (profile.race === "multitasker" && tasksCompletedToday >= 2) {
    multiplier *= 1.5;
    tags.push("多线程连击加成x1.5");
  }

  return { multiplier, tags };
};

export const constellationFromMonthDay = (month: number, day: number): string => {
  const md = month * 100 + day;
  if (md >= 321 && md <= 419) return "白羊座";
  if (md >= 420 && md <= 520) return "金牛座";
  if (md >= 521 && md <= 621) return "双子座";
  if (md >= 622 && md <= 722) return "巨蟹座";
  if (md >= 723 && md <= 822) return "狮子座";
  if (md >= 823 && md <= 922) return "处女座";
  if (md >= 923 && md <= 1023) return "天秤座";
  if (md >= 1024 && md <= 1122) return "天蝎座";
  if (md >= 1123 && md <= 1221) return "射手座";
  if (md >= 1222 || md <= 119) return "摩羯座";
  if (md >= 120 && md <= 218) return "水瓶座";
  return "双鱼座";
};
