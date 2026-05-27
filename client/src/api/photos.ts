/**
 * 写真ライブラリ操作の Tauri コマンドラッパー。
 * Rust 側 `commands::photos` と 1:1 対応。
 */
import { invoke } from "@tauri-apps/api/core";
import type { PhotoRecord } from "../types";

export function scanLocalPhotos(
  fullScan: boolean,
  targetPath: string,
): Promise<PhotoRecord[]> {
  return invoke<PhotoRecord[]>("scan_local_photos", { fullScan, targetPath });
}

export function getVrchatPicturePath(): Promise<string> {
  return invoke<string>("get_vrchat_picture_path");
}

export function getAllPhotos(): Promise<PhotoRecord[]> {
  return invoke<PhotoRecord[]>("get_all_photos");
}

export function toggleFavoriteDb(photoId: string): Promise<boolean> {
  return invoke<boolean>("toggle_favorite", { photoId });
}

export function resolveWorldName(worldId: string): Promise<string> {
  return invoke<string>("resolve_world_name", { worldId });
}

export function updateWorldNameByWorldId(
  worldId: string,
  worldName: string,
): Promise<void> {
  return invoke<void>("update_world_name_by_world_id", { worldId, worldName });
}
