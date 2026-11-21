// Chart colour tokens (kept out of the "use client" bundle boundaries).
// Series 1 is the brand blue (Twitter blue). The second series (targets, the 2nd donut slice) is a deeper
// shade of the same blue, told apart by lightness so it stays distinct for colour-blind readers too
// (checked with the dataviz palette validator: normal-vision ΔE 22).
export const CHART_COLORS = {
  blue: "#1DA1F2", // brand-500
  blueLight: "#94D0FF", // brand-300
  navy: "#005E94", // brand-700
  green: "#10B981",
  red: "#EF4444",
  amber: "#F59E0B",
  slate: "#94A3B8",
  slateDark: "#475569",
};
