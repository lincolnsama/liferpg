"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { getGearDef, itemFromGearDef, type GearDef } from "@/lib/equipment-catalog";
import {
  consumeFocusPotionFromStash,
  equipFromStash,
  unequipToStash,
  type EquipSlot
} from "@/lib/gear-inventory";
import { loadUserProfile, saveUserProfile, type UserProfile } from "@/lib/user-profile";
import type { Item } from "@/types/game";
import { cn } from "@/lib/utils";

const SLOTS: { key: EquipSlot; label: string; y: string }[] = [
  { key: "weapon", label: "武器", y: "22%" },
  { key: "armor", label: "护甲", y: "48%" },
  { key: "accessory", label: "饰品", y: "34%" }
];

function effectSummary(it: Item): string {
  const e = it.effects;
  const parts: string[] = [];
  if (e.str) parts.push(`STR +${e.str}`);
  if (e.int) parts.push(`INT +${e.int}`);
  if (e.agi) parts.push(`AGI +${e.agi}`);
  if (e.cha) parts.push(`CHA +${e.cha}`);
  if (e.con) parts.push(`CON +${e.con}`);
  if (e.xpBonus != null) parts.push(`下次任务 XP +${Math.round(e.xpBonus * 100)}%`);
  if (e.readingMinuteReduction) parts.push(`「阅读」任务预计 −${e.readingMinuteReduction} 分钟`);
  if (e.morningAttackMultiplier) parts.push(`早起线冒险攻击 +${Math.round(e.morningAttackMultiplier * 100)}%`);
  if (e.firstDailyMinuteFactor != null) parts.push(`每日首个任务预计 ×${e.firstDailyMinuteFactor}`);
  return parts.join(" · ") || "—";
}

export default function InventoryPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [selectedSource, setSelectedSource] = useState<"stash" | "slot" | null>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setProfile(loadUserProfile());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const vc = profile?.virtualCharacter;

  const stashRows = useMemo(() => {
    const stash = profile?.virtualCharacter?.stash ?? [];
    return stash
      .map((s) => {
        const def = getGearDef(s.catalogId);
        if (!def) return null;
        return { def, qty: s.quantity };
      })
      .filter(Boolean) as { def: GearDef; qty: number }[];
  }, [profile?.virtualCharacter?.stash]);

  const openFromSlot = (slot: EquipSlot) => {
    const it = vc?.equipment[slot];
    if (!it) return;
    setSelected(it);
    setSelectedSource("slot");
    setSelectedCatalogId(it.catalogId ?? null);
  };

  const openFromStash = (catalogId: string) => {
    const def = getGearDef(catalogId);
    if (!def) return;
    setSelected(itemFromGearDef(def));
    setSelectedSource("stash");
    setSelectedCatalogId(catalogId);
  };

  const persist = (next: UserProfile) => {
    saveUserProfile(next);
    setProfile(next);
  };

  const onEquip = () => {
    if (!profile || !selectedCatalogId) return;
    const def = getGearDef(selectedCatalogId);
    if (!def || def.item.type === "consumable") return;
    persist(equipFromStash(profile, selectedCatalogId));
    refresh();
    setSelected(null);
    setSelectedSource(null);
    setSelectedCatalogId(null);
  };

  const onUnequip = (slot: EquipSlot) => {
    if (!profile) return;
    persist(unequipToStash(profile, slot));
    refresh();
    setSelected(null);
    setSelectedSource(null);
    setSelectedCatalogId(null);
  };

  const onUsePotion = () => {
    if (!profile) return;
    persist(consumeFocusPotionFromStash(profile));
    refresh();
    setSelected(null);
    setSelectedSource(null);
    setSelectedCatalogId(null);
  };

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">装备与背包</h1>
          <p className="mt-1 text-sm text-slate-400">点击剪影上的槽位或下方背包条目查看详情、装备 / 卸下。</p>
        </div>
        <Link href="/shop" className="rounded-lg border border-cyan-700/50 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/10">
          去商店 →
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card relative min-h-[320px] overflow-hidden">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">角色装备</h2>
          <div className="relative mx-auto h-72 w-48 rounded-2xl border border-slate-700 bg-slate-900/80">
            <div className="absolute inset-x-6 top-8 h-10 rounded-full border border-slate-600 bg-slate-800/80" title="头部" />
            <div className="absolute inset-x-10 top-20 h-24 rounded-3xl border border-slate-600 bg-slate-800/60" title="躯干" />
            <div className="absolute bottom-10 left-8 h-20 w-5 rounded-full border border-slate-600 bg-slate-800/60" />
            <div className="absolute bottom-10 right-8 h-20 w-5 rounded-full border border-slate-600 bg-slate-800/60" />

            {SLOTS.map((s) => {
              const worn = vc?.equipment[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => (worn ? openFromSlot(s.key) : undefined)}
                  className={cn(
                    "absolute left-1/2 w-28 -translate-x-1/2 rounded-lg border px-2 py-1 text-center text-[10px] transition",
                    worn
                      ? "border-cyan-500/70 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25"
                      : "border-dashed border-slate-600 text-slate-500"
                  )}
                  style={{ top: s.y }}
                  disabled={!worn}
                >
                  {s.label}
                  {worn ? `：${worn.name}` : "（空）"}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">人形剪影 · 槽位可点击（已装备时）</p>
        </section>

        <section className="card">
          <h2 className="mb-4 text-lg font-semibold text-slate-100">背包</h2>
          {stashRows.length === 0 ? (
            <p className="text-sm text-slate-400">背包为空。去商店购买或完成困难任务获取装备。</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {stashRows.map(({ def, qty }) => (
                <li key={def.id}>
                  <button
                    type="button"
                    onClick={() => openFromStash(def.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-sm hover:border-slate-600"
                  >
                    <span className="text-slate-200">{def.item.name}</span>
                    <span className="text-xs text-cyan-400">×{qty}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {selected && (
        <section className="card mt-6 border-cyan-900/40">
          <h3 className="text-lg font-semibold text-cyan-100">{selected.name}</h3>
          <p className="mt-1 text-xs capitalize text-slate-500">
            {selected.type} · {selected.rarity}
          </p>
          <p className="mt-3 text-sm text-slate-300">{selected.description}</p>
          <p className="mt-3 text-sm text-slate-400">{effectSummary(selected)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedSource === "stash" && selected.type !== "consumable" && (
              <button
                type="button"
                onClick={onEquip}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500"
              >
                装备到对应槽位
              </button>
            )}
            {selectedSource === "stash" && selected.type === "consumable" && (
              <button
                type="button"
                onClick={onUsePotion}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500"
              >
                使用（下次任务 XP 加成）
              </button>
            )}
            {selectedSource === "slot" && selectedCatalogId && (
              <button
                type="button"
                onClick={() => {
                  const slot = selected.type as EquipSlot;
                  if (slot === "weapon" || slot === "armor" || slot === "accessory") onUnequip(slot);
                }}
                className="rounded-lg border border-rose-700/60 bg-rose-950/40 px-4 py-2 text-sm text-rose-200 hover:bg-rose-900/50"
              >
                卸下放回背包
              </button>
            )}
          </div>
        </section>
      )}
    </AppShell>
  );
}
