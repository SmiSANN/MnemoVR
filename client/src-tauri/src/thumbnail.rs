use image::RgbImage;
use std::path::{Path, PathBuf};

/// サムネイルの最大辺サイズ（ピクセル）
const THUMB_SIZE: u32 = 240;

/// 元画像パスのSHA-256ハッシュからサムネイルのキャッシュパスを生成する。
fn thumb_path(cache_dir: &Path, original_path: &str) -> PathBuf {
    use sha2::{Digest, Sha256};
    let hash = hex::encode(Sha256::digest(original_path.as_bytes()));
    cache_dir.join("thumbnails").join(format!("{hash}.jpg"))
}

/// RgbImageをJPEGとして保存する。
fn save_rgb_jpeg(img: &RgbImage, out: &Path) -> Result<(), String> {
    img.save(out).map_err(|e| format!("Failed to save thumbnail: {e}"))
}

/// サムネイルを生成して返す（キャッシュ済みならそのまま返す）。
/// Windows: Shell API（Explorerのキャッシュ）→ 失敗時は image クレートでデコード。
/// 他OS: image クレートでデコード。
pub fn ensure_thumbnail(cache_dir: &Path, original_path: &str) -> Result<PathBuf, String> {
    let out = thumb_path(cache_dir, original_path);

    if out.exists() {
        // 元画像がサムネイルより新しければ再生成
        let stale = (|| -> Option<bool> {
            let orig_modified = std::fs::metadata(original_path).ok()?.modified().ok()?;
            let thumb_modified = std::fs::metadata(&out).ok()?.modified().ok()?;
            Some(orig_modified > thumb_modified)
        })()
        .unwrap_or(false);

        if !stale {
            return Ok(out);
        }
    }

    if let Some(parent) = out.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create thumbnail dir: {e}"))?;
    }

    // Windows: Shell APIでExplorerのキャッシュを利用
    #[cfg(windows)]
    {
        match shell_thumbnail(original_path, &out) {
            Ok(()) => return Ok(out),
            Err(e) => eprintln!("Shell thumbnail failed for {original_path}, falling back: {e}"),
        }
    }

    // フォールバック: image クレートでフルデコード＋リサイズ
    fallback_thumbnail(original_path, &out)?;
    Ok(out)
}

/// フォールバック: 画像をフルデコード→リサイズ→JPEG保存。
/// アスペクト比は維持（フロントエンドのCSSでセンタリング）。
fn fallback_thumbnail(original_path: &str, out: &Path) -> Result<(), String> {
    use image::imageops::FilterType;
    use image::ImageReader;

    let img = ImageReader::open(original_path)
        .map_err(|e| format!("Failed to open image: {e}"))?
        .decode()
        .map_err(|e| format!("Failed to decode image: {e}"))?;

    let thumb = img.resize(THUMB_SIZE, THUMB_SIZE, FilterType::Triangle);
    let rgb = thumb.to_rgb8();
    save_rgb_jpeg(&rgb, out)
}

/// Windows: IShellItemImageFactoryでExplorerのサムネイルキャッシュを取得する。
/// Shell APIが返すBGRA画像の黒/透明パディングをトリミングしてJPEG保存する。
#[cfg(windows)]
fn shell_thumbnail(original_path: &str, out: &Path) -> Result<(), String> {
    use windows::core::HSTRING;
    use windows::Win32::Foundation::SIZE;
    use windows::Win32::Graphics::Gdi::{
        CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, BITMAPINFO, BITMAPINFOHEADER,
        BI_RGB, DIB_RGB_COLORS,
    };
    use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};
    use windows::Win32::UI::Shell::{
        IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_RESIZETOFIT,
        SIIGBF_THUMBNAILONLY,
    };

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        let result = (|| -> Result<(), String> {
            let path_h = HSTRING::from(original_path);
            let factory: IShellItemImageFactory =
                SHCreateItemFromParsingName(&path_h, None).map_err(|e| e.to_string())?;

            let size = SIZE {
                cx: THUMB_SIZE as i32,
                cy: THUMB_SIZE as i32,
            };

            // キャッシュ済みサムネイルを優先、なければオンデマンド生成
            let hbitmap = factory
                .GetImage(size, SIIGBF_THUMBNAILONLY)
                .or_else(|_| factory.GetImage(size, SIIGBF_RESIZETOFIT))
                .map_err(|e| format!("GetImage failed: {e}"))?;

            let hdc = CreateCompatibleDC(None);

            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: THUMB_SIZE as i32,
                    biHeight: -(THUMB_SIZE as i32), // top-down
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };

            // 1回目の呼び出しで実際のビットマップサイズを取得
            GetDIBits(hdc, hbitmap, 0, 0, None, &mut bmi, DIB_RGB_COLORS);
            let width = bmi.bmiHeader.biWidth as u32;
            let height = bmi.bmiHeader.biHeight.unsigned_abs();

            bmi.bmiHeader.biHeight = -(height as i32);
            let buf_size = (width * height * 4) as usize;
            let mut buf: Vec<u8> = vec![0; buf_size];

            let lines = GetDIBits(
                hdc,
                hbitmap,
                0,
                height,
                Some(buf.as_mut_ptr() as *mut _),
                &mut bmi,
                DIB_RGB_COLORS,
            );

            let _ = DeleteDC(hdc);
            let _ = DeleteObject(hbitmap.into());

            if lines == 0 {
                return Err("GetDIBits returned 0 lines".to_string());
            }

            // 非黒色ピクセルのバウンディングボックスを検出してパディングをトリミング
            let mut min_x = width;
            let mut min_y = height;
            let mut max_x: u32 = 0;
            let mut max_y: u32 = 0;

            for y in 0..height {
                for x in 0..width {
                    let idx = ((y * width + x) * 4) as usize;
                    let b = buf[idx];
                    let g = buf[idx + 1];
                    let r = buf[idx + 2];
                    let a = buf[idx + 3];
                    // 閾値2以上のピクセルを「内容あり」と判定（ノイズ除外）
                    if r > 2 || g > 2 || b > 2 || a > 2 {
                        min_x = min_x.min(x);
                        min_y = min_y.min(y);
                        max_x = max_x.max(x);
                        max_y = max_y.max(y);
                    }
                }
            }

            // 内容が見つからなかった場合はビットマップ全体を使用
            if max_x == 0 && max_y == 0 {
                min_x = 0;
                min_y = 0;
                max_x = width - 1;
                max_y = height - 1;
            }

            let crop_w = max_x - min_x + 1;
            let crop_h = max_y - min_y + 1;

            // トリミング済み領域をBGRA→RGB変換
            let mut rgb_buf: Vec<u8> = Vec::with_capacity((crop_w * crop_h * 3) as usize);
            for y in min_y..=max_y {
                for x in min_x..=max_x {
                    let idx = ((y * width + x) * 4) as usize;
                    rgb_buf.push(buf[idx + 2]); // R
                    rgb_buf.push(buf[idx + 1]); // G
                    rgb_buf.push(buf[idx]);     // B
                }
            }

            let rgb_img = RgbImage::from_raw(crop_w, crop_h, rgb_buf)
                .ok_or("Failed to create RGB image from shell data")?;
            save_rgb_jpeg(&rgb_img, out)
        })();

        CoUninitialize();
        result
    }
}
