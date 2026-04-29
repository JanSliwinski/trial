"use client";

import { useMemo } from "react";
import { viridisColor, TIME_LABELS } from "@/lib/utils";

interface Props {
  surface: number[][];   // (96, K) — [time][soc_level]
  socLevels: number[];   // K SoC % labels
}

// Downsample time axis to 24 hourly columns for readability
const HOUR_INDICES = Array.from({ length: 24 }, (_, h) => h * 4);
const HOUR_LABELS = HOUR_INDICES.map((i) => TIME_LABELS[i]);

export default function WaterValueHeatmap({ surface, socLevels }: Props) {
  const { min, max, cells } = useMemo(() => {
    const flat = surface.flat();
    const min = Math.min(...flat);
    const max = Math.max(...flat);

    // cells[socIdx][hourIdx] = value
    const K = socLevels.length;
    const cells = Array.from({ length: K }, (_, k) =>
      HOUR_INDICES.map((t) => surface[t]?.[k] ?? 0)
    );
    return { min, max, cells };
  }, [surface, socLevels]);

  const reversedSocLevels = [...socLevels].reverse();
  const reversedCells = [...cells].reverse();

  return (
    <div className="overflow-x-auto">
      <div className="min-w-full">
        {/* Grid */}
        <div className="flex flex-col gap-0.5">
          {reversedSocLevels.map((soc, ki) => (
            <div key={soc} className="flex items-center gap-0.5">
              {/* Y-axis label */}
              <div className="w-10 text-right text-xs text-muted flex-shrink-0 pr-1">
                {soc.toFixed(0)}%
              </div>
              {/* Cells */}
              <div className="flex gap-0.5 flex-1">
                {reversedCells[ki].map((value, hi) => (
                  <div
                    key={hi}
                    title={`${HOUR_LABELS[hi]} · SoC ${soc.toFixed(0)}% · €${value.toFixed(1)}/MWh`}
                    className="flex-1 h-5 rounded-sm cursor-default transition-opacity hover:opacity-80"
                    style={{ background: viridisColor(value, min, max) }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* X-axis labels */}
        <div className="flex gap-0.5 mt-1 ml-[2.75rem]">
          {HOUR_LABELS.map((label, i) => (
            <div key={i} className="flex-1 text-center text-xs text-muted">
              {i % 3 === 0 ? label : ""}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 ml-[2.75rem]">
          <span className="text-xs text-muted">Low</span>
          <div
            className="flex-1 h-2 rounded-full"
            style={{
              background: `linear-gradient(to right, ${viridisColor(0, 0, 1)}, ${viridisColor(0.25, 0, 1)}, ${viridisColor(0.5, 0, 1)}, ${viridisColor(0.75, 0, 1)}, ${viridisColor(1, 0, 1)})`,
            }}
          />
          <span className="text-xs text-muted">High</span>
          <span className="text-xs text-muted font-mono ml-2">
            €{min.toFixed(1)}–€{max.toFixed(1)}/MWh
          </span>
        </div>
      </div>
    </div>
  );
}
