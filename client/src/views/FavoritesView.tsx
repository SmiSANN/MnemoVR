import { useState, useMemo } from "react";
import { Virtuoso } from "react-virtuoso";
import { useAppStore, type PhotoRecord } from "../store/useAppStore";
import { strings } from "../lib/strings";
import { Lightbox } from "../components/Lightbox";
import { Thumbnail } from "../components/Thumbnail";

const COLS = 6;
const ROW_HEIGHT = 140;

export function FavoritesView() {
  const { photos } = useAppStore();
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const favorites = useMemo(
    () =>
      photos
        .filter((p) => p.is_favorite)
        .sort((a, b) => b.captured_at - a.captured_at),
    [photos]
  );

  const rows = useMemo(() => {
    const result: { startIndex: number; items: PhotoRecord[] }[] = [];
    for (let i = 0; i < favorites.length; i += COLS) {
      result.push({ startIndex: i, items: favorites.slice(i, i + COLS) });
    }
    return result;
  }, [favorites]);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-4">
        {strings.favorites.title}
        <span className="text-sm text-slate-300 ml-2">
          {favorites.length}枚
        </span>
      </h2>

      {rows.length > 0 ? (
        <div className="flex-1">
          <Virtuoso
            totalCount={rows.length}
            fixedItemHeight={ROW_HEIGHT}
            itemContent={(rowIndex) => {
              const row = rows[rowIndex];
              return (
                <div className="flex gap-2 pb-2">
                  {row.items.map((p, i) => (
                    <Thumbnail
                      key={p.id}
                      filePath={p.file_path}
                      className="w-[130px] h-[130px] shrink-0 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-teal-400"
                      onClick={() => setLightboxIdx(row.startIndex + i)}
                    />
                  ))}
                </div>
              );
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-300">
          {strings.favorites.empty}
        </div>
      )}

      {lightboxIdx !== null && (
        <Lightbox
          photos={favorites}
          currentIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </div>
  );
}
