import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getImageStudioStickerUrl,
  IMAGE_STUDIO_STICKER_CATEGORIES,
  IMAGE_STUDIO_STICKERS,
  type ImageStudioSticker,
  type StickerCategory,
} from "./imageStudioStickers";

interface ImageStickerPickerProps {
  busy: boolean;
  onAddSticker: (sticker: ImageStudioSticker) => void;
}

export function ImageStickerPicker({ busy, onAddSticker }: ImageStickerPickerProps) {
  const { t, i18n } = useTranslation("features");
  const [category, setCategory] = useState<StickerCategory>("faces");
  const [query, setQuery] = useState("");
  const language = i18n.resolvedLanguage?.startsWith("ko") ? "ko" : "en";
  const normalizedQuery = query.trim().toLocaleLowerCase(language);
  const stickers = useMemo(() => IMAGE_STUDIO_STICKERS.filter((sticker) => {
    if (!normalizedQuery) return sticker.category === category;
    return `${sticker.name.ko} ${sticker.name.en} ${sticker.codepoint}`.toLocaleLowerCase(language).includes(normalizedQuery);
  }), [category, language, normalizedQuery]);

  return (
    <div className="editor-tool-group image-sticker-picker">
      <label className="image-sticker-search">
        <span>{t("image.editor.stickerSearch")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("image.editor.stickerSearchPlaceholder")}
          aria-label={t("image.editor.stickerSearch")}
          data-testid="image-editor-sticker-search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="image-sticker-categories" role="group" aria-label={t("image.editor.stickerCategories")} data-testid="image-editor-sticker-categories">
        {IMAGE_STUDIO_STICKER_CATEGORIES.map((value) => (
          <button
            type="button"
            className={category === value && !normalizedQuery ? "active" : ""}
            aria-pressed={category === value && !normalizedQuery}
            onClick={() => { setCategory(value); setQuery(""); }}
            key={value}
          >
            {t(`image.editor.stickerCategory.${value}`)}
          </button>
        ))}
      </div>
      <div className="image-sticker-grid" data-testid="image-editor-stickers">
        {stickers.map((sticker) => {
          const name = sticker.name[language];
          return (
            <button
              type="button"
              aria-label={t("image.editor.addSticker", { sticker: name })}
              data-codepoint={sticker.codepoint}
              disabled={busy}
              onClick={() => onAddSticker(sticker)}
              key={sticker.codepoint}
            >
              <img src={getImageStudioStickerUrl(sticker)} alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span className="visually-hidden">{name}</span>
            </button>
          );
        })}
      </div>
      {!stickers.length && <p className="image-sticker-empty">{t("image.editor.stickerEmpty")}</p>}
      <small className="image-sticker-attribution">
        {t("image.editor.stickerAttribution")} <a href={`/${language}/licenses/`}>{t("image.editor.stickerLicense")}</a>
      </small>
    </div>
  );
}
