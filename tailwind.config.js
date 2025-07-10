/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'muk-bg': '#1e1e1e',      // 먹색에 가까운 어두운 배경
        'muk-text': '#cccccc',    // 밝은 회색 텍스트
        'muk-subtext': '#888888', // 보조 텍스트 (조금 더 어두운 회색)
        'muk-point': '#8095B0',   // 포인트 색상 (차분한 푸른 계열)
        'muk-border': '#555555',  // 경계선 색상
      }
    },
  },
  plugins: [],
}

