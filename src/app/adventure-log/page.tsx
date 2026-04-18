"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import type { AdventureEvent } from "@/types/game";
import { applyAdventureFleePenalty } from "@/lib/adventure-system";
import { loadUserProfile, saveUserProfile, type UserProfile } from "@/lib/user-profile";

function formatAt(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function kindLabel(kind: AdventureEvent["kind"]): string {
  switch (kind) {
    case "adventure_chronicle":
      return "文字战报";
    case "task_complete":
      return "任务";
    case "dungeon_enter":
      return "地下城";
    case "shop_buy":
      return "商店";
    case "level_up":
      return "升级";
    default:
      return "备注";
  }
}

export default function AdventureLogPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refresh = useCallback(() => {
    setProfile(loadUserProfile());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const chronicles = useMemo(() => {
    const log = profile?.virtualCharacter?.adventureLog ?? [];
    return log.filter((e) => e.kind === "adventure_chronicle");
  }, [profile?.virtualCharacter?.adventureLog]);

  const simulateFlee = () => {
    if (!profile?.virtualCharacter) return;
    const next = {
      ...profile,
      virtualCharacter: applyAdventureFleePenalty(profile.virtualCharacter)
    };
    saveUserProfile(next);
    setProfile(next);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">冒险战报</h1>
          <p className="mt-1 text-sm text-slate-400">
            每次完成任务会生成一段模板化文字战报，保存在角色「冒险日志」中。地图遭遇的胜利也会追加摘要。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/adventure"
            className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-900/50"
          >
            前往冒险地图 →
          </Link>
          <Link href="/tasks" className="rounded-lg border border-cyan-700/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20">
            去任务 →
          </Link>
          <button
            type="button"
            onClick={simulateFlee}
            className="rounded-lg border border-rose-800/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-200 hover:bg-rose-900/50"
            title="演示「逃跑」惩罚：扣 20% 最大 HP（下限 1）"
          >
            演示逃跑惩罚
          </button>
        </div>
      </div>

      <section className="card mb-6 border-slate-700">
        <h2 className="text-sm font-semibold text-slate-300">规则摘要</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-400">
          <li>职业任务映射到不同虚拟场景（竞技场、图书馆、森林等）。</li>
          <li>难度决定魔物池与 HP；每 5 分钟实际耗时 ≈ 1 个战斗回合。</li>
          <li>攻击 = 职业主属性 + 武器效果；防御 = 体质 + 护甲效果折算。</li>
          <li>回合内伤害 = 攻击 − 防御 + 随机（−2～+3），最少 1 点。</li>
        </ul>
      </section>

      {chronicles.length === 0 ? (
        <div className="card text-sm text-slate-400">暂无战报。完成任意任务或在冒险地图中取胜后即可在此查看。</div>
      ) : (
        <ul className="space-y-4">
          {chronicles.map((entry) => (
            <li key={entry.id} className="card border-slate-800">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="rounded-full border border-slate-700 px-2 py-0.5 text-slate-400">
                  {kindLabel(entry.kind)}
                </span>
                <time dateTime={new Date(entry.at).toISOString()}>{formatAt(entry.at)}</time>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">
                {entry.message}
              </pre>
              {entry.meta && Object.keys(entry.meta).length > 0 && (
                <p className="mt-3 text-[11px] text-slate-500">
                  {String(entry.meta.scene ?? "")} · {String(entry.meta.monster ?? "")} ·{" "}
                  {String(entry.meta.difficulty ?? "")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
