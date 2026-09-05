import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { UtilityField, UtilityInput } from "../../components/UtilitySurface";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
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
    <Card className="editor-tool-group image-sticker-picker gap-2 rounded-xl bg-muted py-[11px] shadow-none ring-0">
      <UtilityField className="image-sticker-search mt-0">
        <span>{t("image.editor.stickerSearch")}</span>
        <UtilityInput
          type="search"
          value={query}
          placeholder={t("image.editor.stickerSearchPlaceholder")}
          aria-label={t("image.editor.stickerSearch")}
          data-testid="image-editor-sticker-search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </UtilityField>
      <div className="image-sticker-categories" role="group" aria-label={t("image.editor.stickerCategories")} data-testid="image-editor-sticker-categories">
        {IMAGE_STUDIO_STICKER_CATEGORIES.map((value) => (
          <Button
            type="button"
            variant="outline"
            className={cn("min-h-8 shrink-0 rounded-full px-2.5 text-[11px] font-bold text-muted-foreground max-[820px]:min-h-11", category === value && !normalizedQuery && "active border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300")}
            aria-pressed={category === value && !normalizedQuery}
            onClick={() => { setCategory(value); setQuery(""); }}
            key={value}
          >
            {t(`image.editor.stickerCategory.${value}`)}
          </Button>
        ))}
      </div>
      <div className="image-sticker-grid" data-testid="image-editor-stickers">
        {stickers.map((sticker) => {
          const name = sticker.name[language];
          return (
            <Button
              type="button"
              variant="outline"
              className="min-h-[54px] min-w-0 rounded-xl p-1.5 hover:border-sky-600 hover:bg-sky-500/10"
              aria-label={t("image.editor.addSticker", { sticker: name })}
              data-codepoint={sticker.codepoint}
              disabled={busy}
              onClick={() => onAddSticker(sticker)}
              key={sticker.codepoint}
            >
              <img src={getImageStudioStickerUrl(sticker)} alt="" width="40" height="40" loading="lazy" decoding="async" />
              <span className="sr-only">{name}</span>
            </Button>
          );
        })}
      </div>
      {!stickers.length && <p className="image-sticker-empty">{t("image.editor.stickerEmpty")}</p>}
      <small className="image-sticker-attribution">
        {t("image.editor.stickerAttribution")} <a href={`/${language}/licenses/`}>{t("image.editor.stickerLicense")}</a>
      </small>
    </Card>
  );
}
