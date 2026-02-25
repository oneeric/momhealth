"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Soup } from "lucide-react";

const EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];

/** baseId 對應的實際檔名（支援使用者自訂命名） */
const FILENAME_MAP: Record<string, string[]> = {
  ts1: ["ts1", "TS-1"],
  folina: ["folina", "Folina"],
  creon: ["creon", "Creon"],
  panzolec: ["panzolec", "Panzolec"],
  emetrol: ["emetrol", "EmetroL"],
  traceton: ["traceton", "Traceton"],
  loperam: ["loperam", "Loperam"],
  allegra: ["allegra", "Allegra"],
  xyzal: ["xyzal", "XyzaL"],
  tcm: ["tcm", "TCM", "中藥"],
};

function tryLoadImage(
  basePath: string,
  baseId: string,
  onLoad: (src: string) => void,
  onComplete: () => void
) {
  const nameVariants = FILENAME_MAP[baseId] ?? [baseId];
  let tried = 0;
  const total = nameVariants.length * EXTENSIONS.length;

  const attempt = () => {
    if (tried >= total) {
      onComplete();
      return;
    }
    const nameIdx = Math.floor(tried / EXTENSIONS.length);
    const extIdx = tried % EXTENSIONS.length;
    const filename = nameVariants[nameIdx];
    const ext = EXTENSIONS[extIdx];
    const src = `${basePath}/${filename}${ext}`;
    const img = new Image();
    img.onload = () => onLoad(src);
    img.onerror = () => {
      tried++;
      attempt();
    };
    img.src = src;
  };
  attempt();
}

interface PillImageProps {
  baseId: string;
  fallbackCss?: string;
  hasLine?: boolean;
  size?: "sm" | "md";
  align?: "right" | "left";
}

export default function PillImage({
  baseId,
  fallbackCss = "bg-white border border-gray-300",
  hasLine,
  size = "sm",
  align = "right",
}: PillImageProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setPreviewSrc(null);
    setFullSrc(null);
    let previewDone = false;
    let fullDone = false;

    tryLoadImage("/pills/preview", baseId, setPreviewSrc, () => {
      previewDone = true;
    });
    tryLoadImage("/pills", baseId, setFullSrc, () => {
      fullDone = true;
    });
  }, [baseId]);

  const widthClass = size === "sm" ? "w-20" : "w-24";
  const containerClass =
    align === "right"
      ? `flex-shrink-0 ${widthClass} self-stretch overflow-hidden rounded-r-xl`
      : `flex-shrink-0 ${widthClass} self-stretch overflow-hidden rounded-l-xl`;

  const handleThumbClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (fullSrc || previewSrc) setShowModal(true);
  };

  const closeModal = useCallback(() => setShowModal(false), []);

  useEffect(() => {
    if (!showModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal, closeModal]);

  const modalSrc = fullSrc || previewSrc;

  const isTcm = baseId === "tcm";

  const content = isTcm ? (
    <div
      className={`h-full min-h-[4rem] w-full flex items-center justify-center bg-amber-50 ${align === "right" ? "rounded-r-xl" : "rounded-l-xl"}`}
    >
      <Soup className="w-10 h-10 text-amber-600" />
    </div>
  ) : previewSrc || fullSrc ? (
    <img
      src={previewSrc || fullSrc || ""}
      alt={baseId}
      className={`h-full w-full object-cover bg-white cursor-zoom-in ${align === "right" ? "rounded-r-xl" : "rounded-l-xl"}`}
      onClick={handleThumbClick}
    />
  ) : (
    <div
      className={`h-full min-h-[4rem] w-full flex items-center justify-center ${fallbackCss} ${hasLine ? "relative" : ""} ${align === "right" ? "rounded-r-xl" : "rounded-l-xl"}`}
    >
      {hasLine && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-full h-px bg-slate-400" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={containerClass}>{content}</div>
      {showModal &&
        modalSrc &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) closeModal();
            }}
            role="dialog"
            aria-modal="true"
          >
            <img
              src={modalSrc}
              alt={baseId}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl pointer-events-none"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeModal();
              }}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white bg-white/20 rounded-full hover:bg-white/30 text-xl cursor-pointer z-10"
              aria-label="關閉"
            >
              ✕
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
