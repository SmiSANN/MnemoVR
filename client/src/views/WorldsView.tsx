import { useState, useMemo, useCallback } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { useAppStore, type PhotoRecord } from "../store/useAppStore";
import { strings } from "../lib/strings";
import { Lightbox } from "../components/Lightbox";
import { Thumbnail } from "../components/Thumbnail";

type SortKey = "name-asc" | "name-desc" | "date-asc" | "date-desc";

interface WorldGroup {
  worldId: string;
  worldName: string;
  hasResolvedWorldName: boolean;
  count: number;
  latestDate: number;
  photos: PhotoRecord[];
}

const THUMB_COLS = 6;
const ROW_HEIGHT = 128;
const MAX_GRID_HEIGHT = 520;

export function WorldsView() {
  const { photos } = useAppStore();
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lightboxWorld, setLightboxWorld] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState(0);

  const groups = useMemo(() => {
    const map = new Map<string, WorldGroup>();
    for (const p of photos) {
      const wid = p.world_id || "unknown";
      const resolvedName = typeof p.world_name === "string" && p.world_name.trim().length > 0;
      const existing = map.get(wid);
      if (existing) {
        existing.count++;
        existing.photos.push(p);
        if (p.captured_at > existing.latestDate) {
          existing.latestDate = p.captured_at;
        }
        if (resolvedName) {
          existing.hasResolvedWorldName = true;
          if (existing.worldName === existing.worldId || existing.worldName === "unknown") {
            existing.worldName = p.world_name!.trim();
          }
        }
      } else {
        map.set(wid, {
          worldId: wid,
          worldName: resolvedName ? p.world_name!.trim() : wid,
          hasResolvedWorldName: resolvedName,
          count: 1,
          latestDate: p.captured_at,
          photos: [p],
        });
      }
    }

    // 各グループ内の写真を撮影日時の昇順でソート
    for (const group of map.values()) {
      group.photos.sort((a, b) => a.captured_at - b.captured_at);
    }

    const arr = Array.from(map.values());

    arr.sort((a, b) => {
      // 未解決（world_name が1件も無い）グループは常に最下部へ
      const aUnresolved = !a.hasResolvedWorldName;
      const bUnresolved = !b.hasResolvedWorldName;
      if (aUnresolved !== bUnresolved) return aUnresolved ? 1 : -1;

      switch (sortKey) {
        case "name-asc":
          return a.worldName.localeCompare(b.worldName) || a.worldId.localeCompare(b.worldId);
        case "name-desc":
          return b.worldName.localeCompare(a.worldName) || a.worldId.localeCompare(b.worldId);
        case "date-asc":
          return a.latestDate - b.latestDate || a.worldId.localeCompare(b.worldId);
        case "date-desc":
          return b.latestDate - a.latestDate || a.worldId.localeCompare(b.worldId);
        default:
          return 0;
      }
    });
    return arr;
  }, [photos, sortKey]);

  const toggleExpand = useCallback((worldId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(worldId)) next.delete(worldId);
      else next.add(worldId);
      return next;
    });
  }, []);

  const lightboxPhotos = useMemo(() => {
    if (!lightboxWorld) return [];
    const group = groups.find((g) => g.worldId === lightboxWorld);
    return group?.photos || [];
  }, [lightboxWorld, groups]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h2 className="text-xl font-semibold text-white">{strings.worlds.title}</h2>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="bg-slate-800 text-sm text-slate-200 border border-slate-600 rounded px-3 py-1.5"
        >
          <option value="date-desc">{strings.worlds.sortDateDesc}</option>
          <option value="date-asc">{strings.worlds.sortDateAsc}</option>
          <option value="name-asc">{strings.worlds.sortNameAsc}</option>
          <option value="name-desc">{strings.worlds.sortNameDesc}</option>
        </select>
      </div>

      {groups.length > 0 ? (
        <div className="flex-1">
          <Virtuoso
            totalCount={groups.length}
            itemContent={(index) => (
              <WorldAccordion
                key={groups[index].worldId}
                group={groups[index]}
                isExpanded={expanded.has(groups[index].worldId)}
                onToggle={toggleExpand}
                onPhotoClick={(worldId, photoIdx) => {
                  setLightboxWorld(worldId);
                  setLightboxIdx(photoIdx);
                }}
              />
            )}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-300">
          {strings.common.noPhotos}
        </div>
      )}

      {lightboxWorld && lightboxPhotos.length > 0 && (
        <Lightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIdx}
          onClose={() => setLightboxWorld(null)}
          onNavigate={setLightboxIdx}
        />
      )}
    </div>
  );
}

/** サムネイル1行分のコンポーネント（Virtuosoの行レンダラー） */
function PhotoRow({
  photos,
  startIndex,
  worldId,
  onPhotoClick,
}: {
  photos: PhotoRecord[];
  startIndex: number;
  worldId: string;
  onPhotoClick: (worldId: string, photoIdx: number) => void;
}) {
  return (
    <div className="flex gap-2 px-4 pb-2">
      {photos.map((p, i) => (
        <Thumbnail
          key={p.id}
          filePath={p.file_path}
          className="w-[120px] h-[120px] shrink-0 rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-teal-400"
          onClick={() => onPhotoClick(worldId, startIndex + i)}
        />
      ))}
    </div>
  );
}

function WorldAccordion({
  group,
  isExpanded,
  onToggle,
  onPhotoClick,
}: {
  group: WorldGroup;
  isExpanded: boolean;
  onToggle: (worldId: string) => void;
  onPhotoClick: (worldId: string, photoIdx: number) => void;
}) {
  // 写真をTHUMB_COLS列ごとの行に分割
  const rows = useMemo(() => {
    if (!isExpanded) return [];
    const result: { startIndex: number; items: PhotoRecord[] }[] = [];
    for (let i = 0; i < group.photos.length; i += THUMB_COLS) {
      result.push({
        startIndex: i,
        items: group.photos.slice(i, i + THUMB_COLS),
      });
    }
    return result;
  }, [isExpanded, group.photos]);

  const totalRows = rows.length;
  const gridHeight = Math.min(totalRows * ROW_HEIGHT, MAX_GRID_HEIGHT);

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden mb-1 border border-slate-600/30">
      <button
        onClick={() => onToggle(group.worldId)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-300 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
        )}
        <span className="flex-1 text-left text-sm text-white truncate">
          {group.worldName}
        </span>
        <span className="text-xs text-slate-300 bg-slate-700 px-2 py-0.5 rounded-full shrink-0">
          {group.count}枚
        </span>
      </button>

      {isExpanded && (
        <div style={{ height: gridHeight }}>
          <Virtuoso
            totalCount={totalRows}
            fixedItemHeight={ROW_HEIGHT}
            itemContent={(rowIndex) => (
              <PhotoRow
                photos={rows[rowIndex].items}
                startIndex={rows[rowIndex].startIndex}
                worldId={group.worldId}
                onPhotoClick={onPhotoClick}
              />
            )}
          />
        </div>
      )}
    </div>
  );
}
