import type { Profession } from "@/types/db";

export const PROFESSIONS: Array<{
  value: Profession;
  emoji: string;
  description: string;
}> = [
  { value: "Warrior", emoji: "⚔️", description: "执行力与行动突破" },
  { value: "Mage", emoji: "🔮", description: "学习与认知升级" },
  { value: "Explorer", emoji: "🧭", description: "探索新领域与冒险" },
  { value: "Artisan", emoji: "🛠️", description: "创造作品与打磨技能" },
  { value: "Guardian", emoji: "🛡️", description: "健康、关系与守护" }
];
