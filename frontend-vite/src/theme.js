import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: { main: "#5f43b2" },
    secondary: { main: "#7b42f6" },
    background: { default: "#f5f3fa" },
  },
  typography: {
    fontFamily: "Inter, Arial, sans-serif",
    fontWeightBold: 900,
  },
});
