"use client";

import { useState } from "react";
import { Zap, LayoutDashboard, BarChart2, FileText, ChevronRight } from "lucide-react";

interface Props {
  status: "idle" | "running" | "done" | "error";
  date?: string;
}

const NAV = [
  { id: "dashboard", label: "Dashboard",  Icon: LayoutDashboard },
  { id: "analytics", label: "Analytics",  Icon: BarChart2 },
  { id: "reports",   label: "Reports",    Icon: FileText },
];

const STATUS_MAP = {
  idle:    { dot: "bg-text-3",  text: "text-text-3",  label: "Ready" },
  running: { dot: "bg-primary animate-pulse", text: "text-primary", label: "Processing…" },
  done:    { dot: "bg-emerald", text: "text-emerald",  label: "Complete" },
  error:   { dot: "bg-red",     text: "text-red",      label: "Error" },
};

export default function Navbar({ status, date }: Props) {
  const [active, setActive] = useState("dashboard");
  const s = STATUS_MAP[status];

  return (
    <header className="fixed top-0 inset-x-0 z-50 h-[52px] flex items-center px-5 gap-6
                       border-b border-border bg-bg/80 backdrop-blur-xl">

      {/* Brand */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div className="w-7 h-7 rounded-[9px] border border-primary/30 bg-primary/10
                        flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-[14px] text-text tracking-tight">HelleniFlex</span>
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                         bg-primary/10 text-primary border border-primary/20 leading-none">
          BETA
        </span>
      </div>

      {/* Nav */}
      <nav className="flex items-center gap-0.5">
        {NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`flex items-center gap-1.5 px-3 py-[5px] rounded-lg text-[12px] font-medium
                        transition-all duration-150
                        ${active === id
                          ? "bg-primary/10 text-primary"
                          : "text-text-2 hover:text-text hover:bg-surface-2"}`}
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </nav>

      {/* Breadcrumb (shows date when optimized) */}
      {date && (
        <div className="hidden md:flex items-center gap-1.5 text-[11px] text-text-3">
          <span>Dashboard</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-text-2 font-mono">{date}</span>
        </div>
      )}

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-3">
        {/* Live status */}
        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${s.text}`}>
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
          {s.label}
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Market badge */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full
                        border border-border bg-surface text-[10px] text-text-2 font-medium">
          <span className="w-2 h-2 rounded-full bg-[#0057AD]" />
          HEnEx · Greek DAM
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-1.5 text-[10px] text-emerald font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
          Live
        </div>
      </div>
    </header>
  );
}
