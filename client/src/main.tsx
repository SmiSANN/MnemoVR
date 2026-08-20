import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { applyDocumentTheme, getCachedThemePreference } from "./lib/theme";

// React の初回描画前にキャッシュ済みテーマを適用して、起動時の色のちらつきを防ぐ。
applyDocumentTheme(getCachedThemePreference());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
