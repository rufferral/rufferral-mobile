module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#0e6e56", dark: "#0a5a45", light: "#e1f5ee" },
      },
    },
  },
  plugins: [],
};
