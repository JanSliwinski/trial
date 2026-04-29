import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIME_LABELS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4).toString().padStart(2, "0");
  const m = ((i % 4) * 15).toString().padStart(2, "0");
  return `${h}:${m}`;
});

export const TIME_LABELS_97 = [...TIME_LABELS, "24:00"];

/** Map value in [min,max] → viridis-like hex color */
export function viridisColor(value: number, min: number, max: number): string {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0;
  // Key viridis stops: purple → blue → teal → green → yellow
  const stops = [
    [68, 1, 84],
    [58, 82, 139],
    [32, 144, 140],
    [94, 201, 97],
    [253, 231, 37],
  ];
  const seg = t * (stops.length - 1);
  const lo = Math.floor(seg);
  const hi = Math.min(lo + 1, stops.length - 1);
  const f = seg - lo;
  const [r, g, b] = stops[lo].map((c, i) => Math.round(c + f * (stops[hi][i] - c)));
  return `rgb(${r},${g},${b})`;
}
