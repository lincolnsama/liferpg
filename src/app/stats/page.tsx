"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { createClient } from "@/lib/supabase-browser";
import {
  buildLevelSeriesLast30Days,
  filterCompletedInRange,
  getThisWeekRange,
  heatmapWeekCounts,
  pickHardestTaskThisWeek,
  primaryProfessionFromProfile,
  predictDaysToLevel,
  predictDaysToSkillUnlock,
  professionCounts,
  PROF_ORDER,
  simulatedPercentileRank,
  sumTaskCrystalIncome,
  totalTaskXpLast7Days,
  updateMaxCheckinStreak,
  weekCrystalExpense,
  ymd
} from "@/lib/stats-helpers";
import { drawWeeklyReportToCanvas, downloadCanvasPng } from "@/lib/stats-report-canvas";
import { loadCosmetics } from "@/lib/cosmetics";
import { listDailyLogs, type DailyLog } from "@/lib/daily-log";
import { loadUserProfile, type UserProfile } from "@/lib/user-profile";
import { getLevelFromXp } from "@/lib/utils";
import type { Profession, Task } from "@/types/db";

const PROF_LABEL: Record<Profession, string> = {
  Warrior: "战士 Warrior",
  Mage: "法师 Mage",
  Explorer: "探索 Explorer",
  Artisan: "工匠 Artisan",
  Guardian: "守护 Guardian"
};

const PROF_COLOR: Record<Profession, string> = {
  Warrior: "#f87171",
  Mage: "#a78bfa",
  Explorer: "#34d399",
  Artisan: "#fbbf24",
  Guardian: "#38bdf8"
};

const WEEKDAY = ["一", "二", "三", "四", "五", "六", "日"];

function PieProfessions({ counts }: { counts: Record<Profession, number> }) {
  const total = PROF_ORDER.reduce((s, p) => s + counts[p], 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">暂无已完成任务，无法生成职业分布。</p>;
  }
  let angle = -Math.PI / 2;
  const r = 52;
  const cx = 60;
  const cy = 60;
  const slices: { path: string; color: string; p: Profession }[] = [];
  for (const p of PROF_ORDER) {
    const v = counts[p];
    if (v <= 0) continue;
    const a = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += a;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = a > Math.PI ? 1 : 0;
    slices.push({
      p,
      color: PROF_COLOR[p],
      path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
    });
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#0f172a" strokeWidth="1" />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {PROF_ORDER.map((p) => (
          <li key={p} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-slate-300">
              <span className="h-2 w-2 rounded-full" style={{ background: PROF_COLOR[p] }} />
              {PROF_LABEL[p]}
            </span>
            <span className="shrink-0 text-cyan-300">
              {counts[p]}（{Math.round((counts[p] / total) * 100)}%）
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeatmapWeek({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5">
        {counts.map((n, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div
              className="aspect-square w-full max-w-[2.75rem] rounded-md border border-slate-800 transition-colors"
              style={{
                backgroundColor: `rgba(34, 211, 238, ${0.08 + (n / max) * 0.92})`,
                boxShadow: n > 0 ? "0 0 12px rgba(34,211,238,0.25)" : undefined
              }}
              title={`${n} 个任务`}
            />
            <span className="text-[10px] text-slate-500">{WEEKDAY[i]}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">颜色越深 = 当天完成越多（GitHub 热力风格）</p>
    </div>
  );
}

function LineLevel30({ series }: { series: { day: string; level: number }[] }) {
  if (series.length === 0) return null;
  const levels = series.map((s) => s.level);
  const minL = Math.min(...levels);
  const maxL = Math.max(...levels);
  const pad = maxL === minL ? 1 : maxL - minL;
  const w = 320;
  const h = 140;
  const padX = 8;
  const padY = 12;
  const denom = Math.max(1, series.length - 1);
  const pts = series.map((s, i) => {
    const x = padX + (i / denom) * (w - padX * 2);
    const y = padY + (1 - (s.level - minL) / pad) * (h - padY * 2);
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full max-w-md">
      <defs>
        <linearGradient id="lvlLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#lvlLine)"
        strokeWidth="2.5"
        points={pts.join(" ")}
      />
      {series.map((s, i) => {
        const x = padX + (i / denom) * (w - padX * 2);
        const y = padY + (1 - (s.level - minL) / pad) * (h - padY * 2);
        return <circle key={s.day} cx={x} cy={y} r="3.5" fill="#e2e8f0" />;
      })}
      <text x={padX} y={h - 2} fill="#64748b" fontSize="9">
        {series[0]?.day.slice(5)} → {series[series.length - 1]?.day.slice(5)}
      </text>
    </svg>
  );
}

function WaterfallCrystals({ income, expense }: { income: number; expense: number }) {
  const net = income - expense;
  const max = Math.max(income, expense, Math.abs(net), 1);
  const hBar = (v: number) => `${Math.round((v / max) * 100)}%`;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full max-w-[5rem] flex-col justify-end rounded-lg bg-slate-800/80 p-1">
            <div
              className="w-full rounded bg-emerald-500/90 transition-all"
              style={{ height: hBar(income) }}
              title={`收入 ${income}`}
            />
          </div>
          <span className="text-center text-[11px] text-slate-400">任务收入</span>
          <span className="text-sm font-semibold text-emerald-400">+{income}</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full max-w-[5rem] flex-col justify-end rounded-lg bg-slate-800/80 p-1">
            <div
              className="w-full rounded bg-rose-500/90 transition-all"
              style={{ height: hBar(expense) }}
              title={`支出 ${expense}`}
            />
          </div>
          <span className="text-center text-[11px] text-slate-400">商店/外观支出</span>
          <span className="text-sm font-semibold text-rose-400">−{expense}</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-36 w-full max-w-[5rem] flex-col justify-end rounded-lg bg-slate-800/80 p-1">
            <div
              className="w-full rounded bg-cyan-500/90 transition-all"
              style={{ height: hBar(Math.abs(net)) }}
              title={`净 ${net}`}
            />
          </div>
          <span className="text-center text-[11px] text-slate-400">本周净值</span>
          <span className={`text-sm font-semibold ${net >= 0 ? "text-cyan-400" : "text-amber-400"}`}>
            {net >= 0 ? "+" : ""}
            {net}
          </span>
        </div>
      </div>
      <p className="text-xs text-slate-500">
        支出含商店兑换与外观晶石消费（自本功能上线起在本地记录）；早期消费可能未计入。
      </p>
    </div>
  );
}

export default function StatsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profileXp, setProfileXp] = useState(0);
  const [userId, setUserId] = useState("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [streakRecord, setStreakRecord] = useState(false);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);

  const load = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);
    const [{ data: prof }, { data: taskRows }] = await Promise.all([
      supabase.from("profiles").select("xp").eq("id", user.id).single(),
      supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_completed", true)
        .order("completed_at", { ascending: true })
    ]);
    setProfileXp((prof as { xp?: number })?.xp ?? 0);
    setTasks((taskRows as Task[]) ?? []);
    setUserProfile(loadUserProfile());
    setDailyLogs(await listDailyLogs());
    const cos = loadCosmetics();
    const { isRecord } = updateMaxCheckinStreak(cos.checkInStreak);
    setStreakRecord(isRecord);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const { start: weekStart, end: weekEnd, label: weekLabel } = useMemo(() => getThisWeekRange(), []);
  const weekTasks = useMemo(
    () => filterCompletedInRange(tasks, weekStart, weekEnd),
    [tasks, weekStart, weekEnd]
  );
  const heat = useMemo(() => heatmapWeekCounts(tasks, weekStart), [tasks, weekStart]);
  const countsAll = useMemo(() => professionCounts(tasks), [tasks]);
  const levelSeries = useMemo(() => buildLevelSeriesLast30Days(tasks, profileXp), [tasks, profileXp]);
  const crystalIn = useMemo(() => sumTaskCrystalIncome(weekTasks), [weekTasks]);
  const crystalOut = useMemo(() => weekCrystalExpense(weekStart, weekEnd), [weekStart, weekEnd]);
  const percentile = useMemo(
    () => simulatedPercentileRank(weekTasks.length, userId || "guest"),
    [weekTasks.length, userId]
  );
  const hardest = useMemo(() => pickHardestTaskThisWeek(weekTasks), [weekTasks]);
  const streak = loadCosmetics().checkInStreak;
  const level = getLevelFromXp(profileXp);
  const last7xp = useMemo(() => totalTaskXpLast7Days(tasks), [tasks]);
  const daysToLevel = useMemo(() => predictDaysToLevel(profileXp, last7xp), [profileXp, last7xp]);
  const primaryProf = primaryProfessionFromProfile(userProfile);
  const daysToSkill = useMemo(() => {
    if (!primaryProf) return null;
    return predictDaysToSkillUnlock(primaryProf, userProfile, tasks);
  }, [primaryProf, userProfile, tasks]);

  const checkinStreakStats = useMemo(() => {
    const days = [...dailyLogs].sort((a, b) => (a.date > b.date ? 1 : -1));
    let max = 0;
    let curr = 0;
    let prevDate = "";
    for (const d of days) {
      const has = d.checkIns.length > 0;
      if (!has) {
        curr = 0;
        prevDate = d.date;
        continue;
      }
      if (!prevDate) curr = 1;
      else {
        const pd = new Date(`${prevDate}T00:00:00`).getTime();
        const cd = new Date(`${d.date}T00:00:00`).getTime();
        curr = cd - pd <= 36 * 3600 * 1000 ? curr + 1 : 1;
      }
      prevDate = d.date;
      max = Math.max(max, curr);
    }
    return { current: curr, max };
  }, [dailyLogs]);

  const powerSeries = useMemo(
    () =>
      dailyLogs
        .slice()
        .sort((a, b) => (a.date > b.date ? 1 : -1))
        .map((d) => {
          const s = d.snapshot.stats;
          const power = Math.round(s.str * 1.2 + s.int * 1.2 + s.agi + s.cha + s.con * 1.3);
          return { date: d.date, power };
        }),
    [dailyLogs]
  );

  const equipmentProgress = useMemo(() => {
    const ids = new Set<string>();
    for (const d of dailyLogs) for (const i of d.summary.equipmentAcquired) ids.add(i.id);
    const total = 24;
    return { owned: ids.size, total };
  }, [dailyLogs]);

  const raceTriggerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of dailyLogs) {
      for (const tag of d.summary.raceBonusTriggered) {
        map[tag] = (map[tag] ?? 0) + 1;
      }
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [dailyLogs]);

  const exportPng = () => {
    const cos = loadCosmetics();
    const canvas = drawWeeklyReportToCanvas({
      weekLabel,
      weekCompleted: weekTasks.length,
      percentile,
      streak: cos.checkInStreak,
      streakRecord,
      hardestTitle: hardest?.title ?? "（本周暂无）",
      crystalIncome: crystalIn,
      crystalSpend: crystalOut,
      level,
      xp: profileXp
    });
    downloadCanvasPng(canvas, `人生周报-${ymd(new Date())}.png`);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="card">加载统计数据…</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">人生数据</h1>
          <p className="mt-1 text-sm text-slate-400">本周 {weekLabel} · 近 30 天趋势与晶石结构</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportPng}
            className="rounded-lg border border-cyan-600/60 bg-cyan-500/15 px-4 py-2 text-sm text-cyan-200 hover:bg-cyan-500/25"
          >
            导出本周人生报告（PNG）
          </button>
          <Link href="/tasks" className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">
            去做任务 →
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="card border-cyan-900/40 bg-gradient-to-br from-cyan-950/40 to-slate-900/80">
          <p className="text-sm text-slate-400">本周成就</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            本周完成 <span className="font-semibold text-cyan-300">{weekTasks.length}</span> 个任务，超过约{" "}
            <span className="font-semibold text-cyan-300">{percentile}%</span> 的冒险者（规则模拟）。
          </p>
        </div>
        <div className="card border-amber-900/40 bg-gradient-to-br from-amber-950/30 to-slate-900/80">
          <p className="text-sm text-slate-400">打卡</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            连续打卡 <span className="font-semibold text-amber-300">{checkinStreakStats.current || streak}</span> 天
            {streakRecord ? "，刷新个人记录！" : "。"}
          </p>
          <p className="mt-1 text-xs text-slate-400">历史最高：{checkinStreakStats.max} 天</p>
        </div>
        <div className="card border-fuchsia-900/40 bg-gradient-to-br from-fuchsia-950/30 to-slate-900/80">
          <p className="text-sm text-slate-400">最难一战</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-200">
            {hardest ? (
              <>
                「<span className="font-medium text-fuchsia-200">{hardest.title}</span>」
                <span className="text-slate-400">（{hardest.difficulty}）</span>，你做到了。
              </>
            ) : (
              "本周还没有完成任务，去任务页开一局吧。"
            )}
          </p>
        </div>
      </section>

      <section className="mb-6 card border-slate-700">
        <h2 className="mb-2 text-lg font-semibold text-slate-100">预测</h2>
        <p className="text-sm text-slate-300">
          {daysToLevel != null ? (
            <>
              按近 7 天任务 XP 均速，预计约 <span className="font-semibold text-cyan-300">{daysToLevel}</span>{" "}
              天后可升级（到达下一整千 XP 档）。
            </>
          ) : (
            "近 7 天任务偏少，暂无法稳定预测升级时间——先完成几个任务让曲线动起来。"
          )}
        </p>
        <p className="mt-2 text-sm text-slate-300">
          {primaryProf && daysToSkill != null ? (
            <>
              主职业「{PROF_LABEL[primaryProf]}」技能树：按近 7 天该职业任务 XP，预计约{" "}
              <span className="font-semibold text-violet-300">{daysToSkill}</span> 天可触及下一节点经验阈值。
            </>
          ) : primaryProf ? (
            "主职业技能下一节点：近 7 天该职业任务较少，预测暂不显示；多完成对应职业任务可提高置信度。"
          ) : (
            "完成 onboarding 后可解锁主职业技能预测。"
          )}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">本周热力图</h2>
          <HeatmapWeek counts={heat} />
        </section>
        <section className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">职业分布</h2>
          <p className="mb-4 text-xs text-slate-500">统计全部已完成任务，看你的冒险人格偏向哪一路。</p>
          <PieProfessions counts={countsAll} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">等级趋势（近 30 天）</h2>
          <p className="mb-4 text-xs text-slate-500">由历史任务 XP 反推每日累计等级；若早期任务未同步，曲线起点可能略保守。</p>
          <LineLevel30 series={levelSeries} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">晶石收支（本周）</h2>
          <WaterfallCrystals income={crystalIn} expense={crystalOut} />
        </section>
        <section className="card lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">战斗力成长曲线</h2>
          <div className="flex items-end gap-1 overflow-x-auto pb-2">
            {powerSeries.map((p) => (
              <div key={p.date} className="flex flex-col items-center gap-1">
                <div className="w-3 rounded-t bg-violet-400" style={{ height: `${Math.max(10, p.power / 4)}px` }} />
                <span className="text-[10px] text-slate-500">{p.date.slice(5)}</span>
              </div>
            ))}
            {powerSeries.length === 0 && <p className="text-sm text-slate-500">暂无成长数据。</p>}
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">装备收集进度</h2>
          <p className="text-sm text-slate-300">
            已收集 <span className="font-semibold text-cyan-300">{equipmentProgress.owned}</span> / {equipmentProgress.total}
          </p>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-cyan-500"
              style={{ width: `${Math.min(100, (equipmentProgress.owned / equipmentProgress.total) * 100)}%` }}
            />
          </div>
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">种族特性触发次数</h2>
          <div className="space-y-1 text-xs text-slate-300">
            {raceTriggerCounts.slice(0, 6).map(([k, v]) => (
              <p key={k}>
                {k}：<span className="text-cyan-300">{v}</span> 次
              </p>
            ))}
            {raceTriggerCounts.length === 0 && <p className="text-slate-500">暂无记录。</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
