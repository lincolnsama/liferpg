type XpBarProps = {
  progress: number;
  xp: number;
};

export default function XpBar({ progress, xp }: XpBarProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
        <span>经验值</span>
        <span>{xp} XP</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-700"
          style={{ width: `${Math.max(progress * 100, 2)}%` }}
        />
      </div>
    </div>
  );
}
