/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        macos: {
          bg:       "#2A2A2E",
          sidebar:  "#2E2E32",
          card:     "#363639",
          elevated: "#424245",
          border:   "rgba(255,255,255,0.08)",
          text:     "#E5E5E7",
          secondary:"#A0A0A5",
          tertiary: "#6E6E73",
          quaternary:"#555559",
          blue:     "#0A84FF",
          "blue-hover": "#409CFF",
          "blue-soft":"rgba(10,132,255,0.12)",
          green:    "#30D158",
          "green-soft":"rgba(48,209,88,0.12)",
          red:      "#FF453A",
          yellow:   "#FFD60A",
          orange:   "#FF9F0A",
          purple:   "#BF5AF2",
          teal:     "#64D2FF",
        },
        // Keep old names mapped for backward compat during transition
        terminal: {
          50:  "#FAFAF9",
          100: "#F5F5F4",
          200: "#E5E5E7",
          300: "#D1D1D6",
          400: "#A0A0A5",
          500: "#6E6E73",
          600: "#555559",
          700: "#424245",
          800: "#363639",
          900: "#2A2A2E",
          950: "#2E2E32",
        },
        accent: {
          50:  "rgba(10,132,255,0.06)",
          100: "rgba(10,132,255,0.12)",
          200: "rgba(10,132,255,0.25)",
          300: "#409CFF",
          400: "#409CFF",
          500: "#0A84FF",
          600: "#0A84FF",
          700: "#0070E0",
          800: "#0058B3",
          900: "#003D80",
        },
      },
      fontFamily: {
        mono: ["'Fira Code'", "'JetBrains Mono'", "'Cascadia Code'", "ui-monospace", "monospace"],
        sans: ["-apple-system", "BlinkMacSystemFont", "'SF Pro Text'", "'Helvetica Neue'", "'Segoe UI'", "Roboto", "sans-serif"],
      },
      borderRadius: {
        "macos": "12px",
      },
      boxShadow: {
        "macos": "0 8px 32px rgba(0,0,0,0.32), 0 2px 8px rgba(0,0,0,0.16)",
        "macos-sm": "0 2px 8px rgba(0,0,0,0.24)",
      },
      backdropBlur: {
        "macos": "40px",
      },
    },
  },
  plugins: [],
};
