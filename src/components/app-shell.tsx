"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/sidebar";
import Topbar from "@/components/topbar";
import { COSMETICS_UPDATED_EVENT, loadCosmetics } from "@/lib/cosmetics";
import { compressOldLogsToMonthlySummary, scheduleDailySeal } from "@/lib/daily-log";
import { createClient } from "@/lib/supabase-browser";
import {
  loadUserProfile,
  saveUserProfile,
  userProfileFromProfileRow,
  type ProfileHydrationRow
} from "@/lib/user-profile";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [themeId, setThemeId] = useState<string>("theme-cyber");

  useEffect(() => {
    let cancelled = false;

    const prepareProfile = async () => {
      const profile = loadUserProfile();
      if (profile || pathname === "/onboarding") {
        if (!cancelled) setReady(true);
        return;
      }

      const supabase = createClient();
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) router.replace("/login");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select(
          "nickname, real_job, mbti, birth_month, birth_day, constellation, life_stage, education, height_cm, weight_kg, current_challenge, desired_self, first_main_quest, race, primary_class, secondary_class, match_score, created_at"
        )
        .eq("id", user.id)
        .maybeSingle();

      const hydrated = userProfileFromProfileRow((data as ProfileHydrationRow | null) ?? null);
      if (hydrated) {
        saveUserProfile(hydrated);
        if (!cancelled) setReady(true);
        return;
      }

      if (!cancelled) router.replace("/onboarding");
    };

    void prepareProfile().catch(() => {
      if (!cancelled) router.replace("/onboarding");
    });
    return () => {
      cancelled = true;
    };
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
