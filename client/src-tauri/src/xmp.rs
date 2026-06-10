use quick_xml::events::Event;
use quick_xml::Reader;

/// VRChatが写真PNGに埋め込むXMPメタデータ
#[derive(Debug, Default)]
pub struct VrcMetadata {
    pub world_id: Option<String>,
    pub world_name: Option<String>,
    pub author_id: Option<String>,
    pub author_name: Option<String>,
    pub create_date: Option<String>,
}

/// XMP 探索に使う先頭チャンクサイズ。VRChat の XMP はファイル前方に埋め込まれるため、
/// まずここだけ読み、見つからなければ残りを読むフォールバック方式にする。
const XMP_FIRST_CHUNK: usize = 256 * 1024;
const XMP_START_MARKER: &[u8] = b"<x:xmpmeta";
const XMP_END_MARKER: &[u8] = b"</x:xmpmeta>";

/// PNGファイルからXMPメタデータを抽出する。
/// VRChatはPNGのtEXt/iTXtチャンクに <x:xmpmeta> 形式でXMPを埋め込んでいる。
/// 画像全体（数MB）を読まずに、まず先頭チャンクのみを読んで高速化する。
pub fn extract_xmp_from_png(file_path: &str) -> Result<VrcMetadata, String> {
    use std::io::Read;

    let mut file = std::fs::File::open(file_path).map_err(|e| format!("Failed to open file: {e}"))?;

    // まず先頭チャンクだけ読む
    let mut data = Vec::with_capacity(XMP_FIRST_CHUNK);
    file.by_ref()
        .take(XMP_FIRST_CHUNK as u64)
        .read_to_end(&mut data)
        .map_err(|e| format!("Failed to read file: {e}"))?;

    // 先頭チャンクに XMP 終端が無ければ残りも読み込む（フォールバック）
    if find_subsequence(&data, XMP_END_MARKER).is_none() {
        file.read_to_end(&mut data)
            .map_err(|e| format!("Failed to read file: {e}"))?;
    }

    let xmp_xml = find_subsequence(&data, XMP_START_MARKER)
        .and_then(|start| {
            find_subsequence(&data[start..], XMP_END_MARKER)
                .map(|end| &data[start..start + end + XMP_END_MARKER.len()])
        })
        .ok_or("No XMP metadata found in file")?;

    let xml_str = std::str::from_utf8(xmp_xml).map_err(|e| format!("Invalid UTF-8 in XMP: {e}"))?;
    parse_xmp(xml_str)
}

/// バイト列から部分列の位置を検索
fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack
        .windows(needle.len())
        .position(|window| window == needle)
}

/// XMP XMLをパースしてVRChat固有のメタデータを抽出する。
/// タグ名で値を判別: vrc:WorldID, vrc:WorldDisplayName, vrc:AuthorID, xmp:Author, xmp:CreateDate
fn parse_xmp(xml: &str) -> Result<VrcMetadata, String> {
    let mut reader = Reader::from_str(xml);
    let mut metadata = VrcMetadata::default();
    let mut current_tag = String::new();
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) | Ok(Event::Empty(ref e)) => {
                let name = String::from_utf8_lossy(e.name().as_ref()).to_string();
                current_tag = name;
            }
            Ok(Event::Text(ref e)) => {
                let text = e.unescape().unwrap_or_default().to_string();
                if text.trim().is_empty() {
                    continue;
                }
                match current_tag.as_str() {
                    "vrc:WorldID" => metadata.world_id = Some(text),
                    "vrc:WorldDisplayName" => metadata.world_name = Some(text),
                    "vrc:AuthorID" => metadata.author_id = Some(text),
                    "xmp:Author" => metadata.author_name = Some(text),
                    "xmp:CreateDate" => metadata.create_date = Some(text),
                    _ => {}
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("XML parse error: {e}")),
            _ => {}
        }
        buf.clear();
    }

    Ok(metadata)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_xmp() {
        let xml = r#"<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
    <rdf:Description>
      <xmp:CreatorTool>VRChat</xmp:CreatorTool>
      <xmp:Author>TestUser</xmp:Author>
      <xmp:CreateDate>2026-02-16T13:44:43.5227567+09:00</xmp:CreateDate>
    </rdf:Description>
    <rdf:Description xmlns:vrc="http://ns.vrchat.com/vrc/1.0/">
      <vrc:WorldID>wrld_f5f8b3dc-6f33-4b34-97f3-83add2fb224d</vrc:WorldID>
      <vrc:WorldDisplayName>Test World</vrc:WorldDisplayName>
      <vrc:AuthorID>usr_65b82ae3-eb0d-4cba-8a58-7dfadbd41fc5</vrc:AuthorID>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>"#;

        let meta = parse_xmp(xml).unwrap();
        assert_eq!(meta.world_id.unwrap(), "wrld_f5f8b3dc-6f33-4b34-97f3-83add2fb224d");
        assert_eq!(meta.world_name.unwrap(), "Test World");
        assert_eq!(meta.author_id.unwrap(), "usr_65b82ae3-eb0d-4cba-8a58-7dfadbd41fc5");
        assert_eq!(meta.author_name.unwrap(), "TestUser");
    }
}
