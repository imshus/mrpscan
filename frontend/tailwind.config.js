/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      spacing: {
        screen: '20px',
        'screen-lg': '24px',
        card: '16px',
        section: '16px',
      },
      colors: {
        // MRPscan cream/red brand (design-mockup/styles.css)
        primary: {
          DEFAULT: '#D9291F',
          dark: '#A81F17',
          light: '#E85A4F',
          button: '#D9291F',
          nav: '#A81F17',
        },
        accent: {
          DEFAULT: '#A81F17',
          gold: '#B8860B',
          link: '#A81F17',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#FBF7F0',
          card: '#F4ECDC',
          input: '#FFFFFF',
        },
        border: {
          DEFAULT: '#E9DDC4',
          light: '#E9DDC4',
        },
        text: {
          primary: '#15120D',
          secondary: '#857A63',
          muted: '#857A63',
          placeholder: '#B8AC8F',
          label: '#857A63',
        },
        metal: {
          gold: '#B8860B',
          goldBg: '#FBF3DD',
          goldBorder: '#ECD9A0',
        },
        diamond: {
          DEFAULT: '#2F6FB0',
          bg: '#EAF3FB',
          border: '#BCDCF4',
        },
        success: {
          bg: '#E7F4EC',
          text: '#1A8A4A',
        },
        danger: {
          bg: '#FBE5E3',
          text: '#A81F17',
        },
        tabInactive: '#F4ECDC',
      },
      borderRadius: {
        card: '22px',
        input: '14px',
        button: '999px',
      },
      fontFamily: {
        sans: ['System'],
        display: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
