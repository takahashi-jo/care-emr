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

// ステータス色（success/danger/warning）も彩度を落として基調に合わせる。
// 既定の green/red/amber を差し替えるので、既存の bg-green-100 / text-red-800 等が自動追従する。
const mutedGreen = { // success・入所中（セージグリーン）
  50: '#f1f6f2', 100: '#dcebe1', 200: '#bcd8c6', 300: '#93bda3', 400: '#649a79',
  500: '#47825d', 600: '#39694b', 700: '#2f543d', 800: '#284533', 900: '#22392b',
}
const mutedRed = { // danger・エラー（ブリックレッド。警告性は保ちつつ鮮やかさを抑える）
  50: '#fbf3f2', 100: '#f6e0dd', 200: '#eec5c1', 300: '#e0a09a', 400: '#cf736b',
  500: '#bd4f47', 600: '#a83d35', 700: '#8b332d', 800: '#732d29', 900: '#602926',
}
const mutedAmber = { // warning・未確認（オーカー）
  50: '#fbf6eb', 100: '#f5e8cd', 200: '#ebd49d', 300: '#ddba6a', 400: '#cda13f',
  500: '#b8862a', 600: '#9d6d20', 700: '#7d551d', 800: '#66461e', 900: '#573c1d',
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
        // ステータス色（彩度を抑えて基調に統一）
        green: mutedGreen,   // success・入所中
        red: mutedRed,       // danger・エラー
        amber: mutedAmber,   // warning・未確認
      },
      fontFamily: {
        'sans': ['Inter', 'Noto Sans JP', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
