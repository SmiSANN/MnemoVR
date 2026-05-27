/**
 * 自前サーバーとの連携を行う Tauri コマンドラッパー。
 * Rust 側 `commands::server` と 1:1 対応。
 */
import { invoke } from "@tauri-apps/api/core";

export interface RankingEntry {
  world_id: string;
  world_name: string;
  score: number;
}

export interface RankingsData {
  daily: RankingEntry[];
  weekly: RankingEntry[];
  all_time: RankingEntry[];
}

/** ローカル DB の変更分をサーバーに同期する。 */
export function syncToServer(): Promise<string> {
  return invoke<string>("sync_to_server");
}

/** ローカル画像を image2vrc にアップロードし、公開 URL を返す。 */
export function uploadImage(filePath: string): Promise<string> {
  return invoke<string>("upload_image", { filePath });
}

/** ランキングを取得し、ワールド名まで解決済みの状態で返す。 */
export function fetchRankings(): Promise<RankingsData> {
  return invoke<RankingsData>("fetch_rankings");
}

/** サーバーの最新版を確認し、新しければバージョン文字列を返す。最新版なら null。 */
export function checkForUpdate(): Promise<string | null> {
  return invoke<string | null>("check_for_update");
}
