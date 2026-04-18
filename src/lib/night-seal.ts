import type { DailyLog } from "@/lib/daily-log";

export type DailySeal = {
  date: string;
  quote: string;
  summary: {
    tasksCompleted: number;
    totalXP: number;
    totalCrystals: number;
    topMonster: string;
  };
  streak: number;
};

const DB_NAME = "LifeRPG_Journal";
const DB_VERSION = 3;
const SEALS_STORE = "seals";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("dailyLogs")) {
        const store = db.createObjectStore("dailyLogs", { keyPath: "date" });
        store.createIndex("date", "date", { unique: true });
      }
      if (!db.objectStoreNames.contains("monthlySummaries")) {
        db.createObjectStore("monthlySummaries", { keyPath: "month" });
      }
      if (!db.objectStoreNames.contains(SEALS_STORE)) {
        db.createObjectStore(SEALS_STORE, { keyPath: "date" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<T> | T
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(SEALS_STORE, mode);
    const store = tx.objectStore(SEALS_STORE);
    let out!: T;
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    Promise.resolve(run(store))
      .then((v) => {
        out = v;
      })
      .catch(reject);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDailySeal(seal: DailySeal): Promise<void> {
  localStorage.setItem("lastSealDate", seal.date);
  localStorage.setItem("currentStreak", String(seal.streak));
  localStorage.setItem(`seal_${seal.date}`, JSON.stringify(seal));
  await withStore("readwrite", async (store) => {
    store.put(seal);
  });
}

export async function listSeals(): Promise<DailySeal[]> {
  return withStore("readonly", async (store) => {
    const rows = await reqToPromise(store.getAll() as IDBRequest<DailySeal[]>);
    return rows.sort((a, b) => (a.date > b.date ? -1 : 1));
  });
}

function toDate(date: string): number {
  return new Date(`${date}T00:00:00`).getTime();
}

export function calculateSealStreak(today: string): number {
  const last = localStorage.getItem("lastSealDate");
  const current = Number(localStorage.getItem("currentStreak") ?? "0");
  if (!last) return 1;
  const diff = toDate(today) - toDate(last);
  if (diff <= 0) return current || 1;
  if (diff <= 36 * 3600 * 1000) return current + 1;
  return 1;
}

export function daysSinceLastSeal(today: string): number {
  const last = localStorage.getItem("lastSealDate");
  if (!last) return 999;
  return Math.max(0, Math.round((toDate(today) - toDate(last)) / (24 * 3600 * 1000)));
}

export function buildDailySeal(log: DailyLog, quote: string): DailySeal {
  const topMonster =
    [...log.adventures]
      .sort((a, b) => b.rewards.xp - a.rewards.xp)
      .map((a) => a.monsterName)[0] ?? "无";
  const streak = calculateSealStreak(log.date);
  return {
    date: log.date,
    quote,
    summary: {
      tasksCompleted: log.summary.totalTasks,
      totalXP: log.summary.totalXP,
      totalCrystals: log.summary.totalCrystals,
      topMonster
    },
    streak
  };
}

export function romanDayNumber(n: number): string {
  const romans: Array<[number, string]> = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"]
  ];
  let x = Math.max(1, n);
  let out = "";
  for (const [v, s] of romans) {
    while (x >= v) {
      out += s;
      x -= v;
    }
  }
  return out;
}

export function recommendationFromWeek(logs: DailyLog[]): string {
  const week = logs.slice(0, 7);
  const total = week.reduce((s, l) => s + l.summary.totalTasks, 0);
  const target = 7;
  const remain = Math.max(0, target - total);
  if (remain > 0) return `再完成 ${Math.min(2, remain)} 个任务即可推进周常宝箱进度。`;
  const hardCount = week.flatMap((l) => l.adventures).filter((a) => a.difficulty === "hard").length;
  if (hardCount < 2) return "明日建议挑战 1 个困难任务，提升高阶掉落概率。";
  return "保持当前节奏，明日首役建议选择主职业任务冲刺。";
}
