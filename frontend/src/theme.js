import { createTheme } from "@mui/material/styles";

// The MUI-side half of the same design system defined in
// src/styles/_variables.scss (kept in sync by hand, since MUI's theme
// and Sass variables are two separate token systems with no automated
// bridge in this project). `primary`/`secondary`/`background`/`text`
// mirror the Sass tokens of the same name exactly. `primary.deep` and
// `oliveAccent` are the 2G-7A palette-richness correction's two new
// tones (mirroring $primary-deep/$olive-accent) — MUI tolerates extra
// keys on `palette.primary` and extra top-level palette entries at
// runtime, so no theme-typing/augmentation was needed for a plain-JS
// project. `background.sage` mirrors $sage-color, giving Home.jsx a
// third, genuinely distinct section-background tier (page ≠ section ≠
// card) without hardcoding a new hex value in that file. Every MUI
// component using `color="primary"`/`color="secondary"` still picks up
// the palette automatically through this one file — none of those page
// files need to be touched.
export const theme = createTheme({
  palette: {
    primary: { main: "#1e6b47", dark: "#154f35", deep: "#123c2a" },
    secondary: { main: "#3f8f5f" },
    oliveAccent: "#4f5c34",
    background: { default: "#e6ece2", paper: "#fcfdfb", sage: "#dbe6d5" },
    text: { primary: "#202b24", secondary: "#667085" },
  },
  typography: {
    fontFamily: "Inter, Arial, sans-serif",
    fontWeightBold: 900,
  },
});
