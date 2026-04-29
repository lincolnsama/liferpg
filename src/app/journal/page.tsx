"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { MvpPageHeader } from "@/components/mvp-page-header";
import {
  addManualMilestone,
  buildMilestones,
  buildWeeklyBookPages,
  compareSnapshotsByDate,
  difficultyColor,
  heatValue,
  listMonthlySummaries,
  sealTodayJournal,
  type DailyLog
} from "@/lib/daily-log";
import { listMergedDailyLogs } from "@/lib/daily-logs-merge";
import { GENTLE_COPY } from "@/lib/growth-narrative";
import { listSeals, type DailySeal } from "@/lib/night-seal";

export default function JournalPage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [monthly, setMonthly] = useState<Array<{ month: string; totalTasks: number; totalXP: number }>>([]);
  const [view, setView] = useState<"timeline" | "heatmap" | "book">("timeline");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [bookPage, setBookPage] = useState(0);
  const [msTitle, setMsTitle] = useState("");
  const [msDate, setMsDate] = useState(new Date().toISOString().slice(0, 10));
  const [compareDay1, setCompareDay1] = useState("");
  const [compareDay2, setCompareDay2] = useState("");
  const [seals, setSeals] = useState<DailySeal[]>([]);

  const refreshLogs = async () => {
    const merged = await listMergedDailyLogs();
    setLogs(merged);
    const rows = await listMonthlySummaries();
    setMonthly(rows.map((r) => ({ month: r.month, totalTasks: r.totalTasks, totalXP: r.totalXP })));
    void listSeals().then(setSeals);
  };

  useEffect(() => {
    void refreshLogs();
  }, []);

  const sealToday = async () => {
    await sealTodayJournal();
    await refreshLogs();
  };

  const flatAdventures = useMemo(
    () =>
      logs
        .flatMap((log) => log.adventures.map((a) => ({ date: log.date, snapshot: log.snapshot, checkIns: log.checkIns, log, a })))
        .sort((x, y) => (x.date > y.date ? -1 : 1)),
    [logs]
  );
  const heatRows = useMemo(() => logs.map((log) => ({ date: log.date, value: heatValue(log), log })), [logs]);
  const maxHeat = Math.max(1, ...heatRows.map((x) => x.value));
  const pages = useMemo(() => buildWeeklyBookPages(logs), [logs]);
  const milestones = useMemo(() => buildMilestones(logs), [logs]);
  const compareResult = useMemo(
    () => (compareDay1 && compareDay2 ? compareSnapshotsByDate(logs, compareDay1, compareDay2) : null),
    [logs, compareDay1, compareDay2]
  );
  const currentPage = pages[bookPage] ?? null;

  const addMilestone = async () => {
    if (!msTitle.trim()) return;
    addManualMilestone({ date: msDate, title: msTitle.trim() });
    setMsTitle("");
    await refreshLogs();
  };

  return (
    <AppShell>
      <MvpPageHeader title="人生日志" description={GENTLE_COPY.journalIntro} />
      <section className="card mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void sealToday()}
            className="rounded-lg border border-cyan-600/60 bg-cyan-500/10 px-3 py-1.5 text-sm text-cyan-200 hover:border-cyan-500"
          >
            封存今日记忆
          </button>
          <button
            type="button"
            onClick={() => setView("timeline")}
            className={`rounded-lg px-3 py-1.5 text-sm ${view === "timeline" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300"}`}
          >
            时间轴
          </button>
          <button
            type="button"
            onClick={() => setView("heatmap")}
            className={`rounded-lg px-3 py-1.5 text-sm ${view === "heatmap" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300"}`}
          >
            日历热力
          </button>
          <button
            type="button"
            onClick={() => setView("book")}
            className={`rounded-lg px-3 py-1.5 text-sm ${view === "book" ? "bg-slate-700 text-white" : "bg-slate-900 text-slate-300"}`}
          >
            人生之书
          </button>
          <Link
            href="/night-save"
            className="rounded-lg border border-amber-600/50 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-950/40"
          >
            夜间封存 →
          </Link>
        </div>
      </section>

      {seals.length > 0 && (
        <section className="mt-6 card border-amber-900/30 bg-gradient-to-br from-amber-950/25 to-slate-900/90">
          <h2 className="text-lg font-semibold text-amber-100">夜间封存摘录</h2>
          <p className="mt-1 text-xs text-slate-500">与篝火仪式同步；已登录时合并云端封存记录。</p>
          <ul className="mt-3 space-y-2">
            {seals.slice(0, 14).map((s) => (
              <li
                key={s.date}
                className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2 text-sm text-slate-200"
              >
                <span className="text-xs text-amber-200/80">{s.date}</span>
                <span className="mx-2 text-slate-600">·</span>
                <span className="text-slate-300">&ldquo;{s.quote.length > 48 ? `${s.quote.slice(0, 48)}…` : s.quote}&rdquo;</span>
                <span className="ml-2 text-xs text-slate-500">
                  {s.summary.tasksCompleted} 场 · 连续 {s.streak} 日
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "timeline" && (
        <section className="mt-6 card">
          <h2 className="mb-4 text-lg font-semibold">时间轴视图</h2>
          <div className="space-y-3">
            {flatAdventures.map((entry) => {
              const size = Math.max(16, Math.min(42, 16 + entry.a.rewards.xp / 4));
              const active = activeTaskId === entry.a.taskId;
              return (
                <div key={`${entry.date}-${entry.a.taskId}`} className="relative pl-10">
                  <div className="absolute left-4 top-0 h-full w-px bg-slate-700" />
                  <button
                    type="button"
                    onClick={() => setActiveTaskId((v) => (v === entry.a.taskId ? null : entry.a.taskId))}
                    className={`absolute left-0 top-1 rounded-full border-2 border-white/50 ${difficultyColor(entry.a.difficulty)}`}
                    style={{ width: size, height: size }}
                    title={`${entry.a.taskName} +${entry.a.rewards.xp} XP`}
                  />
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <p className="text-sm font-medium text-slate-100">{entry.a.taskName}</p>
                    <p className="text-xs text-slate-400">{entry.date} · {entry.a.location} · {entry.a.monsterName}</p>
                    {active && (
                      <div className="mt-2 rounded border border-slate-700 bg-slate-950/60 p-2 text-xs text-slate-300">
                        <p>职业：{entry.a.profession} · 难度：{entry.a.difficulty} · 结果：{entry.a.result}</p>
                        <p>耗时：{entry.a.duration} 分钟 · 奖励：{entry.a.rewards.xp} XP / {entry.a.rewards.crystals} 晶石</p>
                        <p>高光：{entry.a.highlights.join("、") || "无"}</p>
                        <p>掉落：{entry.a.rewards.drops.join("、") || "无"}</p>
                        <p className="mt-1 text-emerald-300">
                          打卡：
                          {entry.checkIns.filter((c) => c.taskId === entry.a.taskId).length > 0
                            ? entry.checkIns
                                .filter((c) => c.taskId === entry.a.taskId)
                                .map((c) => (c.type === "text" ? "📝" : c.type === "image" ? "📸" : "🎙️"))
                                .join(" ")
                            : "无"}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {flatAdventures.length === 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">
                <p>{GENTLE_COPY.noTasksYet}</p>
                <p className="mt-2 text-xs text-slate-500">{GENTLE_COPY.retreatDay}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {view === "heatmap" && (
        <section className="mt-6 card">
          <h2 className="mb-4 text-lg font-semibold">日历热力图</h2>
          <div className="grid grid-cols-7 gap-2">
            {heatRows.map((row) => {
              const alpha = 0.12 + (row.value / maxHeat) * 0.88;
              const epic = row.log.summary.equipmentAcquired.some((x) => x.rarity === "epic");
              return (
                <button
                  key={row.date}
                  type="button"
                  onClick={() => setActiveTaskId(row.date)}
                  className="rounded-md border border-slate-700 p-2 text-left"
                  style={{ backgroundColor: `rgba(34,211,238,${alpha})` }}
                  title={`${row.date} 任务:${row.log.summary.totalTasks} XP:${row.log.summary.totalXP}`}
                >
                  <p className="text-[10px] text-slate-200">{row.date.slice(5)}</p>
                  <p className="text-xs text-slate-900/90">{row.log.summary.totalTasks} 任务</p>
                  <p className="text-[10px] text-slate-900/80">{row.log.summary.totalXP} XP</p>
                  <div className="mt-1 text-sm">
                    {row.log.summary.levelUp ? "🎁" : ""}
                    {epic ? "⭐" : ""}
                  </div>
                </button>
              );
            })}
          </div>
          {activeTaskId && (
            <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-sm text-slate-200">
              {(() => {
                const log = logs.find((x) => x.date === activeTaskId);
                if (!log) return "点击格子查看当天摘要";
                return `${log.date}：完成 ${log.summary.totalTasks} 个任务，${log.summary.totalXP} XP，${log.summary.totalCrystals} 晶石。`;
              })()}
            </div>
          )}
          {monthly.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-300">历史月总结（90天前压缩）</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {monthly.map((m) => (
                  <div key={m.month} className="rounded border border-slate-800 px-3 py-2 text-xs text-slate-300">
                    <p className="font-medium text-slate-200">{m.month}</p>
                    <p>任务 {m.totalTasks} · XP {m.totalXP}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {view === "book" && (
        <section className="mt-6 card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">人生之书</h2>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={bookPage <= 0}
                onClick={() => setBookPage((p) => Math.max(0, p - 1))}
                className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={bookPage >= pages.length - 1}
                onClick={() => setBookPage((p) => Math.min(pages.length - 1, p + 1))}
                className="rounded border border-slate-700 px-2 py-1 text-xs disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>
          {currentPage ? (
            <div className="grid gap-4 rounded-xl border border-slate-700 bg-gradient-to-br from-slate-900 to-slate-950 p-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-slate-400">{currentPage.weekLabel}</p>
                <p className="mt-2 text-sm text-slate-200">{currentPage.summary}</p>
                <div className="mt-3 flex h-24 items-end gap-1">
                  {currentPage.levelSeries.map((pt) => (
                    <div key={pt.date} className="flex flex-col items-center gap-1">
                      <div
                        className="w-5 rounded-t bg-cyan-500"
                        style={{ height: `${Math.max(12, pt.level * 3)}px` }}
                        title={`${pt.date} Lv.${pt.level}`}
                      />
                      <span className="text-[10px] text-slate-500">{pt.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {currentPage.images.length > 0 ? (
                  currentPage.images.map((src, i) => (
                    <img key={i} src={src} alt={`memory-${i}`} className="h-28 w-full rounded object-cover" />
                  ))
                ) : (
                  <div className="col-span-3 flex h-28 items-center justify-center rounded border border-dashed border-slate-700 text-xs text-slate-500">
                    本周暂无精选打卡图片
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">暂无周页可翻阅。</p>
          )}
        </section>
      )}

      <section className="mt-6 card">
        <h2 className="mb-3 text-lg font-semibold">里程碑时间轴</h2>
        <div className="grid gap-2 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="rounded border border-slate-800 px-3 py-2 text-sm text-slate-200">
                <span className={`mr-2 inline-block h-2 w-2 rounded-full ${m.kind === "manual" ? "bg-violet-400" : "bg-cyan-400"}`} />
                {m.date} · {m.title}
              </div>
            ))}
            {milestones.length === 0 && <p className="text-sm text-slate-500">暂无里程碑。</p>}
          </div>
          <div className="space-y-2 rounded border border-slate-800 p-3">
            <p className="text-xs text-slate-400">添加手动里程碑</p>
            <input
              type="date"
              value={msDate}
              onChange={(e) => setMsDate(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <input
              value={msTitle}
              onChange={(e) => setMsTitle(e.target.value)}
              placeholder="如：通过答辩 / 减重5kg"
              className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <button type="button" onClick={() => void addMilestone()} className="w-full rounded bg-violet-600 py-1 text-xs text-white">
              添加
            </button>
          </div>
        </div>
      </section>

      <section className="mt-6 card">
        <h2 className="mb-3 text-lg font-semibold">两天快照对比</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={compareDay1}
            onChange={(e) => setCompareDay1(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
          >
            <option value="">选择基准日</option>
            {logs.map((l) => (
              <option key={`a-${l.date}`} value={l.date}>
                {l.date}
              </option>
            ))}
          </select>
          <select
            value={compareDay2}
            onChange={(e) => setCompareDay2(e.target.value)}
            className="rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
          >
            <option value="">选择对比日</option>
            {logs.map((l) => (
              <option key={`b-${l.date}`} value={l.date}>
                {l.date}
              </option>
            ))}
          </select>
          <p className="self-center text-xs text-slate-400">效率系数&lt;1 表示更快完成任务</p>
        </div>
        {compareResult && (
          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
            <p>等级变化：{compareResult.levelDiff >= 0 ? "+" : ""}{compareResult.levelDiff}</p>
            <p>XP 增长差：{compareResult.xpGrowth >= 0 ? "+" : ""}{compareResult.xpGrowth}</p>
            <p>
              属性成长：STR {compareResult.statGrowth.str >= 0 ? "+" : ""}{compareResult.statGrowth.str} / INT{" "}
              {compareResult.statGrowth.int >= 0 ? "+" : ""}{compareResult.statGrowth.int} / AGI{" "}
              {compareResult.statGrowth.agi >= 0 ? "+" : ""}{compareResult.statGrowth.agi} / CHA{" "}
              {compareResult.statGrowth.cha >= 0 ? "+" : ""}{compareResult.statGrowth.cha} / CON{" "}
              {compareResult.statGrowth.con >= 0 ? "+" : ""}{compareResult.statGrowth.con}
            </p>
            <p>任务效率：x{compareResult.taskEfficiency.toFixed(2)}</p>
            <p className="mt-1 text-emerald-300">新习惯：{compareResult.newHabitsFormed.join("、")}</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
