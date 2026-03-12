/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2d6a4f',
          light: '#52b788',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#f4a261',
          foreground: '#1b1b1b',
        },
        background: '#f8f9fa',
        surface: '#ffffff',
        danger: '#e63946',
        success: '#2d6a4f',
        warning: '#f4a261',
        muted: {
          DEFAULT: '#f1f5f9',
          foreground: '#6c757d',
        },
        border: '#e2e8f0',
        input: '#e2e8f0',
        ring: '#2d6a4f',
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
