/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        bg2: "var(--bg2)",
        surface: "var(--surface)",
        "surface-raised": "var(--surface-raised)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        primary: "var(--primary)",
        "primary-dim": "var(--primary-dim)",
        secondary: "var(--secondary)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        "not-comparable": "var(--not-comparable)",
        g0: "var(--g0)",
        g1: "var(--g1)",
        g2: "var(--g2)",
        g3: "var(--g3)",
        g4: "var(--g4)",
        g5: "var(--g5)",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SF Mono",
          "JetBrains Mono",
          "Cascadia Code",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(18px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "translateY(14px) scale(0.985)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "float-y": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-140% 0" },
          "100%": { backgroundPosition: "140% 0" },
        },
        blink: { "50%": { opacity: "0" } },
      },
      animation: {
        "fade-up": "fade-up 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in": "fade-in 0.6s ease both",
        "scale-in": "scale-in 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "float-y": "float-y 6s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
        blink: "blink 1s steps(1) infinite",
      },
    },
  },
  plugins: [],
};
