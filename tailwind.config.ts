import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          navy: "#1B2A4A",     // Main Alinma brand color
          purple: "#7C6FD4",   // Accent, AI chat bubbles, CTAs
          orange: "#D4754B",   // Highlights, alerts
          cream: "#F4ECE2",    // Background sections
          success: "#2E7D4F",  // Success green
          danger: "#C0392B",   // Danger red
          lightNavy: "#2A3D66",// Softer navy for sub-headers and cards
        }
      },
      fontFamily: {
        arabic: ["var(--font-arabic)", "Tajawal", "sans-serif"],
        english: ["var(--font-english)", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
