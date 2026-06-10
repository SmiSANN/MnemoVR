import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { useAppStore, type PhotoRecord } from "../store/useAppStore";
import { strings } from "../lib/strings";
import { Lightbox } from "../components/Lightbox";
import { Thumbnail } from "../components/Thumbnail";

type ViewMode = "month" | "year";

const TILE_COLS = 6;
const ROW_HEIGHT = 140;
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

/** 日付ミリ秒を YYYY-MM-DD 文字列に変換。 */
function toDateKey(millis: number): string {
  const d = new Date(millis);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatSelectedDay(key: string): string {
  const [y, m, d] = key.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function CalendarView() {
  const { photos } = useAppStore();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // 日付別の写真枚数集計とヒートマップの最大値
  const photosByDate = useMemo(() => {
    const map = new Map<string, number>();
    photos.forEach((p) => {
      const key = toDateKey(p.captured_at);
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [photos]);
  const maxCount = useMemo(() => {
    // 大量データでも安全なよう、スプレッド（引数上限）ではなくループで最大値を求める
    let m = 1;
    for (const v of photosByDate.values()) if (v > m) m = v;
    return m;
  }, [photosByDate]);

  // 写真がある日付のソート済みリスト（日付間ナビゲーション用）
  const sortedPhotoDates = useMemo(
    () => Array.from(photosByDate.keys()).sort(),
    [photosByDate],
  );
  const prevPhotoDay = neighborDay(sortedPhotoDates, selectedDay, -1);
  const nextPhotoDay = neighborDay(sortedPhotoDates, selectedDay, +1);

  // 写真の撮影日から年月の上下限を算出（ナビゲーション範囲の制限用）
  const range = useMemo(() => computeDateRange(photos), [photos]);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const canGoBack =
    viewMode === "month"
      ? new Date(year, month - 1, 1) >= range.minMonth
      : year - 1 >= range.minYear;
  const canGoForward =
    viewMode === "month"
      ? new Date(year, month + 1, 1) <= range.maxMonth
      : year + 1 <= range.maxYear;
  const canGoToday = useMemo(() => {
    const today = new Date();
    const todayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return todayMonth >= range.minMonth && todayMonth <= range.maxMonth;
  }, [range]);

  // 選択日の写真とタイル行
  const photosForDay = useMemo(() => {
    if (!selectedDay) return [];
    return photos
      .filter((p) => toDateKey(p.captured_at) === selectedDay)
      .sort((a, b) => a.captured_at - b.captured_at);
  }, [selectedDay, photos]);

  const tileRows = useMemo(() => {
    const result: { startIndex: number; items: PhotoRecord[] }[] = [];
    for (let i = 0; i < photosForDay.length; i += TILE_COLS) {
      result.push({ startIndex: i, items: photosForDay.slice(i, i + TILE_COLS) });
    }
    return result;
  }, [photosForDay]);

  function navigateToDay(
    dateKey: string,
    options?: { keepLightboxOpen?: boolean; lightboxIndex?: number },
  ) {
    setSelectedDay(dateKey);
    setLightboxIdx(options?.keepLightboxOpen ? options.lightboxIndex ?? 0 : null);
    const [y, m] = dateKey.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, 1));
  }

  function handleSelectDay(dateKey: string) {
    setSelectedDay(dateKey);
    setLightboxIdx(null);
  }

  function handleLightboxPrevBoundary() {
    if (!prevPhotoDay) return;
    const prevCount = photosByDate.get(prevPhotoDay) ?? 0;
    if (prevCount <= 0) return;
    navigateToDay(prevPhotoDay, { keepLightboxOpen: true, lightboxIndex: prevCount - 1 });
  }
  function handleLightboxNextBoundary() {
    if (!nextPhotoDay) return;
    navigateToDay(nextPhotoDay, { keepLightboxOpen: true, lightboxIndex: 0 });
  }

  return (
    <div className="h-full flex flex-col">
      <CalendarNavHeader
        viewMode={viewMode}
        year={year}
        month={month}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        canGoToday={canGoToday}
        range={range}
        onPrev={() => {
          if (viewMode === "month") {
            setCurrentDate(new Date(year, month - 1, 1));
            setSelectedDay(null);
          } else {
            setCurrentDate(new Date(year - 1, month, 1));
          }
        }}
        onNext={() => {
          if (viewMode === "month") {
            setCurrentDate(new Date(year, month + 1, 1));
            setSelectedDay(null);
          } else {
            setCurrentDate(new Date(year + 1, month, 1));
          }
        }}
        onToday={() => {
          setCurrentDate(new Date());
          setSelectedDay(null);
        }}
        onYearSelect={(newYear) => {
          let newMonth = month;
          if (newYear === range.minYear && newMonth < range.minMonth.getMonth()) {
            newMonth = range.minMonth.getMonth();
          }
          if (newYear === range.maxYear && newMonth > range.maxMonth.getMonth()) {
            newMonth = range.maxMonth.getMonth();
          }
          setCurrentDate(new Date(newYear, newMonth, 1));
          setSelectedDay(null);
        }}
        onViewModeChange={setViewMode}
      />

      {viewMode === "month" ? (
        <div className="bg-slate-800 rounded-xl p-4 shrink-0 border border-slate-600/30">
          <MonthGrid
            year={year}
            month={month}
            clickable
            photosByDate={photosByDate}
            maxCount={maxCount}
            selectedDay={selectedDay}
            onSelect={handleSelectDay}
          />
        </div>
      ) : (
        <YearView
          year={year}
          range={range}
          photosByDate={photosByDate}
          maxCount={maxCount}
          selectedDay={selectedDay}
          onSelectMonth={(y, m) => {
            setCurrentDate(new Date(y, m, 1));
            setViewMode("month");
            setSelectedDay(null);
          }}
        />
      )}

      {viewMode === "month" && selectedDay && photosForDay.length > 0 && (
        <SelectedDayPanel
          selectedDay={selectedDay}
          photoCount={photosForDay.length}
          prevPhotoDay={prevPhotoDay}
          nextPhotoDay={nextPhotoDay}
          tileRows={tileRows}
          onNavigateDay={(d) => navigateToDay(d)}
          onOpenLightbox={setLightboxIdx}
        />
      )}

      {lightboxIdx !== null && photosForDay.length > 0 && (
        <Lightbox
          photos={photosForDay}
          currentIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNavigate={setLightboxIdx}
          canGoPrev={lightboxIdx > 0 || !!prevPhotoDay}
          canGoNext={lightboxIdx < photosForDay.length - 1 || !!nextPhotoDay}
          onPrevBoundary={handleLightboxPrevBoundary}
          onNextBoundary={handleLightboxNextBoundary}
        />
      )}
    </div>
  );
}

// ─── ヘッダー（前後ナビ + 年選択 + 月/年トグル） ─────────────────

interface DateRange {
  minMonth: Date;
  maxMonth: Date;
  minYear: number;
  maxYear: number;
}

function CalendarNavHeader({
  viewMode,
  year,
  month,
  canGoBack,
  canGoForward,
  canGoToday,
  range,
  onPrev,
  onNext,
  onToday,
  onYearSelect,
  onViewModeChange,
}: {
  viewMode: ViewMode;
  year: number;
  month: number;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoToday: boolean;
  range: DateRange;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onYearSelect: (year: number) => void;
  onViewModeChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4 shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!canGoBack}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-white min-w-32 text-center">
          {viewMode === "month" ? `${year}年 ${month + 1}月` : `${year}年`}
        </h2>
        <button
          onClick={onNext}
          disabled={!canGoForward}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {viewMode === "month" && (
          <button
            onClick={onToday}
            disabled={!canGoToday}
            className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {strings.calendar.today}
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        {viewMode === "month" && (
          <select
            value={year}
            onChange={(e) => onYearSelect(Number(e.target.value))}
            className="bg-slate-800 text-sm text-slate-200 border border-slate-600 rounded px-2 py-1.5"
          >
            {Array.from({ length: range.maxYear - range.minYear + 1 }, (_, i) => {
              const y = range.minYear + i;
              return (
                <option key={y} value={y}>
                  {y}年
                </option>
              );
            })}
          </select>
        )}
        <div className="flex bg-slate-800 rounded-lg overflow-hidden">
          <ToggleButton
            active={viewMode === "month"}
            onClick={() => onViewModeChange("month")}
            label="月"
          />
          <ToggleButton
            active={viewMode === "year"}
            onClick={() => onViewModeChange("year")}
            label="年"
          />
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 text-sm ${
        active ? "bg-teal-500 text-white" : "text-slate-300 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

// ─── 年表示（12 個の小さい月グリッド） ──────────────────────────

function YearView({
  year,
  range,
  photosByDate,
  maxCount,
  selectedDay,
  onSelectMonth,
}: {
  year: number;
  range: DateRange;
  photosByDate: Map<string, number>;
  maxCount: number;
  selectedDay: string | null;
  onSelectMonth: (year: number, month: number) => void;
}) {
  function isOutOfRange(m: number): boolean {
    const target = new Date(year, m, 1);
    return target < range.minMonth || target > range.maxMonth;
  }

  return (
    <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, i) => {
        const outOfRange = isOutOfRange(i);
        return (
          <div
            key={i}
            onClick={() => !outOfRange && onSelectMonth(year, i)}
            className={`bg-slate-800 rounded-xl p-3 transition-all border border-slate-600/30 ${
              outOfRange ? "opacity-30 cursor-not-allowed" : "cursor-pointer hover:bg-teal-400/5 hover:border-teal-400/20"
            }`}
          >
            <h3 className="text-sm font-medium text-slate-200 mb-2">{i + 1}月</h3>
            <MonthGrid
              year={year}
              month={i}
              clickable={false}
              photosByDate={photosByDate}
              maxCount={maxCount}
              selectedDay={selectedDay}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── 月グリッド本体（クリック可能・表示専用の両方に対応） ───────

function MonthGrid({
  year,
  month,
  clickable,
  photosByDate,
  maxCount,
  selectedDay,
  onSelect,
}: {
  year: number;
  month: number;
  clickable: boolean;
  photosByDate: Map<string, number>;
  maxCount: number;
  selectedDay: string | null;
  onSelect?: (dateKey: string) => void;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cellH = clickable ? "h-12" : "h-6";

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`empty-${i}`} className={cellH} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const count = photosByDate.get(dateKey) ?? 0;
    const isToday =
      year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
    const isSelected = dateKey === selectedDay;
    const bg = heatColor(count, maxCount);
    const textColors = heatTextColors(count, maxCount);

    cells.push(
      <div
        key={day}
        onClick={() => clickable && count > 0 && onSelect?.(dateKey)}
        className={`relative flex flex-col items-center justify-center rounded text-xs
          ${cellH}
          ${count > 0 && clickable ? "cursor-pointer hover:ring-1 hover:ring-teal-400" : ""}
          ${isToday ? "ring-1 ring-teal-400" : ""}
          ${isSelected ? "ring-2 ring-teal-300" : ""}
        `}
        style={bg ? { backgroundColor: bg } : undefined}
      >
        <span className={isToday ? `font-bold ${textColors.day}` : textColors.day}>{day}</span>
        {clickable && count > 0 && <span className={`text-[10px] ${textColors.count}`}>{count}</span>}
      </div>,
    );
  }

  // 常に 6 行 × 7 列 = 42 セルにパディング（カレンダー高さの安定化）
  while (cells.length < 42) {
    cells.push(<div key={`pad-${cells.length}`} className={cellH} />);
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-[10px] text-slate-300">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">{cells}</div>
    </div>
  );
}

// ─── 選択日の写真タイルパネル ────────────────────────────────────

function SelectedDayPanel({
  selectedDay,
  photoCount,
  prevPhotoDay,
  nextPhotoDay,
  tileRows,
  onNavigateDay,
  onOpenLightbox,
}: {
  selectedDay: string;
  photoCount: number;
  prevPhotoDay: string | null;
  nextPhotoDay: string | null;
  tileRows: { startIndex: number; items: PhotoRecord[] }[];
  onNavigateDay: (dateKey: string) => void;
  onOpenLightbox: (idx: number) => void;
}) {
  return (
    <div className="mt-4 flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <button
          onClick={() => prevPhotoDay && onNavigateDay(prevPhotoDay)}
          disabled={!prevPhotoDay}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-white">
          {formatSelectedDay(selectedDay)}
          <span className="text-sm text-slate-300 ml-2">{photoCount}枚</span>
        </h3>
        <button
          onClick={() => nextPhotoDay && onNavigateDay(nextPhotoDay)}
          disabled={!nextPhotoDay}
          className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1">
        <Virtuoso
          totalCount={tileRows.length}
          fixedItemHeight={ROW_HEIGHT}
          itemContent={(rowIndex) => {
            const row = tileRows[rowIndex];
            return (
              <div className="flex gap-2 pb-2">
                {row.items.map((p, i) => (
                  <Thumbnail
                    key={p.id}
                    filePath={p.file_path}
                    className="w-[130px] h-[130px] shrink-0 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-teal-400"
                    onClick={() => onOpenLightbox(row.startIndex + i)}
                  />
                ))}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

// ─── ヘルパー ────────────────────────────────────────────────────

function heatColor(count: number, maxCount: number): string {
  if (count === 0) return "";
  const t = Math.min(count / maxCount, 1);
  const r = Math.round(60 * Math.pow(t, 2));
  const g = Math.round(180 + 50 * t);
  const b = 240;
  const a = 0.15 + t * 0.7;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function heatTextColors(count: number, maxCount: number): { day: string; count: string } {
  if (count === 0) return { day: "text-slate-400", count: "text-teal-300" };
  const t = Math.min(count / maxCount, 1);
  const r = 60 * Math.pow(t, 2);
  const g = 180 + 50 * t;
  const b = 240;
  const a = 0.15 + t * 0.7;
  // ベース色 #0C1421 (12, 20, 33) と合成して知覚輝度を計算
  const br = r * a + 12 * (1 - a);
  const bg = g * a + 20 * (1 - a);
  const bb = b * a + 33 * (1 - a);
  const brightness = 0.299 * br + 0.587 * bg + 0.114 * bb;
  if (brightness > 100) {
    return { day: "text-slate-900", count: "text-slate-700" };
  }
  return { day: "text-slate-200", count: "text-teal-300" };
}

function neighborDay(
  sortedDates: string[],
  currentDay: string | null,
  delta: -1 | 1,
): string | null {
  if (!currentDay) return null;
  const idx = sortedDates.indexOf(currentDay);
  if (idx < 0) return null;
  const target = idx + delta;
  if (target < 0 || target >= sortedDates.length) return null;
  return sortedDates[target];
}

function computeDateRange(photos: PhotoRecord[]): DateRange {
  if (photos.length === 0) {
    const now = new Date();
    const m = new Date(now.getFullYear(), now.getMonth(), 1);
    return { minMonth: m, maxMonth: m, minYear: m.getFullYear(), maxYear: m.getFullYear() };
  }
  // 大量データでスタックあふれしないよう、スプレッドではなくループで最小・最大を求める
  let minTs = photos[0].captured_at;
  let maxTs = photos[0].captured_at;
  for (const p of photos) {
    if (p.captured_at < minTs) minTs = p.captured_at;
    if (p.captured_at > maxTs) maxTs = p.captured_at;
  }
  const minD = new Date(minTs);
  const maxD = new Date(maxTs);
  return {
    minMonth: new Date(minD.getFullYear(), minD.getMonth(), 1),
    maxMonth: new Date(maxD.getFullYear(), maxD.getMonth(), 1),
    minYear: minD.getFullYear(),
    maxYear: maxD.getFullYear(),
  };
}
