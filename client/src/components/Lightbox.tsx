import { useCallback, useEffect } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Star,
  ExternalLink,
  Link,
  Loader2,
  Check,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppStore, type PhotoRecord } from "../store/useAppStore";
import { getAssetUrl } from "../api";
import { useImageUpload, type UploadStatus } from "../hooks/useImageUpload";
import { UploadWarningDialog } from "./UploadWarningDialog";
import { strings } from "../lib/strings";

interface LightboxProps {
  photos: PhotoRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onPrevBoundary?: () => void;
  onNextBoundary?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

export function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  onPrevBoundary,
  onNextBoundary,
  canGoPrev,
  canGoNext,
}: LightboxProps) {
  const { toggleFavorite } = useAppStore();
  const photo = photos[currentIndex];
  const canNavigatePrev = canGoPrev ?? currentIndex > 0;
  const canNavigateNext = canGoNext ?? currentIndex < photos.length - 1;

  const upload = useImageUpload(photo?.file_path ?? "");

  const goPrev = useCallback(() => {
    if (currentIndex > 0) onNavigate(currentIndex - 1);
    else onPrevBoundary?.();
  }, [currentIndex, onNavigate, onPrevBoundary]);

  const goNext = useCallback(() => {
    if (currentIndex < photos.length - 1) onNavigate(currentIndex + 1);
    else onNextBoundary?.();
  }, [currentIndex, photos.length, onNavigate, onNextBoundary]);

  // キーボードナビゲーション
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, goPrev, goNext]);

  if (!photo) return null;

  const dateStr = new Date(photo.captured_at).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      {upload.showWarning && (
        <UploadWarningDialog
          onConfirm={upload.confirmWarning}
          onCancel={upload.cancelWarning}
        />
      )}

      <div
        className="fixed inset-0 z-50 bg-black/90 flex flex-col"
        onClick={onClose}
      >
        <ActionBar
          isFavorite={photo.is_favorite}
          onToggleFavorite={() => toggleFavorite(photo.id)}
          onClose={onClose}
        />

        <ImageStage
          imgSrc={getAssetUrl(photo.file_path)}
          canNavigatePrev={canNavigatePrev}
          canNavigateNext={canNavigateNext}
          onPrev={goPrev}
          onNext={goNext}
        />

        <MetadataBar
          photo={photo}
          dateStr={dateStr}
          uploadStatus={upload.status}
          onUploadClick={upload.requestUpload}
        />
      </div>
    </>
  );
}

// ─── 上部アクションバー（お気に入り・閉じる） ────────────────────

function ActionBar({
  isFavorite,
  onToggleFavorite,
  onClose,
}: {
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end p-4 gap-2" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={onToggleFavorite}
        className={`p-2 rounded-lg transition-colors ${
          isFavorite
            ? "bg-yellow-500/20 text-yellow-400"
            : "bg-white/10 text-white/60 hover:text-yellow-400"
        }`}
      >
        <Star className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
      </button>
      <button
        onClick={onClose}
        className="p-2 rounded-lg bg-white/10 text-white/60 hover:text-white"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

// ─── 中央画像 + 左右ナビ ─────────────────────────────────────────

function ImageStage({
  imgSrc,
  canNavigatePrev,
  canNavigateNext,
  onPrev,
  onNext,
}: {
  imgSrc: string;
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center relative min-h-0 px-16">
      {canNavigatePrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}

      <img
        src={imgSrc}
        alt=""
        className="max-h-full max-w-full object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {canNavigateNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}

// ─── 下部メタデータバー（パス・日時・ワールド・撮影者・アップロード） ──

function MetadataBar({
  photo,
  dateStr,
  uploadStatus,
  onUploadClick,
}: {
  photo: PhotoRecord;
  dateStr: string;
  uploadStatus: UploadStatus;
  onUploadClick: () => void;
}) {
  function handleLink(e: React.MouseEvent, url: string) {
    e.preventDefault();
    openUrl(url);
  }

  return (
    <div
      className="bg-slate-800/95 border-t border-teal-400/10 px-6 py-3 flex items-center gap-4 text-sm text-slate-200"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-6 gap-y-1">
        <span className="text-slate-300 text-xs truncate max-w-md">{photo.file_path}</span>
        <span>{dateStr}</span>
        {photo.world_id && (
          <a
            href={`https://vrchat.com/home/world/${photo.world_id}`}
            onClick={(e) => handleLink(e, `https://vrchat.com/home/world/${photo.world_id}`)}
            className="flex items-center gap-1 text-teal-400 hover:underline cursor-pointer"
          >
            {photo.world_name || photo.world_id}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
        {photo.user_id && (
          <a
            href={`https://vrchat.com/home/user/${photo.user_id}`}
            onClick={(e) => handleLink(e, `https://vrchat.com/home/user/${photo.user_id}`)}
            className="flex items-center gap-1 text-teal-400 hover:underline cursor-pointer"
          >
            {photo.user_name || photo.user_id}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <UploadButton status={uploadStatus} onClick={onUploadClick} />
    </div>
  );
}

function UploadButton({
  status,
  onClick,
}: {
  status: UploadStatus;
  onClick: () => void;
}) {
  const colorClass =
    status === "copied"
      ? "bg-teal-600/30 text-teal-200 border-teal-500/30"
      : status === "error"
      ? "bg-red-900/40 text-red-200 border-red-500/30"
      : "bg-teal-950/20 hover:bg-teal-900/15 text-teal-200/90 border-teal-400/20 hover:border-teal-400/35";

  return (
    <button
      onClick={onClick}
      disabled={status === "uploading"}
      className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${colorClass}`}
    >
      {status === "uploading" ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : status === "copied" ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Link className="w-3.5 h-3.5" />
      )}
      {status === "uploading"
        ? strings.lightbox.uploading
        : status === "copied"
        ? strings.lightbox.copied
        : status === "error"
        ? strings.lightbox.error
        : strings.lightbox.createImageLink}
    </button>
  );
}
