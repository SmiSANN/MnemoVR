//! 画像を image2vrc にアップロードして公開 URL を返すモジュール。
//!
//! 5MB 未満はそのまま PUT、超過分はリサイズ → JPEG 85% に再エンコードして送信。
//! Windows では WIC で高速デコード、その他は image クレートでフォールバック。

const IMAGE2VRC_BASE: &str = "https://imagetovrc.smisann.net";
const UPLOAD_MAX_BYTES: usize = 5 * 1024 * 1024;
#[cfg(not(windows))]
const RESIZE_MAX_PX: u32 = 2048;

/// アップロード可能なバイト列に変換する。
/// 戻り値: (バイト列, Content-Type)。
fn prepare_for_upload(file_path: &str) -> Result<(Vec<u8>, &'static str), String> {
    let file_size = std::fs::metadata(file_path)
        .map_err(|e| format!("ファイル情報の取得に失敗しました: {e}"))?
        .len() as usize;

    // 5MB 超 → リサイズして JPEG 圧縮
    let (rgb_pixels, width, height) = decode_and_resize(file_path)?;

    let rgb_image = image::RgbImage::from_raw(width, height, rgb_pixels)
        .ok_or("ピクセルバッファの変換に失敗しました")?;
    let mut buf = Vec::new();
    let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buf, 85);
    image::DynamicImage::ImageRgb8(rgb_image)
        .write_with_encoder(encoder)
        .map_err(|e| format!("JPEG 変換に失敗しました: {e}"))?;

    if buf.len() > UPLOAD_MAX_BYTES {
        return Err(format!(
            "圧縮後もファイルサイズが {}MB を超えています",
            UPLOAD_MAX_BYTES / 1024 / 1024
        ));
    }
    Ok((buf, "image/jpeg"))
}

/// Windows は WIC、それ以外は image クレートでデコード・リサイズして RGB ピクセルを返す。
#[cfg(windows)]
fn decode_and_resize(file_path: &str) -> Result<(Vec<u8>, u32, u32), String> {
    crate::wic::decode_and_resize(file_path)
}

#[cfg(not(windows))]
fn decode_and_resize(file_path: &str) -> Result<(Vec<u8>, u32, u32), String> {
    let img = image::open(file_path)
        .map_err(|e| format!("画像の読み込みに失敗しました: {e}"))?;
    let img = if img.width() > RESIZE_MAX_PX || img.height() > RESIZE_MAX_PX {
        img.resize(RESIZE_MAX_PX, RESIZE_MAX_PX, image::imageops::FilterType::Triangle)
    } else {
        img
    };
    let rgb = img.into_rgb8();
    let (w, h) = (rgb.width(), rgb.height());
    Ok((rgb.into_raw(), w, h))
}

/// ローカル画像を image2vrc にアップロードし、公開 URL を返す。
/// 重い画像処理は spawn_blocking で別スレッドに逃がす。
pub async fn upload(file_path: String) -> Result<String, String> {
    let (bytes, content_type) =
        tokio::task::spawn_blocking(move || prepare_for_upload(&file_path))
            .await
            .map_err(|e| format!("タスクエラー: {e}"))??;

    let uuid = uuid::Uuid::new_v4().to_string();
    let url = format!("{IMAGE2VRC_BASE}/{uuid}");

    reqwest::Client::new()
        .put(&url)
        .header("Content-Type", content_type)
        .body(bytes)
        .send()
        .await
        .map_err(|e| format!("アップロードに失敗しました: {e}"))?
        .error_for_status()
        .map_err(|e| format!("サーバーエラー: {e}"))?;

    Ok(url)
}
