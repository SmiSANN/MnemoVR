/// Windows Imaging Component (WIC) を使った高速画像デコード・リサイズ。
/// 純 Rust の image クレートより大幅に高速（ネイティブ実装 + ハードウェア支援）。
use windows::{
    Win32::Foundation::GENERIC_ACCESS_RIGHTS,
    Win32::Graphics::Imaging::*,
    Win32::System::Com::*,
    core::{Interface, PCWSTR},
};

pub const RESIZE_MAX_PX: u32 = 2048;

/// 画像ファイルをデコードし、必要であれば RESIZE_MAX_PX 以下にリサイズして
/// 密な RGB24 ピクセルバッファ（R,G,B,R,G,B,...）と出力サイズを返す。
pub fn decode_and_resize(file_path: &str) -> Result<(Vec<u8>, u32, u32), String> {
    unsafe { inner(file_path) }.map_err(|e| e.to_string())
}

unsafe fn inner(file_path: &str) -> windows::core::Result<(Vec<u8>, u32, u32)> {
    let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

    let factory: IWICImagingFactory = CoCreateInstance(
        &CLSID_WICImagingFactory,
        None,
        CLSCTX_INPROC_SERVER,
    )?;

    let path_wide: Vec<u16> = file_path.encode_utf16().chain(Some(0)).collect();
    let decoder = factory.CreateDecoderFromFilename(
        PCWSTR(path_wide.as_ptr()),
        None,
        GENERIC_ACCESS_RIGHTS(0x80000000u32), // GENERIC_READ
        WICDecodeMetadataCacheOnDemand,
    )?;

    let frame = decoder.GetFrame(0)?;

    let mut src_w = 0u32;
    let mut src_h = 0u32;
    frame.GetSize(&mut src_w, &mut src_h)?;

    // ピクセルフォーマットを 24bpp BGR（JPEG エンコード向き）に統一
    let converter = factory.CreateFormatConverter()?;
    converter.Initialize(
        &frame,
        &GUID_WICPixelFormat24bppBGR,
        WICBitmapDitherTypeNone,
        None,
        0.0,
        WICBitmapPaletteTypeMedianCut,
    )?;

    // リサイズが必要な場合はスケーラーを挟む
    let source: IWICBitmapSource =
        if src_w > RESIZE_MAX_PX || src_h > RESIZE_MAX_PX {
            let scale = RESIZE_MAX_PX as f64 / src_w.max(src_h) as f64;
            let dst_w = (src_w as f64 * scale).round() as u32;
            let dst_h = (src_h as f64 * scale).round() as u32;

            let scaler = factory.CreateBitmapScaler()?;
            // Fant フィルター: 高品質かつ WIC ネイティブ実装で高速
            scaler.Initialize(&converter, dst_w, dst_h, WICBitmapInterpolationModeFant)?;
            scaler.cast()?
        } else {
            converter.cast()?
        };

    let mut out_w = 0u32;
    let mut out_h = 0u32;
    source.GetSize(&mut out_w, &mut out_h)?;

    // WIC の CopyPixels は stride を 4 バイトアラインすることを推奨
    let stride = (out_w * 3 + 3) & !3;
    let mut buf = vec![0u8; (stride * out_h) as usize];
    // prc に null を渡すと画像全体をコピー
    source.CopyPixels(std::ptr::null(), stride, &mut buf)?;

    // stride パディングを除去しながら BGR → RGB スワップして密なバッファに
    let row_bytes = out_w as usize * 3;
    let mut rgb = Vec::with_capacity(row_bytes * out_h as usize);
    for row in 0..out_h as usize {
        let src = &mut buf[row * stride as usize..][..row_bytes];
        for px in src.chunks_exact_mut(3) {
            px.swap(0, 2); // B↔R
        }
        rgb.extend_from_slice(src);
    }

    Ok((rgb, out_w, out_h))
}
