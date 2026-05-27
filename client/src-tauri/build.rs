fn main() {
    // ローカル開発用: .env ファイルをコンパイル時に読み込んで env! マクロで参照できるようにする
    // CI では環境変数が直接設定されているためスキップされる
    if let Ok(contents) = std::fs::read_to_string("../.env") {
        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((key, value)) = line.split_once('=') {
                let key = key.trim();
                let value = value.trim();
                if std::env::var(key).is_err() {
                    println!("cargo:rustc-env={key}={value}");
                }
            }
        }
    }

    tauri_build::build()
}