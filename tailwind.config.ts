import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          primary: "#08A6C9",
          secondary: "#318098",
          tertiary: "#6475AC",
          neutral: "#747682",
        }
      },
      fontFamily: {
        // Requiere importar Hanken Grotesk en tu layout.tsx
        sans: ['var(--font-hanken)', 'sans-serif'], 
        mono: ['var(--font-jetbrains)', 'monospace'],
      }
    },
  },
  plugins: [],
};
export default config;