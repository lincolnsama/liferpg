const KEY = "life-rpg-crystal-spend-log";

export type CrystalSpendEntry = {
  amount: number;
  label: string;
  ts: number;
};

function loadAll(): CrystalSpendEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as CrystalSpendEntry[];
    return Array.isArray(arr) ? arr.slice(-500) : [];
  } catch {
    return [];
  }
}

function saveAll(list: CrystalSpendEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(-500)));
}

export function appendCrystalSpend(amount: number, label: string) {
  if (amount <= 0) return;
  const list = loadAll();
  list.push({ amount, label, ts: Date.now() });
  saveAll(list);
}

export function sumCrystalSpendBetween(startMs: number, endMs: number): number {
  return loadAll()
    .filter((e) => e.ts >= startMs && e.ts <= endMs)
    .reduce((s, e) => s + e.amount, 0);
}
