/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DentFlow Color Palette (Reference: HALAMAN.txt)
        primary: {
          DEFAULT: '#0066cc',      // DentFlow Blue
          light: '#4d94ff',
          dark: '#004d99',
        },
        secondary: {
          DEFAULT: '#00cc99',      // Teal accent
          light: '#66ffcc',
          dark: '#009977',
        },
        danger: {
          DEFAULT: '#cc0000',      // Red for warnings/errors
          light: '#ff3333',
          dark: '#990000',
        },
        success: {
          DEFAULT: '#00cc00',      // Green for success
          light: '#66ff66',
          dark: '#009900',
        },
        neutral: {
          DEFAULT: '#f5f5f5',      // Light gray background
          dark: '#e0e0e0',
          darker: '#a0a0a0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
