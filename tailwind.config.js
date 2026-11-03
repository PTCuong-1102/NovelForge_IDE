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
        border: "var(--border-color)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--accent-color)",
        entity: {
          DEFAULT: "#10B981",
          bg: "rgba(16, 185, 129, 0.12)",
        },
        lore: {
          DEFAULT: "#3B82F6",
          bg: "rgba(59, 130, 246, 0.12)",
        },
        continuity: {
          error: "#EF4444",
          warning: "#F59E0B",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Literata", "Merriweather", "Charter", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
