import { useEffect, useRef, useState } from "react";
import { getThumbnail } from "../api";
import { getThumbCacheEntry, setThumbCacheEntry } from "../lib/thumbCache";

interface ThumbnailProps {
  filePath: string;
  className?: string;
  onClick?: () => void;
}

export function Thumbnail({ filePath, className, onClick }: ThumbnailProps) {
  const [src, setSrc] = useState<string | null>(getThumbCacheEntry(filePath) ?? null);
  const ref = useRef<HTMLDivElement>(null);
  const requested = useRef(false);

  useEffect(() => {
    if (src || requested.current) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          requested.current = true;
          getThumbnail(filePath).then((url) => {
            setThumbCacheEntry(filePath, url);
            setSrc(url);
          }).catch(() => {
            // サムネイル生成失敗時はローディング表示のまま（致命的でないため無視）
          });
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [filePath, src]);

  return (
    <div ref={ref} className={`bg-slate-700 ${className ?? ""}`} onClick={onClick}>
      {src ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-contain"
          decoding="async"
        />
      ) : (
        <div className="w-full h-full bg-slate-700 animate-pulse" />
      )}
    </div>
  );
}
