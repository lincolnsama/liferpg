"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AppShell from "@/components/app-shell";
import CharacterAdventurePanel from "@/components/adventure/character-panel";
import BattleOverlay from "@/components/adventure/battle-overlay";
import VictoryOverlay from "@/components/adventure/victory-overlay";
import {
  generateStandaloneBattleLog,
  lootLabel,
  padBattleLines,
  pickAdventureMonster,
  pickAdventureScene,
  applyAdventureFleePenalty
} from "@/lib/adventure-system";
import {
  adventureAttackMultiplier,
  professionFromProfile
} from "@/lib/adventure-run-ui";
import { loadUserProfile, saveUserProfile, type UserProfile } from "@/lib/user-profile";
import { appendAdventureLog } from "@/types/game";
import type { Difficulty, Profession } from "@/types/db";
import { cn } from "@/lib/utils";

type MapStep = 1 | 2 | 3 | 4;

const NODE_META: { label: string; difficulty: Difficulty | null; isBoss: boolean }[] = [
  { label: "起点", difficulty: null, isBoss: false },
  { label: "遭遇 1", difficulty: "Normal", isBoss: false },
  { label: "遭遇 2", difficulty: "Normal", isBoss: false },
  { label: "首领", difficulty: "Hard", isBoss: true }
];

const STAT_FLOAT: Record<Profession, string> = {
  Warrior: "STR +0.1",
  Mage: "INT +0.1",
  Explorer: "AGI +0.1",
  Artisan: "CHA +0.1",
  Guardian: "CON +0.1"
};

function nodeStatus(i: number, step: MapStep): "unexplored" | "active" | "cleared" {
  if (i === 0) return "cleared";
  if (i < step) return "cleared";
  if (i === step) return "active";
  return "unexplored";
}

export default function AdventureMapPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [step, setStep] = useState<MapStep>(1);
  const [scene, setScene] = useState<string>("");
  const [runSeed, setRunSeed] = useState("");
  const [battleOpen, setBattleOpen] = useState(false);
  const [victoryOpen, setVictoryOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [durationSec, setDurationSec] = useState(45);
  const [monsterName, setMonsterName] = useState("");
  const [lastDifficulty, setLastDifficulty] = useState<Difficulty>("Normal");
  const [lastLoot, setLastLoot] = useState("");
  /** 本场战斗模拟结束时的 HP（胜利结算时在此基础上再回复 8% 上限） */
  const battleFinalHpRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setProfile(loadUserProfile());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const vc = profile?.virtualCharacter;
  const profession = profile ? professionFromProfile(profile) : "Warrior";
  const attackMult = adventureAttackMultiplier(profile ?? null);

  const startExpedition = () => {
    if (!profile?.virtualCharacter) return;
    const seed = String(Date.now());
    const prof = professionFromProfile(profile);
    const sc = pickAdventureScene(prof, seed);
    setRunSeed(seed);
    setScene(sc);
    setStep(1);
  };

  const openBattleForStep = useCallback(
    (s: MapStep) => {
      if (!profile?.virtualCharacter || s < 1 || s > 3) return;
      const meta = NODE_META[s];
      const diff = meta.difficulty ?? "Normal";
      const dur = meta.isBoss ? 60 : 45;
      const monster = pickAdventureMonster(diff, runSeed + "n" + s);
      const maxTurns = meta.isBoss ? 28 : 20;
      const { lines, finalPlayerHp } = generateStandaloneBattleLog({
        vc: profile.virtualCharacter,
        profession,
        difficulty: diff,
        scene,
        monster,
        seed: runSeed + "fight" + s,
        maxTurns,
        attackMultiplier: attackMult
      });
      battleFinalHpRef.current = finalPlayerHp;
      const padded = padBattleLines(lines, dur);
      setLogLines(padded);
      setDurationSec(dur);
      setMonsterName(monster.name);
      setLastDifficulty(diff);
      setBattleOpen(true);
    },
    [profile, profession, scene, runSeed, attackMult]
  );

  const persist = useCallback((next: UserProfile) => {
    saveUserProfile(next);
    setProfile(next);
  }, []);

  const handleFlee = () => {
    if (!profile?.virtualCharacter) return;
    setBattleOpen(false);
    persist({
      ...profile,
      virtualCharacter: applyAdventureFleePenalty(profile.virtualCharacter)
    });
  };

  const handleTimeVictory = useCallback(() => {
    setBattleOpen(false);
    setLastLoot(lootLabel(lastDifficulty));
    setVictoryOpen(true);
  }, [lastDifficulty]);

  const applyVictoryPersistence = useCallback(() => {
    const p = loadUserProfile();
    if (!p?.virtualCharacter) return;
    const vc0 = p.virtualCharacter;
    const postFight = battleFinalHpRef.current ?? vc0.hp;
    const healed = Math.min(vc0.maxHp, Math.max(1, postFight + Math.floor(vc0.maxHp * 0.08)));
    const summary = `【地图遭遇】在「${scene}」击败 ${monsterName}（${lastDifficulty}）。战利品：${lootLabel(lastDifficulty)}`;
    const nextVc = appendAdventureLog(
      { ...vc0, hp: healed },
      {
        kind: "adventure_chronicle",
        message: summary,
        meta: { scene, monster: monsterName, difficulty: lastDifficulty }
      }
    );
    persist({ ...p, virtualCharacter: nextVc });
  }, [scene, monsterName, lastDifficulty, persist]);

  const onVictoryContinue = () => {
    applyVictoryPersistence();
    setVictoryOpen(false);
    setStep((prev) => {
      const n = (prev + 1) as MapStep;
      return n > 4 ? 4 : n;
    });
  };

  const expeditionActive = runSeed !== "" && step < 4;

  const statusLabel = (st: ReturnType<typeof nodeStatus>) => {
    if (st === "cleared") return "已完成";
    if (st === "active") return "进行中";
    return "未探索";
  };

  let mapBody: ReactNode;
  if (!vc) {
    mapBody = <p className="text-sm text-slate-500">加载角色数据中…</p>;
  } else if (!expeditionActive && step === 4) {
    mapBody = (
      <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-6 text-center">
        <p className="text-slate-200">本次远征已全部完成。</p>
        <button
          type="button"
          onClick={() => {
            setRunSeed("");
            setScene("");
            setStep(1);
          }}
          className="mt-4 rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500"
        >
          开始新的远征
        </button>
      </div>
    );
  } else if (!expeditionActive) {
    mapBody = (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="max-w-md text-sm text-slate-400">
          沿固定路线推进：起点 → 两场遭遇 → 首领。每场战斗以专注倒计时进行；坚持到时间结束即视为击破魔物。
        </p>
        <button
          type="button"
          onClick={startExpedition}
          className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-3 text-sm font-semibold text-white shadow-lg hover:from-amber-500 hover:to-orange-500"
        >
          开始远征
        </button>
      </div>
    );
  } else {
    mapBody = (
      <div className="flex flex-col items-center gap-3 py-6 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-2 sm:gap-y-4">
        {NODE_META.map((node, i) => {
          const st = nodeStatus(i, step);
          const isCurrent = st === "active";
          const canEnter = isCurrent && i > 0 && i === step && step <= 3;
          return (
            <div key={node.label} className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-2">
              {i > 0 && (
                <>
                  <span className="text-lg leading-none text-slate-600 sm:hidden" aria-hidden>
                    ↓
                  </span>
                  <span className="hidden text-lg text-slate-600 sm:inline" aria-hidden>
                    →
                  </span>
                </>
              )}
              <motion.button
                type="button"
                disabled={!canEnter}
                onClick={() => canEnter && openBattleForStep(step)}
                className={cn(
                  "relative flex min-h-[88px] min-w-[100px] flex-col items-center justify-center rounded-2xl border-2 px-3 py-3 text-center transition sm:min-w-[108px]",
                  st === "unexplored" && "border-slate-800 bg-slate-900/50 text-slate-500",
                  st === "cleared" && "border-emerald-800/60 bg-emerald-950/30 text-emerald-200",
                  st === "active" && "border-amber-500/70 bg-amber-950/40 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.25)]",
                  canEnter && "cursor-pointer hover:brightness-110",
                  !canEnter && i > 0 && "cursor-default"
                )}
                animate={isCurrent ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                transition={isCurrent ? { repeat: Infinity, duration: 2.2, ease: "easeInOut" } : {}}
              >
                <span className="text-xs font-semibold">{node.label}</span>
                {node.difficulty && <span className="mt-1 text-[10px] text-slate-500">{node.difficulty}</span>}
                <span className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">{statusLabel(st)}</span>
              </motion.button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">冒险地图</h1>
          <p className="mt-1 text-sm text-slate-400">
            角色状态与装备实时同步本地档案；战斗层用专注倒计时替代手动操作，逃跑会扣除生命（与任务线一致）。
          </p>
        </div>
        <Link
          href="/adventure-log"
          className="self-start rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          查看战报 →
        </Link>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="lg:w-72 lg:shrink-0">
          <CharacterAdventurePanel profile={profile} />
        </div>

        <section className="card min-h-[420px] flex-1 border-slate-800 bg-slate-950/40 p-4 md:p-6">
          {scene && expeditionActive && (
            <p className="mb-4 text-center text-sm text-cyan-200/90">
              当前场景：<span className="font-medium text-cyan-100">{scene}</span>
            </p>
          )}
          {mapBody}
        </section>
      </div>

      {battleOpen && (
        <BattleOverlay
          open={battleOpen}
          sceneName={scene}
          monsterName={monsterName}
          logLines={logLines}
          durationSec={durationSec}
          onFlee={handleFlee}
          onTimeVictory={handleTimeVictory}
        />
      )}

      <VictoryOverlay
        open={victoryOpen}
        lootLabel={lastLoot}
        statFloatLabel={STAT_FLOAT[profession]}
        onContinue={onVictoryContinue}
      />
    </AppShell>
  );
}
