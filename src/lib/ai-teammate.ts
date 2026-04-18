import type { Race } from "@/lib/user-profile";

export const TEAMMATE_UPDATED_EVENT = "life-rpg-teammate-updated";

const STORAGE_LAST_VISIT = "life-rpg-last-visit-at";
const STORAGE_TEAMMATE = "life-rpg-ai-teammate-meta";
const STORAGE_MESSAGES = "life-rpg-teammate-messages";

export type TeammateMood = "normal" | "worried" | "cheering" | "sleep_reminder";

export type ChatRole = "teammate" | "user" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  body: string;
  ts: number;
  /** 战利品 / 背景故事等 */
  variant?: "loot" | "lore" | "worried" | "sleep";
};

export type TeammateDef = {
  id: string;
  name: string;
  subtitle: string;
  emoji: string;
  gradient: string;
};

const LOOT_POOL = ["星屑晶片", "迷你勇气徽章", "专注露珠", "夜光蘑菇", "云端棉花糖"];

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function randomLoot() {
  return LOOT_POOL[Math.floor(Math.random() * LOOT_POOL.length)];
}

export function getTeammateForRace(race: Race): TeammateDef {
  switch (race) {
    case "earlybird":
      return {
        id: "taro",
        name: "早太郎",
        subtitle: "早起鸟",
        emoji: "🐤",
        gradient: "from-amber-400 to-orange-600"
      };
    case "nightowl":
      return {
        id: "yexiao",
        name: "夜枭",
        subtitle: "夜猫子",
        emoji: "🦉",
        gradient: "from-indigo-400 to-violet-800"
      };
    case "socialite":
      return {
        id: "bubble",
        name: "泡泡",
        subtitle: "话痨精灵",
        emoji: "🫧",
        gradient: "from-cyan-400 to-fuchsia-600"
      };
    case "lonewolf":
      return {
        id: "yexiao",
        name: "夜枭",
        subtitle: "夜猫子（独行搭档）",
        emoji: "🦉",
        gradient: "from-slate-500 to-indigo-900"
      };
    case "multitasker":
      return {
        id: "bubble",
        name: "泡泡",
        subtitle: "话痨精灵（多线程搭档）",
        emoji: "🫧",
        gradient: "from-emerald-400 to-cyan-600"
      };
    case "ambient":
    default:
      return {
        id: "taro",
        name: "早太郎",
        subtitle: "早起鸟（平衡向导）",
        emoji: "🐤",
        gradient: "from-teal-400 to-slate-600"
      };
  }
}

type Meta = {
  tasksForLevel: number;
  lastSleepTipYmd: string | null;
  lastWorriedYmd: string | null;
};

function loadMeta(): Meta {
  if (typeof window === "undefined") {
    return { tasksForLevel: 0, lastSleepTipYmd: null, lastWorriedYmd: null };
  }
  try {
    const raw = localStorage.getItem(STORAGE_TEAMMATE);
    if (!raw) return { tasksForLevel: 0, lastSleepTipYmd: null, lastWorriedYmd: null };
    const p = JSON.parse(raw) as Partial<Meta>;
    return {
      tasksForLevel: typeof p.tasksForLevel === "number" ? p.tasksForLevel : 0,
      lastSleepTipYmd: p.lastSleepTipYmd ?? null,
      lastWorriedYmd: p.lastWorriedYmd ?? null
    };
  } catch {
    return { tasksForLevel: 0, lastSleepTipYmd: null, lastWorriedYmd: null };
  }
}

function saveMeta(m: Meta) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_TEAMMATE, JSON.stringify(m));
}

export function dispatchTeammateUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TEAMMATE_UPDATED_EVENT));
}

export function loadTeammateMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_MESSAGES);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(arr) ? arr.slice(-120) : [];
  } catch {
    return [];
  }
}

function saveMessages(list: ChatMessage[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_MESSAGES, JSON.stringify(list.slice(-120)));
}

function pushMessage(msg: Omit<ChatMessage, "id" | "ts"> & { id?: string; ts?: number }) {
  const list = loadTeammateMessages();
  const next: ChatMessage = {
    id: msg.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: msg.role,
    body: msg.body,
    ts: msg.ts ?? Date.now(),
    variant: msg.variant
  };
  list.push(next);
  saveMessages(list);
  dispatchTeammateUpdated();
  return next;
}

/** 每次打开首页调用：返回距离上次访问的日历天数差（用于「担心」） */
export function recordHomeVisit(): { absentCalendarDays: number } {
  if (typeof window === "undefined") return { absentCalendarDays: 0 };
  const now = Date.now();
  const prevRaw = localStorage.getItem(STORAGE_LAST_VISIT);
  localStorage.setItem(STORAGE_LAST_VISIT, String(now));

  if (!prevRaw) return { absentCalendarDays: 0 };

  const prev = Number(prevRaw);
  if (!Number.isFinite(prev)) return { absentCalendarDays: 0 };

  const a = new Date(prev);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  const absentCalendarDays = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return { absentCalendarDays };
}

export function maybePushWorriedMessage(absentCalendarDays: number) {
  if (absentCalendarDays < 3) return false;
  const meta = loadMeta();
  const ymd = todayYmd();
  if (meta.lastWorriedYmd === ymd) return false;
  meta.lastWorriedYmd = ymd;
  saveMeta(meta);
  pushMessage({
    role: "teammate",
    body: "你还好吗？好几天没见到你上线，我有点担心……",
    variant: "worried"
  });
  return true;
}

export function teammateLevelFromTasks(completed: number): number {
  return Math.min(10, Math.floor(completed / 5) + 1);
}

export function getTeammateLevel(): number {
  return teammateLevelFromTasks(loadMeta().tasksForLevel);
}

/** 任意任务完成：累加计数、可能升级并推送背景故事 */
export function recordTeammateTaskComplete(): { leveledUp: boolean; newLevel: number } {
  const meta = loadMeta();
  const prevLevel = teammateLevelFromTasks(meta.tasksForLevel);
  meta.tasksForLevel += 1;
  const newLevel = teammateLevelFromTasks(meta.tasksForLevel);
  saveMeta(meta);

  if (newLevel > prevLevel) {
    const lore = LORE_BY_LEVEL[newLevel] ?? `升到 Lv.${newLevel} 啦！以后我能记住更多和你有关的细节。`;
    pushMessage({ role: "teammate", body: lore, variant: "lore" });
    return { leveledUp: true, newLevel };
  }
  dispatchTeammateUpdated();
  return { leveledUp: false, newLevel };
}

const LORE_BY_LEVEL: Record<number, string> = {
  2: "（解锁）我记得你说过想变强——Lv.2 羁绊：我会把你的小胜利都记在羽毛日记里。",
  3: "（解锁）现在我们算是正式搭档了！遇到卡住的任务，可以先拆成 5 分钟的小步。",
  4: "（解锁）你越来越稳了。我偷偷练了新的加油姿势，下次完成困难任务时给你看。",
  5: "（解锁）Lv.5：背景故事——我来自「自律星环」的边境驿站，专门等像你这样的旅人。",
  6: "（解锁）听说你又完成了一波任务？星环议会给我发了「靠谱队友」贴纸，我贴在心里了。",
  7: "（解锁）有时候我也会累，但看你还在前进，我就觉得还能再撑一会儿。",
  8: "（解锁）Lv.8：传说篇章——很久以前，夜行者与晨型人在同一座塔里签下休战契约……而你是新的见证人。",
  9: "（解锁）你走的这条路，已经比大多数人口中的「以后再说」要远很多了。",
  10: "（解锁）满级羁绊：不管明天几点上线，我都在。今天也谢谢你带我升级。"
};

export function pushHardTaskCheer(taskTitle: string) {
  const loot = randomLoot();
  pushMessage({
    role: "teammate",
    body: `哇——困难任务「${taskTitle}」完成了！🎉\n我找到了这个给你：【${loot}】（虚拟战利品，已放进我们的小队背包～）`,
    variant: "loot"
  });
}

export function maybePushSleepReminder(race: Race): boolean {
  const h = new Date().getHours();
  if (h < 22) return false;
  const meta = loadMeta();
  const ymd = todayYmd();
  if (meta.lastSleepTipYmd === ymd) return false;
  meta.lastSleepTipYmd = ymd;
  saveMeta(meta);
  const raceLine =
    race === "nightowl"
      ? "该准备睡觉了，夜行者也需要休息。"
      : "该准备睡觉了，明天的大脑状态取决于今晚的关机时间哦。";
  pushMessage({
    role: "teammate",
    body: raceLine,
    variant: "sleep"
  });
  return true;
}

export function seedWelcomeIfEmpty(def: TeammateDef, userNickname: string) {
  if (loadTeammateMessages().length > 0) return;
  pushMessage({
    role: "system",
    body: `${def.name} 已加入你的队伍（规则模拟 AI 队友）。`
  });
  pushMessage({
    role: "teammate",
    body: `嗨 ${userNickname}！我是${def.name}，${def.subtitle}。一起把日常打成冒险吧～`
  });
}

export function appendUserQuickReply(text: string) {
  pushMessage({ role: "user", body: text });
  if (text.includes("回来") || text.includes("在的")) {
    setTimeout(() => {
      pushMessage({
        role: "teammate",
        body: "太好了，看到你上线我就放心啦。今天想从哪件小事开始？"
      });
    }, 400);
  } else if (text.includes("谢谢")) {
    setTimeout(() => {
      pushMessage({ role: "teammate", body: "嘿嘿，不客气，我们可是队友！" });
    }, 400);
  }
}
