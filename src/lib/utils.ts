export const getLevelFromXp = (xp: number) => Math.floor(xp / 1000) + 1;

export const getLevelProgress = (xp: number) => (xp % 1000) / 1000;

export const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
