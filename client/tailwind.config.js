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
        secondary: "var(--secondary)",
        'secondary-hover': "var(--secondary-hover)",
        'secondary-soft': "var(--secondary-soft)",
        accent: {
          orange: "var(--accent-orange)",
          green: "var(--accent-green)",
          rose: "var(--accent-rose)",
        },
        success: "var(--success)",
        'success-soft': "var(--success-soft)",
        warning: "var(--warning)",
        'warning-soft': "var(--warning-soft)",
        danger: "var(--danger)",
        'danger-soft': "var(--danger-soft)",
        info: "var(--info)",
        'info-soft': "var(--info-soft)",
        surface: "var(--surface)",
        'surface-hover': "var(--surface-hover)",
        'surface-alt': "var(--surface-muted)",
        'surface-elevated': "var(--surface-elevated)",
        background: "var(--bg)",
        border: "var(--border)",
        'border-strong': "var(--border-strong)",
        'border-light': "var(--border-light)",
        text: "var(--text)",
        'text-secondary': "var(--text-secondary)",
        'text-muted': "var(--text-muted)",
        'text-disabled': "var(--text-disabled)",
      },
      borderRadius: {
        'xs': "var(--radius-xs)",
        'sm': "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        'lg': "var(--radius-lg)",
        'xl': "var(--radius-xl)",
        '2xl': "var(--radius-2xl)",
        'full': "var(--radius-full)",
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        brand: 'var(--shadow-brand)',
        secondary: 'var(--shadow-secondary)',
        ring: 'var(--ring-primary)',
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
