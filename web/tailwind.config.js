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
        medichain: {
          navy: "#0F1F2E",
          "navy-light": "#1A2E40",
          teal: "#1F7A7A",
          "teal-hover": "#176161",
          "teal-soft": "#EAF3F3",
          bg: "#F6F4EF",
          surface: "#FFFFFF",
          sage: "#DCE8E3",
          "sage-border": "#C8D9D2",
          amber: "#D98E04",
          "amber-soft": "#FEF7EA",
          verified: "#2E7D5B",
          "verified-soft": "#EBF5F0",
          tampered: "#B3402F",
          "tampered-soft": "#FCEEEB",
          border: "#E4DFD5",
          muted: "#6B7A88",
          subtle: "#9BA6B0",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "Source Serif 4", "Georgia", "Cambria", "serif"],
        sans: ["IBM Plex Sans", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["IBM Plex Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      borderRadius: {
        DEFAULT: "3px",
        sm: "2px",
        md: "4px",
        lg: "6px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 31, 46, 0.04)",
        dropdown: "0 4px 14px rgba(15, 31, 46, 0.09)",
        dialog: "0 12px 32px rgba(15, 31, 46, 0.16)",
      },
    },
  },
  plugins: [],
};
