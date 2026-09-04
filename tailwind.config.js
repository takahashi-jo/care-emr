import colors from 'tailwindcss/colors'

/**
 * カラートークンは全てここで一元管理する（各コンポーネントの className は既存のまま）。
 * デザイン方針: ニュートラル基調 ＋ 落ち着いた青。
 * - 無彩色は純グレー(gray)ではなくスレート(slate)。やや青みがかり、医療系UIとして落ち着いた印象。
 * - プライマリの青は既定の鮮やかな blue を少し彩度を落とした「calm blue」に差し替え。
 *   既存の bg-blue-600 / text-blue-600 / ring-blue-500 等は自動的にこの色を参照する。
 */
const calmBlue = {
  50: '#eff5fb',
  100: '#dbe8f5',
  200: '#bcd3ec',
  300: '#90b4dd',
  400: '#5e8dc7',
  500: '#3d6fae',
  600: '#2f5b95', // プライマリ（ボタン・リンク・アクティブタブ）
  700: '#294c7c',
  800: '#274267',
  900: '#253a57',
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 無彩色: gray → slate（既存の gray-* クラスがそのままスレートを参照）
        gray: colors.slate,
        // プライマリ: 落ち着いた青（既存の blue-* クラスがそのまま参照）
        blue: calmBlue,
        // セマンティック用エイリアス（今後 primary-600 等で参照可能）
        primary: calmBlue,
      },
      fontFamily: {
        'sans': ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
