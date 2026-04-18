"use client";

import { useEffect } from "react";
import {
  COSMETICS_UPDATED_EVENT,
  loadCosmetics,
  recordDailyCheckIn,
  THEME_DATA_ATTR
} from "@/lib/cosmetics";
import { maybeGrantStreakSevenEpicGear } from "@/lib/gear-inventory";
import { loadUserProfile, saveUserProfile } from "@/lib/user-profile";

/** 挂载时应用主题 data 属性，并在自然日首次打开时记录打卡 streak */
export default function CosmeticRoot() {
  useEffect(() => {
    const apply = () => {
      const c = loadCosmetics();
      const theme = THEME_DATA_ATTR[c.equippedThemeId] ?? "cyber";
      document.documentElement.setAttribute("data-theme", theme);
      const cosAfter = recordDailyCheckIn();
      const streak = cosAfter.checkInStreak;
      const p = loadUserProfile();
      if (p) {
        const next = maybeGrantStreakSevenEpicGear(p, streak);
        if (next !== p) saveUserProfile(next);
      }
    };
    apply();
    window.addEventListener(COSMETICS_UPDATED_EVENT, apply);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, apply);
  }, []);

  return null;
}
