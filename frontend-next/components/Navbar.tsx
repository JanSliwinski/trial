"use client";

import { Grid3x3, BarChart2, FileText } from "lucide-react";

export type NavTab = "dashboard" | "analytics" | "reports";

interface Props {
  status:      "idle" | "running" | "done" | "error";
  date?:       string;
  activeTab:   NavTab;
  onTabChange: (tab: NavTab) => void;
  onHome:      () => void;
  hasResult:   boolean;
}

const NAV: { id: NavTab; label: string; Icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard",  Icon: Grid3x3  },
  { id: "analytics", label: "Analytics",  Icon: BarChart2 },
  { id: "reports",   label: "Reports",    Icon: FileText  },
];

const STATUS_MAP = {
  idle:    { dot: "bg-text-3",                    text: "text-text-3",  label: "Ready"       },
  running: { dot: "bg-primary animate-pulse",     text: "text-primary", label: "Processing…" },
  done:    { dot: "bg-emerald",                   text: "text-emerald", label: "Complete"    },
  error:   { dot: "bg-red",                       text: "text-red",     label: "Error"       },
};

export default function Navbar({
  status, date, activeTab, onTabChange, onHome, hasResult,
}: Props) {
  const s = STATUS_MAP[status];

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-[52px] flex items-center px-5 gap-6
                       border-b border-border bg-bg/80 backdrop-blur-xl">

      {/* Brand — clicking resets to home */}
      <button
        onClick={onHome}
        className="flex items-center gap-2.5 flex-shrink-0 group"
        title="Back to home"
      >
        <div className="w-7 h-7 rounded-[9px] border border-primary/30 bg-primary/10
                        flex items-center justify-center
                        group-hover:bg-primary/20 transition-colors">
          <Grid3x3 className="w-3.5 h-3.5 text-primary" strokeWidth={2} />
        </div>
        <span className="font-bold text-[14px] text-text tracking-tight
                         group-hover:text-primary transition-colors">
          Helios Grid
        </span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                         bg-primary/10 text-primary border border-primary/20 leading-none">
          BETA
        </span>
      </button>

      {/* Nav tabs — disabled until a result exists */}
      <nav className="flex items-center gap-0.5">
        {NAV.map(({ id, label, Icon }) => {
          const disabled = !hasResult && id !== "dashboard";
          const active   = activeTab === id;
          return (
            <button
              key={id}
              disabled={disabled}
              onClick={() => !disabled && onTabChange(id)}
              className={`flex items-center gap-1.5 px-3 py-[5px] rounded-lg text-[12px] font-medium
                          transition-all duration-150
                          ${active
                            ? "bg-primary/10 text-primary"
                            : disabled
                              ? "text-text-3 cursor-not-allowed opacity-40"
                              : "text-text-2 hover:text-text hover:bg-surface-2"
                          }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
              {label}
            </button>
          );
        })}
      </nav>

      {/* Breadcrumb */}
      {date && (
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-text-3">
          <span>Helios Grid</span>
          <span className="text-text-3">›</span>
          <span className="text-text-2 font-mono">{date}</span>
        </div>
      )}

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          {s.label}
        </div>

        <div className="w-px h-4 bg-border" />

        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full
                        border border-border bg-surface text-[10px] text-text-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#0057AD]" />
          HEnEx · Greek DAM
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-emerald font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          Live
        </div>
      </div>
    </header>
  );
}
