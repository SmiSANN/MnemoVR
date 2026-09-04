fn main() {
    // .env の作成・編集後にビルドスクリプトを再実行させる。
    // これがないと cargo がキャッシュした出力を使い回し、
    // .env を後から用意しても env! が「not defined at compile time」で失敗する。
    println!("cargo:rerun-if-changed=../.env");

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