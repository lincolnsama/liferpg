export type WeeklyReportPayload = {
  weekLabel: string;
  weekCompleted: number;
  percentile: number;
  streak: number;
  streakRecord: boolean;
  hardestTitle: string;
  crystalIncome: number;
  crystalSpend: number;
  level: number;
  xp: number;
};

export function drawWeeklyReportToCanvas(payload: WeeklyReportPayload): HTMLCanvasElement {
  const W = 1080;
  const H = 1440;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return c;

  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0f172a");
  g.addColorStop(0.45, "#134e4a");
  g.addColorStop(1, "#0c4a6e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#e2e8f0";
  ctx.font = "bold 52px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText("人生数据 · 周报", 64, 120);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  ctx.fillText(`统计周期 ${payload.weekLabel}`, 64, 180);

  ctx.strokeStyle = "rgba(34,211,238,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 210);
  ctx.lineTo(W - 64, 210);
  ctx.stroke();

  let y = 280;
  const line = (label: string, value: string) => {
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "26px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
    ctx.fillText(label, 64, y);
    ctx.fillStyle = "#22d3ee";
    ctx.font = "bold 30px system-ui, 'PingFang SC', sans-serif";
    ctx.fillText(value, 64, y + 42);
    y += 110;
  };

  line("本周完成任务", `${payload.weekCompleted} 个`);
  line("模拟超越冒险者", `${payload.percentile}%`);
  line("连续打卡", `${payload.streak} 天${payload.streakRecord ? " · 新纪录" : ""}`);
  line("当前等级 / XP", `Lv.${payload.level} · ${payload.xp} XP`);
  line("本周晶石 · 收 / 支", `+${payload.crystalIncome} / −${payload.crystalSpend}`);

  ctx.fillStyle = "#f1f5f9";
  ctx.font = "26px system-ui, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const wrap = (text: string, maxW: number) => {
    const words = text.split("");
    let lineStr = "";
    const lines: string[] = [];
    for (const ch of words) {
      const test = lineStr + ch;
      if (ctx.measureText(test).width > maxW && lineStr) {
        lines.push(lineStr);
        lineStr = ch;
      } else lineStr = test;
    }
    if (lineStr) lines.push(lineStr);
    return lines;
  };
  ctx.fillText("本周最难一战", 64, y);
  y += 40;
  const hardLines = wrap(payload.hardestTitle || "（本周暂无困难任务记录）", W - 128);
  for (const ln of hardLines.slice(0, 3)) {
    ctx.fillStyle = "#fde68a";
    ctx.fillText(ln, 64, y);
    y += 36;
  }
  y += 40;

  ctx.fillStyle = "#64748b";
  ctx.font = "22px system-ui, 'PingFang SC', sans-serif";
  ctx.fillText("Life RPG · 规则模拟数据 · 适合分享", 64, H - 120);
  ctx.fillText("数据来自本地与 Supabase 任务记录", 64, H - 82);

  return c;
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}
