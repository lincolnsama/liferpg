"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import {
  CATALOG,
  COSMETICS_UPDATED_EVENT,
  collectionStats,
  loadCosmetics,
  type CosmeticsState,
  type ShopCategory
} from "@/lib/cosmetics";

const categoryLabel: Record<ShopCategory, string> = {
  theme: "主题皮肤",
  focus_bg: "专注背景",
  frame: "头像框"
};

export default function CollectionPage() {
  const [cosmetics, setCosmetics] = useState<CosmeticsState>(() => loadCosmetics());

  const refresh = useCallback(() => setCosmetics(loadCosmetics()), []);

  useEffect(() => {
    refresh();
    window.addEventListener(COSMETICS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, refresh);
  }, [refresh]);

  const { total, owned, pct } = collectionStats(cosmetics);
  const ownedItems = CATALOG.filter((c) => cosmetics.ownedIds.includes(c.id));

  return (
    <AppShell>
      <section className="card mb-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">我的收藏</h1>
            <p className="mt-1 text-sm text-slate-400">皮肤、专注背景与头像框收集进度</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-cyan-300">{pct}%</p>
            <p className="text-xs text-slate-500">
              {owned} / {total} 件已收集
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <Link href="/shop" className="mt-4 inline-block text-sm text-cyan-400 hover:text-cyan-300">
          ← 返回商店
        </Link>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">已拥有外观</h2>
        {ownedItems.length === 0 ? (
          <p className="text-sm text-slate-400">暂无收藏，去商店看看吧。</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {ownedItems.map((item) => {
              const equipped =
                (item.category === "theme" && cosmetics.equippedThemeId === item.id) ||
                (item.category === "focus_bg" && cosmetics.equippedFocusBgId === item.id) ||
                (item.category === "frame" && cosmetics.equippedFrameId === item.id);
              return (
                <li
                  key={item.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3 text-sm"
                >
                  <p className="text-xs text-slate-500">{categoryLabel[item.category]}</p>
                  <p className="font-medium text-slate-100">{item.name}</p>
                  {equipped && (
                    <span className="mt-2 inline-block rounded-full border border-emerald-600/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                      当前装备
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
