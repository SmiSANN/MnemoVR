import { useEffect } from "react";
import { applyDocumentTheme, applyWindowTheme } from "../lib/theme";
import { useAppStore } from "../store/useAppStore";

/** 選択中のテーマをWeb UIとネイティブウィンドウへ反映する。 */
export function useTheme(): void {
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    applyDocumentTheme(theme);
    void applyWindowTheme(theme).catch(() => {});
  }, [theme]);
}
