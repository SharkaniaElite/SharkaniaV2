import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sk: {
          bg: {
            0: "#09090b",
            1: "#0c0d10",
            2: "#111214",
            3: "#18191c",
            4: "#1f2023",
            5: "#27282c",
          },
          border: {
            1: "rgba(255,255,255,0.06)",
            2: "rgba(255,255,255,0.09)",
            3: "rgba(255,255,255,0.14)",
          },
          text: {
            1: "#fafafa",
            2: "#a1a1aa",
            3: "#71717a",
            4: "#52525b",
          },
          accent: {
            DEFAULT: "#22d3ee",
            hover: "#06b6d4",
            dim: "rgba(34,211,238,0.10)",
            glow: "rgba(34,211,238,0.20)",
            solid: "#0891b2",
          },
          green: {
            DEFAULT: "#34d399",
            dim: "rgba(52,211,153,0.10)",
          },
          red: {
            DEFAULT: "#f87171",
            dim: "rgba(248,113,113,0.10)",
          },
          gold: {
            DEFAULT: "#fbbf24",
            dim: "rgba(251,191,36,0.10)",
          },
          orange: {
            DEFAULT: "#fb923c",
            dim: "rgba(251,146,60,0.10)",
          },
          purple: {
            DEFAULT: "#a78bfa",
            dim: "rgba(167,139,250,0.10)",
          },
          silver: "#cbd5e1",
          bronze: "#d97706",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        "sk-xs": "0 1px 2px rgba(0,0,0,0.3)",
        "sk-sm": "0 2px 4px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.3)",
        "sk-md": "0 4px 8px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.2)",
        "sk-lg": "0 8px 24px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2)",
        "sk-xl":
          "0 16px 48px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.25)",
        "sk-glow":
          "0 0 16px rgba(34,211,238,0.10), 0 0 48px rgba(34,211,238,0.05)",
      },
      fontSize: {
        "sk-xs": "0.75rem",
        "sk-sm": "0.8125rem",
        "sk-base": "0.875rem",
        "sk-md": "1rem",
        "sk-lg": "clamp(1.125rem, 1rem + 0.5vw, 1.25rem)",
        "sk-xl": "clamp(1.25rem, 1rem + 1vw, 1.5rem)",
        "sk-2xl": "clamp(1.5rem, 1.2rem + 1.5vw, 2rem)",
        "sk-3xl": "clamp(2rem, 1.5rem + 2vw, 2.75rem)",
        "sk-4xl": "clamp(2.5rem, 2rem + 2.5vw, 3.5rem)",
        "sk-hero": "clamp(3rem, 2rem + 4vw, 5rem)",
      },
      spacing: {
        "sk-1": "0.25rem",
        "sk-2": "0.5rem",
        "sk-3": "0.75rem",
        "sk-4": "1rem",
        "sk-5": "1.25rem",
        "sk-6": "1.5rem",
        "sk-8": "2rem",
        "sk-10": "2.5rem",
        "sk-12": "3rem",
        "sk-16": "4rem",
        "sk-20": "5rem",
        "sk-24": "6rem",
      },
      transitionTimingFunction: {
        "sk-ease": "cubic-bezier(0.16, 1, 0.3, 1)",
        "sk-spring": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        "sk-fast": "120ms",
        "sk-base": "200ms",
        "sk-slow": "350ms",
      },
      zIndex: {
        "sk-base": "1",
        "sk-dropdown": "50",
        "sk-sticky": "100",
        "sk-overlay": "200",
        "sk-modal": "300",
        "sk-toast": "400",
        "sk-max": "999",
      },
      keyframes: {
        "sk-fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "sk-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "sk-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
        "sk-scroll-bounce": {
          "0%, 100%": { transform: "translateX(-50%) translateY(0)" },
          "50%": { transform: "translateX(-50%) translateY(6px)" },
        },
      },
      animation: {
        "sk-fade-up": "sk-fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both",
        "sk-fade-in": "sk-fade-in 0.3s ease both",
        "sk-pulse": "sk-pulse 2s ease-in-out infinite",
        "sk-scroll-bounce": "sk-scroll-bounce 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
