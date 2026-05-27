export interface PhotoRecord {
  id: string;
  file_path: string;
  world_id: string | null;
  world_name: string | null;
  user_id: string | null;
  user_name: string | null;
  captured_at: number; // Unix millis
  is_favorite: boolean;
}

export interface AlertMessage {
  id: string;
  type: "success" | "warning" | "error";
  message: string;
}
