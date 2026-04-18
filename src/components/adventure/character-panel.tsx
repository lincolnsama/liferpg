"use client";

import { Sword, Shield, Sparkles } from "lucide-react";
import type { UserProfile } from "@/lib/user-profile";
import type { EquipSlot } from "@/lib/gear-inventory";
import { getAdventureBuffDescriptions, formatItemEffectsBrief } from "@/lib/adventure-run-ui";
import { cn } from "@/lib/utils";

const SLOTS: { key: EquipSlot; label: string; Icon: typeof Sword }[] = [
  { key: "weapon", label: "武器", Icon: Sword },
  { key: "armor", label: "护甲", Icon: Shield },
  { key: "accessory", label: "饰品", Icon: Sparkles }
];

function Bar({
  label,
  cur,
  max,
  className
}: {
  label: string;
  cur: number;
  max: number;
  className: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
        <span>{label}</span>
        <span>
          {cur} / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div className={cn("h-full rounded-full transition-[width] duration-500 ease-out", className)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function CharacterAdventurePanel({ profile }: { profile: UserProfile | null }) {
  const vc = profile?.virtualCharacter;
  const buffs = getAdventureBuffDescriptions(profile ?? null);

  if (!vc) {
    return (
      <aside className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-500">
        尚未创建角色档案。请先在引导中完成角色。
      </aside>
    );
  }

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/90 p-4 shadow-lg shadow-black/40">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">冒险者状态</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">HP / MP 与装备随本地档案实时更新</p>
      </div>

      <div className="space-y-3">
        <Bar label="HP" cur={vc.hp} max={vc.maxHp} className="bg-gradient-to-r from-rose-600 to-amber-500" />
        <Bar label="MP" cur={vc.mp} max={vc.maxMp} className="bg-gradient-to-r from-sky-600 to-cyan-400" />
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">装备</p>
        <div className="flex gap-2">
          {SLOTS.map(({ key, label, Icon }) => {
            const it = vc.equipment[key];
            return (
              <div key={key} className="group relative flex-1">
                <div
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center rounded-lg border bg-slate-900/80 transition",
                    it ? "border-amber-700/50 text-amber-200" : "border-slate-800 text-slate-600"
                  )}
                >
                  <Icon className="h-5 w-5 opacity-90" />
                  <span className="mt-1 text-[10px] text-slate-500">{label}</span>
                </div>
                {it && (
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-44 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-[10px] text-slate-300 opacity-0 shadow-xl transition group-hover:pointer-events-auto group-hover:opacity-100">
                    <p className="font-medium text-amber-100">{it.name}</p>
                    <p className="mt-1 text-slate-400">{formatItemEffectsBrief(it)}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">当前增益</p>
        {buffs.length === 0 ? (
          <p className="text-xs text-slate-600">暂无时段 / 装备增益</p>
        ) : (
          <ul className="space-y-1.5">
            {buffs.map((b) => (
              <li key={b} className="rounded-md border border-cyan-900/40 bg-cyan-950/30 px-2 py-1.5 text-xs text-cyan-100">
                {b}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
