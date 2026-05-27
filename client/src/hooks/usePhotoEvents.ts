import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore, type PhotoRecord } from "../store/useAppStore";

/**
 * Rust 側のファイル監視（`file_watcher`）が emit するイベントを購読し、
 * Zustand ストアに反映する。
 *
 * - `photo-added`   : 新規ファイル → ストアに追加
 * - `photo-deleted` : 削除されたパス → ストアから除去
 */
export function usePhotoEvents(): void {
  const { addPhoto, removePhotoByPath } = useAppStore();

  useEffect(() => {
    const unlistenAdded = listen<PhotoRecord>("photo-added", (e) => addPhoto(e.payload));
    const unlistenDeleted = listen<string>("photo-deleted", (e) => removePhotoByPath(e.payload));
    return () => {
      unlistenAdded.then((f) => f());
      unlistenDeleted.then((f) => f());
    };
  }, [addPhoto, removePhotoByPath]);
}
