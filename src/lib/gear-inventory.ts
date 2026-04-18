import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCrystalSpend } from "@/lib/crystal-spend-log";
import { DROP_TABLE_HARD, getGearDef, itemFromGearDef, type GearDef } from "@/lib/equipment-catalog";
import type { Item, ItemType, VirtualCharacter } from "@/types/game";
import type { UserProfile } from "@/lib/user-profile";

export type EquipSlot = "weapon" | "armor" | "accessory";

function ensureStash(vc: VirtualCharacter): VirtualCharacter {
  return { ...vc, stash: vc.stash ?? [] };
}

function stashIndex(stash: NonNullable<VirtualCharacter["stash"]>, id: string) {
  return stash.findIndex((s) => s.catalogId === id);
}

export function getEffectiveInt(vc: VirtualCharacter): number {
  let n = vc.int;
  const parts = [vc.equipment.weapon, vc.equipment.armor, vc.equipment.accessory];
  for (const it of parts) {
    n += it?.effects.int ?? 0;
  }
  return n;
}

export function hasMorningAttackBonus(vc: VirtualCharacter, taskTitle: string): number {
  const w = vc.equipment.weapon;
  const m = w?.effects.morningAttackMultiplier ?? 0;
  if (m <= 0) return 0;
  const t = taskTitle;
  if (/早起|晨跑|晨型|起床|早睡|黎明|清晨|早餐前/.test(t)) return m;
  return 0;
}

export function addGearToStash(profile: UserProfile, catalogId: string, qty = 1): UserProfile {
  const def = getGearDef(catalogId);
  if (!def || qty < 1) return profile;
  let vc = profile.virtualCharacter;
  if (!vc) return profile;
  vc = ensureStash(vc);
  const stash = [...(vc.stash ?? [])];
  const i = stashIndex(stash, catalogId);
  if (i >= 0) stash[i] = { ...stash[i], quantity: stash[i].quantity + qty };
  else stash.push({ catalogId, quantity: qty });
  return {
    ...profile,
    virtualCharacter: { ...vc, stash }
  };
}

export function maybeGrantStreakSevenEpicGear(profile: UserProfile, checkInStreak: number): UserProfile {
  if (checkInStreak < 7) return profile;
  if (profile.gearFlags?.streakSevenEpicGranted) return profile;
  const def = getGearDef("gear-daybreak-crown");
  if (!def?.streakSevenReward) return profile;
  const next = addGearToStash(profile, "gear-daybreak-crown", 1);
  return {
    ...next,
    gearFlags: { ...next.gearFlags, streakSevenEpicGranted: true }
  };
}

export function rollHardTaskGearDrop(): string | null {
  if (Math.random() > 0.34) return null;
  const total = DROP_TABLE_HARD.reduce((s, r) => s + r.weight, 0);
  let x = Math.random() * total;
  for (const row of DROP_TABLE_HARD) {
    x -= row.weight;
    if (x <= 0) return row.id;
  }
  return DROP_TABLE_HARD[0]?.id ?? null;
}

export async function buyGearWithCrystals(
  supabase: SupabaseClient,
  profileId: string,
  crystals: number,
  def: GearDef
): Promise<{ ok: boolean; error?: string; newCrystals?: number }> {
  const price = def.shopCrystals;
  if (price == null || price <= 0) return { ok: false, error: "不可购买" };
  if (crystals < price) return { ok: false, error: "晶石不足" };
  const next = crystals - price;
  const { error } = await supabase.from("profiles").update({ crystals: next }).eq("id", profileId);
  if (error) return { ok: false, error: error.message };
  appendCrystalSpend(price, `装备商店：${def.item.name}`);
  return { ok: true, newCrystals: next };
}

export function equipFromStash(profile: UserProfile, catalogId: string): UserProfile {
  const def = getGearDef(catalogId);
  if (!def || def.item.type === "consumable") return profile;
  let vc = profile.virtualCharacter;
  if (!vc) return profile;
  vc = ensureStash(vc);
  const si = stashIndex(vc.stash ?? [], catalogId);
  if (si < 0 || (vc.stash![si].quantity ?? 0) < 1) return profile;
  const slot = def.item.type as EquipSlot;
  if (slot !== "weapon" && slot !== "armor" && slot !== "accessory") return profile;

  const stash = [...(vc.stash ?? [])];
  const cur = stash[si].quantity;
  if (cur <= 1) stash.splice(si, 1);
  else stash[si] = { ...stash[si], quantity: cur - 1 };

  const newPiece = itemFromGearDef(def);
  const prev = vc.equipment[slot];
  if (prev && prev.catalogId) {
    const pi = stashIndex(stash, prev.catalogId);
    if (pi >= 0) stash[pi] = { ...stash[pi], quantity: stash[pi].quantity + 1 };
    else stash.push({ catalogId: prev.catalogId, quantity: 1 });
  }

  return {
    ...profile,
    virtualCharacter: {
      ...vc,
      stash,
      equipment: {
        ...vc.equipment,
        [slot]: newPiece
      }
    }
  };
}

export function unequipToStash(profile: UserProfile, slot: EquipSlot): UserProfile {
  let vc = profile.virtualCharacter;
  if (!vc) return profile;
  const cur = vc.equipment[slot];
  if (!cur?.catalogId) return profile;
  vc = ensureStash(vc);
  const stash = [...(vc.stash ?? [])];
  const pi = stashIndex(stash, cur.catalogId);
  if (pi >= 0) stash[pi] = { ...stash[pi], quantity: stash[pi].quantity + 1 };
  else stash.push({ catalogId: cur.catalogId, quantity: 1 });
  return {
    ...profile,
    virtualCharacter: {
      ...vc,
      stash,
      equipment: {
        ...vc.equipment,
        [slot]: undefined
      }
    }
  };
}

export function consumeFocusPotionFromStash(profile: UserProfile): UserProfile {
  let vc = profile.virtualCharacter;
  if (!vc) return profile;
  vc = ensureStash(vc);
  const id = "gear-focus-potion";
  const si = stashIndex(vc.stash ?? [], id);
  if (si < 0 || (vc.stash![si].quantity ?? 0) < 1) return profile;
  const stash = [...(vc.stash ?? [])];
  const q = stash[si].quantity - 1;
  if (q <= 0) stash.splice(si, 1);
  else stash[si] = { ...stash[si], quantity: q };
  const bonus = getGearDef(id)?.item.effects.xpBonus ?? 0.5;
  return {
    ...profile,
    pendingXpMultiplier: 1 + bonus,
    virtualCharacter: { ...vc, stash }
  };
}

export function clearPendingXpMultiplier(profile: UserProfile): UserProfile {
  const { pendingXpMultiplier: _, ...rest } = profile;
  return rest;
}

export function markFirstTaskOfDay(profile: UserProfile, ymd: string): UserProfile {
  return {
    ...profile,
    gearDaily: { ...profile.gearDaily, firstTaskCreatedYmd: ymd }
  };
}

export function isFirstTaskOfDay(profile: UserProfile, ymd: string): boolean {
  return profile.gearDaily?.firstTaskCreatedYmd !== ymd;
}

export function accessoryHasCoffeeCharm(vc: VirtualCharacter): boolean {
  return vc.equipment.accessory?.catalogId === "gear-coffee-charm";
}

export function armorReadingReduction(vc: VirtualCharacter): number {
  return vc.equipment.armor?.effects.readingMinuteReduction ?? 0;
}
