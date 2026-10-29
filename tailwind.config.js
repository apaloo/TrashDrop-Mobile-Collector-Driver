/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // The design system (src/theme/tokens.css, the same as the website and
      // the household app): DM Sans only, 13px the smallest text, and the
      // brand's dark green for actions.
      fontFamily: {
        sans: ["'DM Sans'", 'system-ui', '-apple-system', "'Segoe UI'", 'Roboto', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }],
      },
      colors: {
        // primary was #4CAF50 (white on it 2.8:1); now the dark green (6.3:1)
        primary: "#1b6e35",
        'primary-dark': "#155a2b",
        'primary-light': "#e6f2e9",
        // secondary was #FF9800 and danger #F44336: white on them failed;
        // the darker orange and red keep their meaning and pass
        secondary: "#b4530e",
        'secondary-dark': "#8a3f0b",
        'secondary-light': "#fdebd9",
        danger: "#b91c1c",
        'danger-dark': "#991b1b",
        dark: "#0a0f0a",
        light: "#f6f8f4",
        // Green buttons, links and text in the dark green family
        green: {
          '600': '#1b6e35',
          '700': '#155a2b',
          '800': '#114a23',
        },
        td: {
          lime: '#b6ee69',
          orange: '#f98b38',
          'orange-text': '#b4530e',
          forest: '#1b6e35',
          'forest-dk': '#155a2b',
          tonal: '#e6f2e9',
          ink: '#0a0f0a',
          sage: '#525c52',
          'sage-dark': '#a9b2a9',
          cream: '#f6f8f4',
          border: '#dfe4dc',
          'border-strong': '#8a8f9c',
          error: '#b91c1c',
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.5s ease-in-out',
        'slideUp': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
}
