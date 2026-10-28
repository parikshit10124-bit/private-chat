/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chat: {
          darkBg: '#0b141a',
          darkSidebar: '#111b21',
          darkHeader: '#202c33',
          darkBubbleOut: '#005c4b',
          darkBubbleIn: '#202c33',
          darkBorder: '#222d34',
          darkHover: '#182229',
          lightBg: '#efeae2',
          lightSidebar: '#ffffff',
          lightHeader: '#f0f2f5',
          lightBubbleOut: '#d9fdd3',
          lightBubbleIn: '#ffffff',
          lightBorder: '#e9edef',
          lightHover: '#f5f6f6',
          primary: '#00a884',
          primaryHover: '#008f6f',
          accent: '#25d366',
          blueTick: '#53bdeb'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', '-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica Neue', 'sans-serif']
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'shake': 'shake 0.4s ease-in-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%, 60%': { transform: 'translateX(-6px)' },
          '40%, 80%': { transform: 'translateX(6px)' }
        }
      }
    },
  },
  plugins: [],
}
