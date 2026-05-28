/**
 * 設定・キャッシュ・サムネイル関連の Tauri コマンドラッパー。
 * Rust 側 `commands::storage` と 1:1 対応。
 */
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

// --- 設定 ---

export function getSetting(key: string): Promise<string | null> {
  return invoke<string | null>("get_setting", { key });
}

export function setSetting(key: string, value: string): Promise<void> {
  return invoke<void>("set_setting", { key, value });
}

export function setRunInBackground(enabled: boolean): Promise<void> {
  return invoke<void>("set_run_in_background", { enabled });
}

// --- サムネイル ---

/** サムネイルファイルパスを取得し、ブラウザで読める asset URL に変換して返す。 */
export async function getThumbnail(filePath: string): Promise<string> {
  const thumbPath = await invoke<string>("get_thumbnail", { filePath });
  return convertFileSrc(thumbPath);
}

/** 任意のローカルファイルパスをブラウザで読める asset URL に変換する。 */
export function getAssetUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

// --- アップロード済み画像 URL キャッシュ ---

export function getCachedImageUrl(filePath: string): Promise<string | null> {
  return invoke<string | null>("get_cached_image_url", { filePath });
}

export function setCachedImageUrl(filePath: string, url: string): Promise<void> {
  return invoke<void>("set_cached_image_url", { filePath, url });
}

// --- 一括クリア ---

export function clearThumbnailCache(): Promise<void> {
  return invoke<void>("clear_thumbnail_cache");
}

// --- アセットスコープ ---

/** ファイルパスをアセットプロトコルのスコープに動的追加する。 */
export function allowAssetFile(filePath: string): Promise<void> {
  return invoke<void>("allow_asset_file", { filePath });
}

/** ディレクトリ配下を再帰的にアセットプロトコルのスコープに追加する。 */
export function allowAssetDirectory(dirPath: string): Promise<void> {
  return invoke<void>("allow_asset_directory", { dirPath });
}

/** 画像ファイルを読み込み data URL（base64）として返す。production build でも動作する。 */
export function readImageAsDataUrl(filePath: string): Promise<string> {
  return invoke<string>("read_image_as_data_url", { filePath });
}

// --- ファイルダイアログ ---

/** 画像ファイル選択ダイアログを開く。キャンセル時は null。 */
export function pickImageFile(): Promise<string | null> {
  return invoke<string | null>("pick_image_file");
}

/** フォルダ選択ダイアログを開く。キャンセル時は null。 */
export function pickFolder(): Promise<string | null> {
  return invoke<string | null>("pick_folder");
}
