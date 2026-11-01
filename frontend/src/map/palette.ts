import type { Theme } from "../hooks/useTheme";

export interface MapPalette {
  oceanTop: string;
  oceanBottom: string;
  land: string;
  landIndia: string;
  coast: string;
  border: string;
  stateBorder: string;
  graticule: string;
  graticuleLabel: string;
  label: string;
  labelHalo: string;
  cityDot: string;
  marker: string;
  markerRing: string;
  scaleBar: string;
}

/** The basemap is drawn from geometry in these colours; it follows the app theme. */
export const PALETTES: Record<Theme, MapPalette> = {
  dark: {
    oceanTop: "#123a66",
    oceanBottom: "#0b2447",
    land: "#1f3f66",
    landIndia: "#2a5080",
    coast: "rgba(168,207,255,0.55)",
    border: "rgba(190,215,245,0.32)",
    stateBorder: "rgba(190,215,245,0.16)",
    graticule: "rgba(190,215,245,0.09)",
    graticuleLabel: "rgba(200,222,248,0.55)",
    label: "rgba(240,246,255,0.92)",
    labelHalo: "rgba(9,26,52,0.85)",
    cityDot: "rgba(255,255,255,0.85)",
    marker: "#ffe1a6",
    markerRing: "rgba(255,225,166,0.35)",
    scaleBar: "rgba(240,246,255,0.85)",
  },
  light: {
    oceanTop: "#cfe5f7",
    oceanBottom: "#b4d3ee",
    land: "#f4f2ec",
    landIndia: "#fbf8f0",
    coast: "rgba(40,86,140,0.55)",
    border: "rgba(40,86,140,0.34)",
    stateBorder: "rgba(40,86,140,0.16)",
    graticule: "rgba(40,86,140,0.10)",
    graticuleLabel: "rgba(30,64,110,0.6)",
    label: "rgba(11,36,66,0.92)",
    labelHalo: "rgba(255,255,255,0.85)",
    cityDot: "rgba(11,36,66,0.8)",
    marker: "#b45309",
    markerRing: "rgba(180,83,9,0.28)",
    scaleBar: "rgba(11,36,66,0.8)",
  },
};
