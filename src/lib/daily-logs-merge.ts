import type { DailyLog } from "@/lib/daily-log";
import { listDailyLogs } from "@/lib/daily-log";
import { createClient } from "@/lib/supabase-browser";

/**
 * 合并本地 IndexedDB 日志与 Supabase `daily_logs`（夜间封存写入），
 * 已封存日在服务端为准，便于换设备回看。
 */
export async function listMergedDailyLogs(): Promise<DailyLog[]> {
  const local = await listDailyLogs();
  const byDate = new Map<string, DailyLog>(local.map((l) => [l.date, { ...l }]));

  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return local;
  }

  const { data: rows, error } = await supabase
    .from("daily_logs")
    .select("log_date, payload, sealed_at")
    .eq("user_id", user.id)
    .not("sealed_at", "is", null)
    .order("log_date", { ascending: false })
    .limit(180);

  if (error || !rows?.length) {
    return local;
  }

  for (const row of rows) {
    if (!row.sealed_at || !row.payload) continue;
    const d = typeof row.log_date === "string" ? row.log_date.slice(0, 10) : String(row.log_date).slice(0, 10);
    const remote = row.payload as DailyLog;
    if (!remote?.summary) continue;
    byDate.set(d, { ...remote, date: d });
  }

  return [...byDate.values()].sort((a, b) => (a.date > b.date ? -1 : 1));
}
