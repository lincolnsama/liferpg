"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { loadCosmetics } from "@/lib/cosmetics";
import { shopGearList, type GearDef } from "@/lib/equipment-catalog";
import { addGearToStash, buyGearWithCrystals } from "@/lib/gear-inventory";
import { createClient } from "@/lib/supabase-browser";
import { loadUserProfile, saveUserProfile, type UserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

type ProfileLite = {
  id: string;
  crystals: number;
};

const rarityClass: Record<string, string> = {
  common: "text-slate-300 border-slate-700",
  rare: "text-cyan-300 border-cyan-700/50",
  epic: "text-fuchsia-300 border-fuchsia-700/50",
  legendary: "text-amber-300 border-amber-600/50"
};

function stashQty(profile: UserProfile | null, catalogId: string): number {
  const s = profile?.virtualCharacter?.stash ?? [];
  return s.find((x) => x.catalogId === catalogId)?.quantity ?? 0;
}

export default function ShopPage() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<"all" | "weapon" | "armor" | "accessory" | "consumable">("all");

  const refreshProfile = useCallback(() => {
    setUserProfile(loadUserProfile());
  }, []);

  const loadData = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, crystals")
      .eq("id", user.id)
      .single();
    setProfile(profileData as ProfileLite);
    refreshProfile();
  }, [supabase, refreshProfile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const list = useMemo(() => {
    const rows = shopGearList();
    if (tab === "all") return rows;
    return rows.filter((g) => g.item.type === tab);
  }, [tab]);

  const buy = async (def: GearDef) => {
    if (!profile || !def.shopCrystals) return;
    setNotice(null);
    setBusyId(def.id);
    const res = await buyGearWithCrystals(supabase, profile.id, profile.crystals, def);
    if (!res.ok) {
      setNotice(res.error ?? "购买失败");
      setBusyId(null);
      return;
    }
    const p = loadUserProfile();
    if (!p) {
      setBusyId(null);
      return;
    }
    const next = addGearToStash(p, def.id, 1);
    saveUserProfile(next);
    setUserProfile(next);
    setProfile({ ...profile, crystals: res.newCrystals ?? profile.crystals });
    setNotice(`已购买「${def.item.name}」并放入背包。请到「装备」页穿戴。`);
    setBusyId(null);
  };

  const streak = loadCosmetics().checkInStreak;

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">装备商店</h1>
          <p className="mt-1 text-sm text-slate-400">
            晶石购买 RPG 装备；困难任务概率掉落稀有装备；连续打卡 7 天可领取史诗「破晓冠冕」（见冒险/装备页）。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory"
            className="rounded-lg border border-cyan-700/50 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
          >
            打开装备 / 背包 →
          </Link>
          <Link href="/collection" className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
            外观收藏 →
          </Link>
        </div>
      </div>

      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="card">
          <p className="text-sm text-slate-400">当前晶石</p>
          <p className="mt-2 text-3xl font-semibold text-cyan-400">{profile?.crystals ?? 0}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-400">连续打卡</p>
          <p className="mt-2 text-3xl font-semibold text-amber-300">{streak} 天</p>
          <p className="mt-1 text-xs text-slate-500">满 7 天登录时自动发放史诗装备（若未领过）</p>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "全部"],
            ["weapon", "武器"],
            ["armor", "护甲"],
            ["accessory", "饰品"],
            ["consumable", "消耗品"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs md:text-sm",
              tab === id
                ? "border-cyan-500 bg-cyan-500/15 text-cyan-200"
                : "border-slate-700 text-slate-400 hover:border-slate-500"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="card mb-6">
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((def) => {
            const price = def.shopCrystals ?? 0;
            const can = (profile?.crystals ?? 0) >= price;
            const owned = stashQty(userProfile, def.id);
            return (
              <div key={def.id} className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-medium text-slate-100">{def.item.name}</h3>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-xs capitalize",
                      rarityClass[def.item.rarity] ?? rarityClass.common
                    )}
                  >
                    {def.item.rarity}
                  </span>
                </div>
                <p className="mb-2 text-xs text-slate-500">{def.item.type}</p>
                <p className="mb-3 text-sm text-slate-400">{def.item.description}</p>
                <p className="mb-3 text-xs text-slate-500">
                  属性：STR {def.item.effects.str ?? 0} · INT {def.item.effects.int ?? 0} · AGI{" "}
                  {def.item.effects.agi ?? 0} · CHA {def.item.effects.cha ?? 0} · CON {def.item.effects.con ?? 0}
                  {def.item.effects.xpBonus != null ? ` · 药剂 XP+${Math.round(def.item.effects.xpBonus * 100)}%` : ""}
                  {def.item.effects.readingMinuteReduction
                    ? ` · 阅读预计-${def.item.effects.readingMinuteReduction} 分`
                    : ""}
                  {def.item.effects.morningAttackMultiplier
                    ? ` · 早起线攻击+${Math.round(def.item.effects.morningAttackMultiplier * 100)}%`
                    : ""}
                  {def.item.effects.firstDailyMinuteFactor != null
                    ? ` · 每日首任务预计×${def.item.effects.firstDailyMinuteFactor}`
                    : ""}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-cyan-400">{price} 晶石</span>
                  <span className="text-xs text-slate-500">背包 {owned}</span>
                  <button
                    type="button"
                    disabled={!can || busyId === def.id}
                    onClick={() => void buy(def)}
                    className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white hover:bg-cyan-500 disabled:bg-slate-700"
                  >
                    {busyId === def.id ? "处理中…" : can ? "购买" : "晶石不足"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {list.length === 0 && <p className="text-sm text-slate-400">该分类暂无出售装备。</p>}
      </section>

      <section className="card text-sm text-slate-400">
        <p className="font-medium text-slate-200">掉落与成就</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
          <li>困难任务：约 34% 概率掉落「星辉短刃」。</li>
          <li>连续 7 天打开应用：自动获得「破晓冠冕」（仅一次）。</li>
          <li>高 INT 会让学习类任务更难被判为「简单」，但完成时 XP 更高。</li>
        </ul>
        {notice && <p className="mt-4 text-emerald-400">{notice}</p>}
      </section>
    </AppShell>
  );
}
