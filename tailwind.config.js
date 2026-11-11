/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        panel: "var(--bg-panel)",
        elevated: "var(--bg-elevated)",
        paper: "var(--bg-paper)",
        border: "var(--border-color)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--accent-color)",
        entity: {
          DEFAULT: "var(--entity-pill-text)",
          bg: "var(--entity-pill-bg)",
        },
        lore: {
          DEFAULT: "var(--lore-pill-text)",
          bg: "var(--lore-pill-bg)",
        },
        continuity: {
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Literata", "Merriweather", "Charter", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
      spacing: {
        68: "17rem",
        76: "19rem",
        84: "21rem",
        88: "22rem",
      },
    },
  },
  plugins: [],
};
