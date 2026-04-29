import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-deep":    "#020810",
        bg:           "#050d1b",
        surface:      "#091527",
        "surface-2":  "#0d1e35",
        "surface-3":  "#122543",
        border:       "#182f4a",
        "border-2":   "#1e3d60",
        primary:      "#38bdf8",
        emerald:      "#34d399",
        amber:        "#fbbf24",
        orange:       "#fb923c",
        red:          "#f87171",
        violet:       "#818cf8",
        text:         "#eef4ff",
        "text-2":     "#8ba3bf",
        "text-3":     "#3d5a78",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "22px",
      },
      boxShadow: {
        "glow-blue":   "0 0 0 1px rgba(56,189,248,0.2), 0 4px 32px rgba(56,189,248,0.08)",
        "glow-green":  "0 0 0 1px rgba(52,211,153,0.2), 0 4px 32px rgba(52,211,153,0.08)",
        "glow-amber":  "0 0 0 1px rgba(251,191,36,0.2),  0 4px 32px rgba(251,191,36,0.08)",
        "inner-blue":  "inset 0 1px 0 rgba(56,189,248,0.1)",
      },
    },
  },
  plugins: [],
};

export default config;
