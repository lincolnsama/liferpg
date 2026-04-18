"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "主页" },
  { href: "/tasks", label: "任务" },
  { href: "/skills", label: "技能" },
  { href: "/profession", label: "职业" },
  { href: "/shop", label: "商店" },
  { href: "/inventory", label: "装备" },
  { href: "/collection", label: "收藏" },
  { href: "/stats", label: "数据" },
  { href: "/epic-quests", label: "史诗" },
  { href: "/weekly", label: "周常" },
  { href: "/journal", label: "日志" },
  { href: "/night-save", label: "篝火" },
  { href: "/adventure", label: "冒险" },
  { href: "/adventure-log", label: "战报" }
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 flex h-screen w-20 flex-col border-r border-slate-800 bg-slate-950 md:w-56">
      <div className="border-b border-slate-800 px-3 py-4 md:px-5">
        <p className="text-center text-xs font-semibold text-cyan-400 md:text-left md:text-sm">
          Life RPG
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-2 p-2 md:p-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/adventure"
              ? pathname === "/adventure"
              : item.href === "/adventure-log"
                ? pathname === "/adventure-log"
                : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-2 py-2 text-center text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white md:px-3 md:text-left md:text-sm",
                isActive && "bg-slate-800 text-white"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
