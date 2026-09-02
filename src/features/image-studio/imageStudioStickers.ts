import stickerManifest from "./stickers.manifest.json";

export type StickerCategory = "faces" | "gestures" | "animals" | "food" | "nature" | "activities" | "symbols";

export interface ImageStudioSticker {
  codepoint: string;
  file: string;
  category: StickerCategory;
  name: { ko: string; en: string };
  bytes: number;
  sha256: string;
}

export const IMAGE_STUDIO_STICKER_VERSION = stickerManifest.version;
export const IMAGE_STUDIO_STICKERS = stickerManifest.assets as ImageStudioSticker[];
export const IMAGE_STUDIO_STICKER_CATEGORIES: StickerCategory[] = ["faces", "gestures", "animals", "food", "nature", "activities", "symbols"];

export function getImageStudioStickerUrl(sticker: ImageStudioSticker) {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}vendor/emoji/${IMAGE_STUDIO_STICKER_VERSION}/${sticker.file}`;
}
