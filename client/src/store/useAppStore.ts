import { create } from "zustand";
import { toggleFavoriteDb } from "../api";
import type { AuthStatus } from "../api/auth";
import type { PhotoRecord, AlertMessage } from "../types";
import { strings } from "../lib/strings";
import {
  cacheThemePreference,
  getCachedThemePreference,
  type ThemePreference,
} from "../lib/theme";

export type { PhotoRecord, AlertMessage };

interface AppState {
  photos: PhotoRecord[];
  setPhotos: (photos: PhotoRecord[]) => void;

  isScanning: boolean;
  setIsScanning: (v: boolean) => void;

  scanProgress: string;
  setScanProgress: (v: string) => void;

  alerts: AlertMessage[];
  addAlert: (alert: AlertMessage) => void;
  removeAlert: (id: string) => void;

  addPhoto: (photo: PhotoRecord) => void;
  removePhotoByPath: (filePath: string) => void;
  toggleFavorite: (photoId: string) => Promise<void>;

  picturePath: string;
  setPicturePath: (path: string) => void;

  authStatus: AuthStatus | null;
  setAuthStatus: (s: AuthStatus | null) => void;

  showAutoStartDialog: boolean;
  setShowAutoStartDialog: (v: boolean) => void;
  autostartOn: boolean;
  setAutostartOn: (v: boolean) => void;

  backgroundImage: string;
  setBackgroundImage: (path: string) => void;
  backgroundDataUrl: string;
  setBackgroundDataUrl: (url: string) => void;

  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useAppStore = create<AppState>((set) => ({
  photos: [],
  setPhotos: (photos) => set({ photos }),

  isScanning: false,
  setIsScanning: (v) => set({ isScanning: v }),

  scanProgress: "",
  setScanProgress: (v) => set({ scanProgress: v }),

  alerts: [],
  addAlert: (alert) =>
    set((state) => ({ alerts: [...state.alerts, alert] })),
  removeAlert: (id) =>
    set((state) => ({ alerts: state.alerts.filter((a) => a.id !== id) })),

  addPhoto: (photo) =>
    set((state) => {
      // 撮影日時の降順を保つ位置へ挿入（末尾追加だと新着が最後尾に来てしまう）
      const idx = state.photos.findIndex((p) => p.captured_at <= photo.captured_at);
      const next = [...state.photos];
      if (idx === -1) next.push(photo);
      else next.splice(idx, 0, photo);
      return { photos: next };
    }),

  removePhotoByPath: (filePath) =>
    set((state) => ({
      photos: state.photos.filter((p) => p.file_path !== filePath),
    })),

  toggleFavorite: async (photoId) => {
    try {
      const newValue = await toggleFavoriteDb(photoId);
      set((state) => ({
        photos: state.photos.map((p) =>
          p.id === photoId ? { ...p, is_favorite: newValue } : p
        ),
      }));
    } catch (e) {
      console.error("Failed to toggle favorite:", e);
      set((state) => ({
        alerts: [
          ...state.alerts,
          {
            id: `fav-error-${Date.now()}`,
            type: "error" as const,
            message: `${strings.store.favoriteFailed}${e}`,
          },
        ],
      }));
    }
  },

  picturePath: "",
  setPicturePath: (path) => set({ picturePath: path }),

  authStatus: null,
  setAuthStatus: (s) => set({ authStatus: s }),

  showAutoStartDialog: false,
  setShowAutoStartDialog: (v) => set({ showAutoStartDialog: v }),
  autostartOn: false,
  setAutostartOn: (v) => set({ autostartOn: v }),

  backgroundImage: "",
  setBackgroundImage: (path) => set({ backgroundImage: path }),
  backgroundDataUrl: "",
  setBackgroundDataUrl: (url) => set({ backgroundDataUrl: url }),

  theme: getCachedThemePreference(),
  setTheme: (theme) => {
    cacheThemePreference(theme);
    set({ theme });
  },
}));
