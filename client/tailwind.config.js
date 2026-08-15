/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--primary)",
        'primary-hover': "var(--primary-hover)",
        'primary-soft': "var(--primary-soft)",
        secondary: "#6b7280",
        success: "#10b981",
        'success-soft': "#ecfdf5",
        warning: "#f59e0b",
        danger: "#ef4444",
        'danger-soft': "#fef2f2",
        surface: "var(--surface)",
        'surface-alt': "var(--surface-alt)",
        background: "var(--background)",
        border: "var(--border)",
        'border-light': "var(--border-light)",
        text: "var(--text)",
        'text-secondary': "var(--text-secondary)",
        'text-muted': "var(--text-muted)",
      },
      borderRadius: {
        'sm': "8px",
        DEFAULT: "12px",
        'lg': "16px",
        'xl': "20px",
        '2xl': "28px",
        'full': "9999px",
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 23, 42, 0.04)',
        DEFAULT: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.06)',
        md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        lg: '0 10px 25px rgba(15, 23, 42, 0.08), 0 6px 12px -4px rgba(15, 23, 42, 0.06)',
        brand: '0 8px 24px -4px rgba(16, 185, 129, 0.35)',
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "'PingFang SC'",
          "'Hiragino Sans GB'",
          "'Microsoft YaHei'",
          "sans-serif"
        ],
      },
    },
  },
  plugins: [],
  // Disable core preflight styles — we want Tailwind utilities but keep the
  // existing CSS reset we already wrote in index.css (global form, typography, etc.)
  corePlugins: {
    preflight: true,
  },
}
