"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { COSMETICS_UPDATED_EVENT, loadCosmetics } from "@/lib/cosmetics";
import { compressOldLogsToMonthlySummary, scheduleDailySeal } from "@/lib/daily-log";
import { loadUserProfile } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [themeId, setThemeId] = useState<string>("theme-cyber");

  useEffect(() => {
    const profile = loadUserProfile();
    if (!profile && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }
    setReady(true);
  }, [pathname, router]);

  useEffect(() => {
    const sync = () => setThemeId(loadCosmetics().equippedThemeId);
    sync();
    window.addEventListener(COSMETICS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    const cancel = scheduleDailySeal();
    void compressOldLogsToMonthlySummary();
    return cancel;
  }, []);

  if (!ready) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  const shellBg = cn(
    "min-h-screen text-slate-100 transition-colors duration-500",
    themeId === "theme-cyber" && "bg-slate-950",
    themeId === "theme-forest" && "bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950",
    themeId === "theme-samurai" && "bg-gradient-to-b from-red-950 via-slate-950 to-slate-950",
    themeId === "theme-mage" && "bg-gradient-to-b from-purple-950 via-slate-950 to-slate-950"
  );

  return (
    <div className={shellBg}>
      <Sidebar />
      <main className="ml-20 min-h-screen p-4 md:ml-56 md:p-8">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
