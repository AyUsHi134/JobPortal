import { createTheme } from "@mui/material/styles";

// MUI theme mirrors Sass tokens
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
