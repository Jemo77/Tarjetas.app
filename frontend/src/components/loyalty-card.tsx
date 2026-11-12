import type { CardTemplate } from "@/lib/types";
import { cn } from "@/lib/utils";

const STAMP_EMOJI: Record<string, string> = {
  coffee: "☕",
  beer: "🍺",
  star: "⭐",
  cocktail: "🍸",
  heart: "❤️",
  pizza: "🍕",
  burger: "🍔",
  sun: "☀️",
};

const DEFAULT_STAMP = "⭐";

interface LoyaltyCardProps {
  template: CardTemplate | null;
  stampsCount: number;
  stampsRequired: number;
  rewardTitle?: string;
  establishmentName?: string;
  status?: string;
  className?: string;
  /** Animar el último sello sumado (para la página de claim) */
  animateLast?: boolean;
}

const COLS = 5;

/**
 * Tarjeta de fidelidad renderizada como SVG puro. Sirve tanto para la
 * vista del cliente (wallet), la página /s/[token] y el preview del
 * diseñador en el panel.
 */
export function LoyaltyCard({
  template,
  stampsCount,
  stampsRequired,
  rewardTitle,
  establishmentName,
  status,
  className,
  animateLast = false,
}: LoyaltyCardProps) {
  const bg = template?.backgroundColor ?? "#1F2937";
  const text = template?.textColor ?? "#FFFFFF";
  const accent = template?.accentColor ?? "#F59E0B";
  const style = template?.emptySlotStyle ?? "outline";
  const icon = template?.stampIconKey ? (STAMP_EMOJI[template.stampIconKey] ?? DEFAULT_STAMP) : DEFAULT_STAMP;
  const title = rewardTitle ?? template?.rewardTitle ?? "Premio del local";
  const desc = template?.rewardDescription ?? null;

  const rows = Math.max(1, Math.ceil(stampsRequired / COLS));
  const slot = 46;
  const gap = 10;
  const gridW = COLS * slot + (COLS - 1) * gap;
  const gridH = rows * slot + (rows - 1) * gap;
  const x0 = (360 - gridW) / 2;
  const y0 = 190;

  const slots: { x: number; y: number; filled: boolean; animate: boolean }[] = [];
  for (let i = 0; i < stampsRequired; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const filled = i < stampsCount;
    slots.push({
      x: x0 + col * (slot + gap),
      y: y0 + row * (slot + gap),
      filled,
      animate: animateLast && filled && i === stampsCount - 1,
    });
  }

  const cardH = y0 + gridH + 70;

  return (
    <svg
      viewBox={`0 0 360 ${cardH}`}
      className={cn("w-full max-w-[340px] drop-shadow-xl", className)}
      role="img"
      aria-label={`Tarjeta de ${establishmentName ?? "fidelidad"}: ${stampsCount} de ${stampsRequired} sellos`}
    >
      <defs>
        <linearGradient id="card-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg} />
          <stop offset="100%" stopColor={shade(bg, -18)} />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="0%" r="90%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Base */}
      <rect x="0" y="0" width="360" height={cardH} rx="26" fill="url(#card-bg)" />
      <rect x="0" y="0" width="360" height="130" rx="26" fill="url(#glow)" />
      <rect x="0" y="0" width="360" height="130" rx="26" fill="url(#glow)" />

      {/* Franja superior */}
      <rect x="0" y="0" width="360" height="6" rx="3" fill={accent} />

      {/* Logo + nombre */}
      {template?.logoUrl ? (
        <image
          href={template.logoUrl}
          x="22"
          y="30"
          width="56"
          height="56"
          preserveAspectRatio="xMidYMid meet"
          clipPath="url(#logo-clip)"
        />
      ) : (
        <circle cx="50" cy="58" r="28" fill={accent} fillOpacity="0.18" stroke={accent} strokeWidth="1.5" />
      )}
      <clipPath id="logo-clip">
        <circle cx="50" cy="58" r="28" />
      </clipPath>
      <text x="50" y="64" textAnchor="middle" fontSize="24" fill={text}>
        {template?.logoUrl ? "" : "★"}
      </text>

      <text x="94" y="54" fontSize="17" fontWeight={700} fill={text} fontFamily="system-ui">
        {trim(establishmentName ?? "Tarjeta de sellos", 26)}
      </text>
      <text x="94" y="78" fontSize="12" fill={text} fillOpacity="0.75" fontFamily="system-ui">
        {trim(title, 34)}
      </text>
      <text x="94" y="99" fontSize="11" fill={accent} fontWeight={600} fontFamily="system-ui">
        {stampsCount} / {stampsRequired} sellos
      </text>

      {/* Progreso */}
      <rect x="94" y="108" width="150" height="5" rx="2.5" fill={text} fillOpacity="0.18" />
      <rect
        x="94"
        y="108"
        width={Math.max(0, Math.min(1, stampsCount / Math.max(1, stampsRequired))) * 150}
        height="5"
        rx="2.5"
        fill={accent}
      />

      {/* Grilla de sellos */}
      {slots.map((s, i) =>
        s.filled ? (
          <g key={i} className={s.animate ? "animate-stamp-pop" : undefined}>
            <circle cx={s.x + slot / 2} cy={s.y + slot / 2} r={slot / 2} fill={accent} fillOpacity="0.22" stroke={accent} strokeWidth="2" />
            <circle cx={s.x + slot / 2} cy={s.y + slot / 2} r={slot / 2 - 5} fill={accent} fillOpacity="0.95" />
            <text
              x={s.x + slot / 2}
              y={s.y + slot / 2 + 7}
              textAnchor="middle"
              fontSize="21"
              fill={contrastText(accent)}
              fontFamily="system-ui"
            >
              {icon}
            </text>
          </g>
        ) : (
          <circle
            key={i}
            cx={s.x + slot / 2}
            cy={s.y + slot / 2}
            r={slot / 2 - 3}
            fill="none"
            stroke={accent}
            strokeOpacity="0.55"
            strokeWidth="1.6"
            strokeDasharray={style === "dotted" ? "2 6" : undefined}
            strokeLinecap="round"
          />
        ),
      )}

      {/* Footer */}
      <rect x="0" y={cardH - 44} width="360" height="44" rx="0" fill={accent} fillOpacity="0.92" />
      <rect x="0" y={cardH - 44} width="360" height="44" fill="#000" fillOpacity="0.08" />
      <text x="180" y={cardH - 16} textAnchor="middle" fontSize="12.5" fontWeight={700} fill={contrastText(accent)} fontFamily="system-ui">
        {status === "COMPLETED" ? "🎉 Tarjeta completa: canjeá tu premio" : desc ? trim(desc, 56) : "Sumá sellos cada visita y ganá"}
      </text>
    </svg>
  );
}

/* Utilidades ------------------------------------------------------------------ */

function shade(hex: string, percent: number): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "#000000";
  const num = parseInt(h, 16);
  const amt = Math.round(2.55 * percent);
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0x00ff) + amt);
  const b = clamp((num & 0x0000ff) + amt);
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function clamp(v: number): number {
  return Math.min(255, Math.max(0, v));
}

function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "#FFFFFF";
  const num = parseInt(h, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 165 ? "#1C1917" : "#FFFFFF";
}

function trim(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}