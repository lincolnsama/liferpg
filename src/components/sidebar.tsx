"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavTone = "loop" | "reward" | "more";

type NavItem = {
  href: string;
  label: string;
  /** `/` 必须全等，避免子路径误高亮首页 */
  match?: "exact";
};

type NavSection = {
  id: string;
  label: string;
  tone: NavTone;
  items: NavItem[];
};

/** Batch 3：主导航按「今日 → 任务 → 记录 → 成长 → 奖励与收藏」组织；后置玩法收入「更多」 */
const navSections: NavSection[] = [
  {
    id: "today",
    label: "今日",
    tone: "loop",
    items: [
      { href: "/", label: "指挥室", match: "exact" },
      { href: "/morning-load", label: "晨间仪式" }
    ]
  },
  {
    id: "tasks",
    label: "任务",
    tone: "loop",
    items: [{ href: "/tasks", label: "今日任务" }]
  },
  {
    id: "record",
    label: "记录",
    tone: "loop",
    items: [
      { href: "/journal", label: "人生日志" },
      { href: "/night-save", label: "夜间封存" }
    ]
  },
  {
    id: "growth",
    label: "成长",
    tone: "loop",
    items: [
      { href: "/skills", label: "技能树" },
      { href: "/stats", label: "人生数据" },
      { href: "/profession", label: "职业" }
    ]
  },
  {
    id: "rewards",
    label: "奖励 · 收藏",
    tone: "reward",
    items: [
      { href: "/shop", label: "商店" },
      { href: "/inventory", label: "背包" },
      { href: "/collection", label: "收藏" }
    ]
  }
];

const navMore: NavItem[] = [
  { href: "/feedback", label: "Demo 反馈" },
  { href: "/epic-quests", label: "史诗任务" },
  { href: "/weekly", label: "周常" },
  { href: "/adventure", label: "文字冒险" },
  { href: "/adventure-log", label: "冒险战报" },
  { href: "/focus", label: "专注仪式" }
];

function pathActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact" || item.href === "/") {
    return pathname === item.href;
  }
  return pathname === item.href;
}

function itemLinkClass(active: boolean, tone: NavTone): string {
  if (tone === "more") {
    return cn(
      "rounded-lg px-2 py-1.5 text-center text-[11px] transition md:px-3 md:text-left",
      active
        ? "bg-slate-800/90 text-slate-200"
        : "text-slate-500 hover:bg-slate-800/80 hover:text-slate-300"
    );
  }
  if (tone === "reward") {
    return cn(
      "rounded-lg px-2 py-2 text-center text-[11px] transition md:px-3 md:text-left md:text-[13px]",
      active
        ? "bg-slate-800/90 text-slate-100"
        : "text-slate-500 hover:bg-slate-800/70 hover:text-slate-300"
    );
  }
  return cn(
    "rounded-lg px-2 py-2 text-center text-xs transition md:px-3 md:text-left md:text-sm",
    active ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-20 flex-col border-r border-slate-800 bg-slate-950 md:w-56">
      <div className="border-b border-slate-800 px-3 py-4 md:px-5">
        <p className="text-center text-xs font-semibold text-cyan-400 md:text-left md:text-sm">Life RPG</p>
        <p className="mt-0.5 hidden text-[10px] text-slate-600 md:block">今日从这里开始</p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain p-2 md:p-4">
        {navSections.map((section, idx) => (
          <div key={section.id}>
            <p
              className={cn(
                "hidden px-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-slate-600 md:block",
                idx > 0 && "mt-3 border-t border-slate-800/80 pt-3"
              )}
            >
              {section.label}
            </p>
            {section.items.map((item) => {
              const active = pathActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={itemLinkClass(active, section.tone)}
                  title={item.label}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        <p className="mt-3 hidden border-t border-slate-800/80 px-1 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wide text-slate-600 md:block">
          更多
        </p>
        {navMore.map((item) => {
          const active = pathActive(pathname, item);
          return (
            <Link key={item.href} href={item.href} className={itemLinkClass(active, "more")} title={item.label}>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
