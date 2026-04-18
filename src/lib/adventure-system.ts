import { hasMorningAttackBonus } from "@/lib/gear-inventory";
import type { AdventureEvent, Difficulty, Profession, Task } from "@/types/db";
import type { VirtualCharacter } from "@/types/game";
import { appendAdventureLog } from "@/types/game";

/** 现实任务职业 → 虚拟场景（随机取其一作前缀） */
export const SCENE_BY_PROFESSION: Record<Profession, [string, string]> = {
  Warrior: ["暴怒竞技场", "黎明要塞"],
  Mage: ["禁忌图书馆", "奥术塔"],
  Explorer: ["迷雾森林", "边境酒馆"],
  Artisan: ["工匠工坊", "巨龙工坊"],
  Guardian: ["圣光圣殿", "生命之泉"]
};

type MonsterDef = { name: string; desc: string; hpMin: number; hpMax: number };

const MONSTERS: Record<Difficulty, MonsterDef[]> = {
  Simple: [
    { name: "史莱姆", desc: "一团不安分的胶质，反射着任务的微光。", hpMin: 10, hpMax: 20 },
    { name: "小妖精", desc: "吱吱喳喳，专偷走你五分钟注意力。", hpMin: 12, hpMax: 18 },
    { name: "流浪地精", desc: "背着破布袋，想把你拖进拖延的岔路。", hpMin: 14, hpMax: 20 }
  ],
  Normal: [
    { name: "哥布林战士", desc: "磨利的木棒上刻着「再等等」的诅咒。", hpMin: 30, hpMax: 42 },
    { name: "暗影狼", desc: "在专注与分心之间徘徊的猎手。", hpMin: 35, hpMax: 48 },
    { name: "学术怪", desc: "把简单问题写成十页综述的幻影。", hpMin: 38, hpMax: 50 }
  ],
  Hard: [
    { name: "论文恶魔", desc: "尾注如锁链，参考文献如深渊。", hpMin: 80, hpMax: 110 },
    { name: "deadline巨龙", desc: "每一次扇翼都让日历燃烧。", hpMin: 95, hpMax: 130 },
    { name: "焦虑魔神", desc: "无数「如果失败」的低语汇成形体。", hpMin: 100, hpMax: 150 }
  ]
};

const MONSTER_ATK: Record<Difficulty, [number, number]> = {
  Simple: [2, 5],
  Normal: [4, 8],
  Hard: [7, 14]
};

const MONSTER_DEF: Record<Difficulty, number> = {
  Simple: 0,
  Normal: 2,
  Hard: 5
};

function randInt(lo: number, hi: number): number {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

function primaryAttackStat(profession: Profession, vc: VirtualCharacter): number {
  switch (profession) {
    case "Warrior":
      return vc.str + (vc.equipment.weapon?.effects.str ?? 0);
    case "Mage":
      return vc.int + (vc.equipment.weapon?.effects.int ?? 0);
    case "Explorer":
      return vc.agi + (vc.equipment.weapon?.effects.agi ?? 0);
    case "Artisan":
      return vc.cha + (vc.equipment.weapon?.effects.cha ?? 0);
    case "Guardian":
      return vc.con + (vc.equipment.weapon?.effects.con ?? 0);
    default:
      return vc.str;
  }
}

function playerDefense(vc: VirtualCharacter): number {
  const a = vc.equipment.armor;
  const bonus = (a?.effects.con ?? 0) + (a?.effects.str ?? 0) + (a?.effects.agi ?? 0);
  return vc.con + Math.floor(bonus * 0.35);
}

function rollDamage(attack: number, defense: number): number {
  const r = randInt(-2, 3);
  return Math.max(1, attack - defense + r);
}

const MONSTER_VERBS = ["挥出一击", "猛扑而来", "掷出暗影", "撕咬", "释放低语咒缚"];
const PLAYER_VERBS: Record<Profession, string[]> = {
  Warrior: ["战吼冲锋", "盾击反制", "重斩压上"],
  Mage: ["奥术弹幕", "符文封锁", "心智穿刺"],
  Explorer: ["侧闪还击", "钩索牵制", "疾步连击"],
  Artisan: ["灵感爆发", "精工反制", "构图压制"],
  Guardian: ["圣盾格挡后反击", "节律疗愈拳", "结界震退"]
};

const FINISH_VERBS = ["终结斩", "临界咏唱", "破局一击", "收刀入鞘的静压"];

export function lootLabel(difficulty: Difficulty): string {
  if (difficulty === "Hard") return pick(["锈蚀护符（纪念品）", "巨龙鳞片残片", "空白卷轴·极"], "loot");
  if (difficulty === "Normal") return pick(["小型法力尘埃", "旅者徽记"], "loot2");
  return "（无额外掉落）";
}

const STAT_BOOST_LINE: Record<Profession, string> = {
  Warrior: "你的力量感悟加深了！（STR +0.1，叙事向未写入面板）",
  Mage: "你的智力回路更清澈了！（INT +0.1，叙事向未写入面板）",
  Explorer: "你的脚步更轻了！（AGI +0.1，叙事向未写入面板）",
  Artisan: "你的灵感更耀眼了！（CHA +0.1，叙事向未写入面板）",
  Guardian: "你的身心更稳固了！（CON +0.1，叙事向未写入面板）"
};

export type TaskAdventureInput = {
  virtualCharacter: VirtualCharacter;
  task: Task;
  actualMinutes: number;
  finalCrystal: number;
  finalXp: number;
  /** 探索预览：只生成战斗段落，不写回治疗、不写晶石/成长尾段 */
  mode?: "full" | "combat-only";
  /** 与简报等对齐的随机种子（默认用 task.id） */
  seedSuffix?: string;
};

export type TaskAdventureResult = {
  virtualCharacter: VirtualCharacter;
  chronicle: string;
  meta: Record<string, string | number | boolean>;
};

function newEvent(
  kind: AdventureEvent["kind"],
  message: string,
  meta?: AdventureEvent["meta"]
): AdventureEvent {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random();
  return { id, at: Date.now(), kind, message, meta };
}

export type TextRpgBattleRun = TaskAdventureResult & {
  /** 结构化事件流（地城进入、回合战报等） */
  events: AdventureEvent[];
  settlement: {
    turns: number;
    damageTaken: number;
    loot: string;
    statGrowth: string;
  };
};

/**
 * 文字 RPG 战斗：每 5 分钟现实时间 = 1 回合；生成事件流 + 完整战报 + 结算摘要。
 */
export function buildTextRpgBattleResult(input: TaskAdventureInput): TextRpgBattleRun {
  const { virtualCharacter: vc0, task, actualMinutes, finalCrystal, finalXp } = input;
  const combatOnly = input.mode === "combat-only";
  const seedKey = input.seedSuffix ?? task.id;
  const scene = pick(SCENE_BY_PROFESSION[task.profession], seedKey + task.profession);
  const monsterPool = MONSTERS[task.difficulty];
  const mdef = pick(monsterPool, seedKey + "m");
  const monsterHp = randInt(mdef.hpMin, mdef.hpMax);
  const monster = { ...mdef, hp: monsterHp };
  const turnsCap = Math.max(1, Math.floor(actualMinutes / 5));

  const baseAtk = primaryAttackStat(task.profession, vc0);
  const mBonus = hasMorningAttackBonus(vc0, task.title);
  const playerAtk = Math.round(baseAtk * (1 + mBonus));
  const playerDef = playerDefense(vc0);
  const mAtkLo = MONSTER_ATK[task.difficulty][0];
  const mAtkHi = MONSTER_ATK[task.difficulty][1];
  const mDef = MONSTER_DEF[task.difficulty];

  let mhp = monster.hp;
  let php = vc0.hp;
  let minPhp = php;
  const lines: string[] = [];
  const events: AdventureEvent[] = [];

  events.push(
    newEvent("dungeon_enter", `你踏入「${scene}」的边界，空气里混着铁锈与墨香。`, { scene })
  );
  events.push(
    newEvent(
      "note",
      `魔物现身：${monster.name}（HP ${monster.hp}）。${monster.desc}`,
      { monster: monster.name, monsterHp: monster.hp }
    )
  );

  lines.push(
    `在「${scene}」，你遭遇了${monster.name}！${monster.desc}（现实任务：「${task.title}」）`
  );

  let turn = 0;
  let usedOvertime = false;
  while (mhp > 0 && turn < turnsCap) {
    turn += 1;
    const mDmg = rollDamage(randInt(mAtkLo, mAtkHi), playerDef);
    php = Math.max(1, php - mDmg);
    minPhp = Math.min(minPhp, php);
    const mLine = `第 ${turn} 回合 · 魔物${pick(MONSTER_VERBS, seedKey + "mv" + turn)}，对你造成 ${mDmg} 点伤害。（你剩余 HP：${php}）`;
    lines.push(mLine);
    events.push(newEvent("note", mLine, { turn, phase: "monster", damage: mDmg }));

    const pDmg = rollDamage(playerAtk, mDef);
    mhp -= pDmg;
    const verb = pick(PLAYER_VERBS[task.profession], seedKey + "pv" + turn);
    const pLine = `第 ${turn} 回合 · 你${verb}，造成 ${pDmg} 点伤害。（魔物剩余 HP：${Math.max(0, mhp)}）`;
    lines.push(pLine);
    events.push(newEvent("note", pLine, { turn, phase: "player", damage: pDmg }));
  }

  if (mhp > 0) {
    usedOvertime = true;
    const fin = Math.max(1, mhp);
    const finLine = `时间逼近回合上限，你透支专注完成终结！${pick(FINISH_VERBS, seedKey + "f")}，${monster.name}轰然倒下（清除了剩余 ${fin} HP）。`;
    lines.push(finLine);
    events.push(newEvent("note", finLine, { turn: turn + 1, phase: "finish" }));
  } else if (!usedOvertime) {
    const finLine = `最后一击！${pick(FINISH_VERBS, seedKey + "f2")}，${monster.name}倒下了！`;
    lines.push(finLine);
    events.push(newEvent("note", finLine, { phase: "finish" }));
  }

  const drop = lootLabel(task.difficulty);
  const rewardLine = `获得：${finalCrystal} 晶石，${finalXp} 经验。掉落物品：${drop}`;
  const growthLine = STAT_BOOST_LINE[task.profession];

  if (!combatOnly) {
    lines.push(rewardLine);
    events.push(newEvent("note", rewardLine, { crystals: finalCrystal, xp: finalXp }));
    lines.push(growthLine);
    events.push(newEvent("note", growthLine, { statGrowth: true }));
  }

  const healed = combatOnly
    ? php
    : Math.min(vc0.maxHp, Math.max(1, php + Math.floor(vc0.maxHp * 0.08)));
  const updatedVc: VirtualCharacter = {
    ...vc0,
    hp: healed,
    currentDungeon: undefined,
    adventureLog: vc0.adventureLog
  };

  const chronicle = lines.join("\n\n");
  const damageTaken = Math.max(0, vc0.hp - minPhp);

  return {
    virtualCharacter: updatedVc,
    chronicle,
    meta: {
      taskId: task.id,
      profession: task.profession,
      difficulty: task.difficulty,
      scene,
      monster: monster.name,
      turns: turn,
      flee: false,
      combatOnly: combatOnly || false,
      adventureEventCount: events.length
    },
    events,
    settlement: {
      turns: turn,
      damageTaken,
      loot: drop,
      statGrowth: growthLine
    }
  };
}

/** 提前放弃 / 逃跑：损失 20% 最大 HP（下限 1） */
export function applyAdventureFleePenalty(vc: VirtualCharacter): VirtualCharacter {
  const loss = Math.max(1, Math.floor(vc.maxHp * 0.2));
  return {
    ...vc,
    hp: Math.max(1, vc.hp - loss),
    currentDungeon: undefined
  };
}

/**
 * 完成任务后的冒险战报：回合数 = floor(实际专注分钟 / 5)，最少 1 回合。
 * 将 HP 变化写回 virtualCharacter，并生成一条可存入 adventureLog 的长文本。
 */
export function simulateTaskAdventure(input: TaskAdventureInput): TaskAdventureResult {
  const r = buildTextRpgBattleResult(input);
  return {
    virtualCharacter: r.virtualCharacter,
    chronicle: r.chronicle,
    meta: r.meta
  };
}

/** 将战报追加到 virtualCharacter.adventureLog */
export function appendAdventureResultToVirtualCharacter(result: TaskAdventureResult): VirtualCharacter {
  return appendAdventureLog(result.virtualCharacter, {
    kind: "adventure_chronicle",
    message: result.chronicle,
    meta: result.meta
  });
}

/** 自由冒险 / 地图遭遇：按职业随机场景名 */
export function pickAdventureScene(profession: Profession, seed: string): string {
  return pick(SCENE_BY_PROFESSION[profession], seed);
}

export type PickedMonster = { name: string; desc: string; hp: number };

export function pickAdventureMonster(difficulty: Difficulty, seed: string): PickedMonster {
  const mdef = pick(MONSTERS[difficulty], seed + "m");
  return { name: mdef.name, desc: mdef.desc, hp: randInt(mdef.hpMin, mdef.hpMax) };
}

const PAD_BATTLE_LINE = "战况胶着，你稳住阵脚，寻找下一击破绽……";

/** 将战报行数补齐到「每秒一条」等固定长度（末尾重复氛围句） */
export function padBattleLines(lines: string[], targetCount: number): string[] {
  if (lines.length >= targetCount) return lines.slice(0, targetCount);
  const out = [...lines];
  while (out.length < targetCount) out.push(PAD_BATTLE_LINE);
  return out;
}

/**
 * 与任务战报同规则的短遭遇模拟（无晶石 / XP 结算），用于地图专注倒计时战报。
 * `attackMultiplier` 可叠种族时段等（如晨型人上午 ×1.2）。
 */
export function generateStandaloneBattleLog(input: {
  vc: VirtualCharacter;
  profession: Profession;
  difficulty: Difficulty;
  scene: string;
  monster: PickedMonster;
  seed: string;
  maxTurns: number;
  attackMultiplier?: number;
}): { lines: string[]; finalPlayerHp: number } {
  const { vc: vc0, profession, difficulty, scene, monster, seed, maxTurns } = input;
  const mult = input.attackMultiplier ?? 1;
  const baseAtk = primaryAttackStat(profession, vc0);
  const mBonus = hasMorningAttackBonus(vc0, "晨间冒险热身");
  const playerAtk = Math.max(1, Math.round(baseAtk * mult * (1 + mBonus)));
  const playerDef = playerDefense(vc0);
  const mAtkLo = MONSTER_ATK[difficulty][0];
  const mAtkHi = MONSTER_ATK[difficulty][1];
  const mDef = MONSTER_DEF[difficulty];

  let mhp = monster.hp;
  let php = vc0.hp;
  const lines: string[] = [];

  lines.push(`在「${scene}」，你遭遇了${monster.name}！${monster.desc}（自由冒险）`);

  let turn = 0;
  let usedOvertime = false;
  while (mhp > 0 && turn < maxTurns) {
    turn += 1;
    const mDmg = rollDamage(randInt(mAtkLo, mAtkHi), playerDef);
    php = Math.max(1, php - mDmg);
    lines.push(`它${pick(MONSTER_VERBS, seed + "mv" + turn)}，对你造成了${mDmg}点伤害！`);

    const pDmg = rollDamage(playerAtk, mDef);
    mhp -= pDmg;
    const verb = pick(PLAYER_VERBS[profession], seed + "pv" + turn);
    lines.push(`你${verb}，造成了${pDmg}点伤害！（魔物剩余 HP：${Math.max(0, mhp)}）`);
  }

  if (mhp > 0) {
    usedOvertime = true;
    const fin = Math.max(1, mhp);
    lines.push(
      `专注时限将尽，你透支一口气完成终结！${pick(FINISH_VERBS, seed + "f")}，${monster.name}轰然倒下（清除了剩余 ${fin} HP）。`
    );
  } else if (!usedOvertime) {
    lines.push(`最后一击！${pick(FINISH_VERBS, seed + "f2")}，${monster.name}倒下了！`);
  }

  lines.push(STAT_BOOST_LINE[profession]);

  return { lines, finalPlayerHp: php };
}
