"use client";

import { useMemo, useState } from "react";
import { viridisColor, TIME_LABELS } from "@/lib/utils";

interface Props {
  surface: number[][];
  socLevels: number[];
}

const HOUR_INDICES = Array.from({ length: 24 }, (_, h) => h * 4);
const HOUR_LABELS  = HOUR_INDICES.map((i) => TIME_LABELS[i]);

export default function WaterValueHeatmap({ surface, socLevels }: Props) {
  const [hover, setHover] = useState<{ hour: string; soc: number; value: number } | null>(null);

  const { min, max, cells } = useMemo(() => {
    const flat = surface.flat();
    const min  = Math.min(...flat);
    const max  = Math.max(...flat);
    const K    = socLevels.length;
    const cells = Array.from({ length: K }, (_, k) =>
      HOUR_INDICES.map((t) => surface[t]?.[k] ?? 0)
    );
    return { min, max, cells };
  }, [surface, socLevels]);

  const reversedSocLevels = [...socLevels].reverse();
  const reversedCells     = [...cells].reverse();

  return (
    <div>
      {/* Hover info bar */}
      <div className="h-7 mb-3 flex items-center">
        {hover ? (
          <div className="flex items-center gap-4 text-[11px]">
            <span className="font-mono text-text-3">{hover.hour}</span>
            <span className="text-text-2">
              SoC <span className="font-mono text-text">{hover.soc.toFixed(0)}%</span>
            </span>
            <span className="font-mono font-bold text-primary">
              €{hover.value.toFixed(1)}/MWh
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-text-3">Hover a cell to inspect</span>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-full">
          {/* Grid */}
          <div className="flex flex-col gap-[2px]">
            {reversedSocLevels.map((soc, ki) => (
              <div key={soc} className="flex items-center gap-[2px]">
                {/* Y label */}
                <div className="w-9 text-right text-[10px] font-mono text-text-3 flex-shrink-0 pr-1.5">
                  {soc.toFixed(0)}%
                </div>
                {/* Cells */}
                <div className="flex gap-[2px] flex-1">
                  {reversedCells[ki].map((value, hi) => (
                    <div
                      key={hi}
                      className="flex-1 rounded-[3px] cursor-default transition-all duration-75
                                 hover:ring-1 hover:ring-white/30 hover:scale-y-110"
                      style={{
                        height: "18px",
                        background: viridisColor(value, min, max),
                      }}
                      onMouseEnter={() =>
                        setHover({ hour: HOUR_LABELS[hi], soc, value })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* X-axis */}
          <div className="flex gap-[2px] mt-2 ml-[2.625rem]">
            {HOUR_LABELS.map((label, i) => (
              <div key={i} className="flex-1 text-center text-[9px] font-mono text-text-3">
                {i % 4 === 0 ? label : ""}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 ml-[2.625rem]">
            <div className="flex items-center gap-3 mb-1.5">
              <span className="text-[10px] text-text-3 w-10 text-right font-mono">
                €{min.toFixed(0)}
              </span>
              <div
                className="flex-1 h-3 rounded-full"
                style={{
                  background: `linear-gradient(to right,
                    ${viridisColor(0, 0, 1)},
                    ${viridisColor(0.2, 0, 1)},
                    ${viridisColor(0.4, 0, 1)},
                    ${viridisColor(0.6, 0, 1)},
                    ${viridisColor(0.8, 0, 1)},
                    ${viridisColor(1, 0, 1)})`,
                }}
              />
              <span className="text-[10px] text-text-3 w-10 font-mono">
                €{max.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between ml-10 mr-10">
              <span className="text-[9px] text-text-3">Low value</span>
              <span className="text-[9px] text-text-3">€/MWh stored</span>
              <span className="text-[9px] text-text-3">High value</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
