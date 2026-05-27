/**
 * OAuth 認証関連の Tauri コマンドラッパー。
 * Rust 側 `commands::auth` と 1:1 対応。
 */
import { invoke } from "@tauri-apps/api/core";

export interface AuthStatus {
  display_name: string;
  provider: string;
}

export function oauthLogin(): Promise<AuthStatus> {
  return invoke<AuthStatus>("oauth_login");
}

export function oauthLogout(): Promise<void> {
  return invoke<void>("oauth_logout");
}

export function getAuthStatus(): Promise<AuthStatus | null> {
  return invoke<AuthStatus | null>("get_auth_status");
}
