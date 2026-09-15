import { useEffect, useState } from "react";

import { isWorklazyTheme, readAppliedTheme, type WorklazyTheme } from "../theme";

export type HeroFamily = "coral" | "mint";

export function heroFamilyForTheme(theme: WorklazyTheme): HeroFamily {
  return theme.endsWith("mint") ? "mint" : "coral";
}

function readFamily(): HeroFamily {
  if (typeof document === "undefined") return "coral";
  return heroFamilyForTheme(readAppliedTheme());
}

// Tracks the theme family without remounting the app: light/dark of the same
// family keep one source set, a family switch swaps <picture> sources and the
// img srcset together. Storage writes from another tab are picked up too.
export function useThemeFamily(): HeroFamily {
  const [family, setFamily] = useState<HeroFamily>(readFamily);
  useEffect(() => {
    const sync = () => {
      const applied = document.documentElement.getAttribute("data-theme");
      setFamily(heroFamilyForTheme(isWorklazyTheme(applied) ? applied : "light-coral"));
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    window.addEventListener("storage", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("storage", sync);
    };
  }, []);
  return family;
}

const WIDTHS = [480, 960, 1440] as const;
const INTRINSIC_WIDTH = 1672;
const INTRINSIC_HEIGHT = 941;

function assetUrl(family: HeroFamily, width: number, codec: "avif" | "webp"): string {
  return `${import.meta.env.BASE_URL}assets/hero/${family}-${width}.${codec}`;
}

function srcSet(family: HeroFamily, codec: "avif" | "webp"): string {
  return WIDTHS.map((width) => `${assetUrl(family, width, codec)} ${width}w`).join(", ");
}

// Slot math mirrors .home-hero in global.css exactly: stacked full-width
// below 1280px (page width minus main padding minus hero padding minus the
// 2px hero border per breakpoint), fixed 460px slot at and above. A collapsed
// sidebar only affects stacked widths below 1280px; the fixed desktop slot
// is unaffected.
export const HERO_SIZES =
  "(max-width: 620px) calc(100vw - 24px - 44px - 2px), " +
  "(max-width: 820px) calc(100vw - 32px - 56px - 2px), " +
  "(max-width: 1020px) calc(100vw - 250px - 48px - 80px - 2px), " +
  "(max-width: 1279px) calc(100vw - 280px - 64px - 80px - 2px), " +
  "460px";

// Decorative brand art: meaningful copy lives in the hero text, the mint
// asset's Korean brush lettering is source artwork and not translated.
export function HeroPicture() {
  const family = useThemeFamily();
  return (
    <div className="hero-picture" aria-hidden="true">
      <picture>
        <source type="image/avif" srcSet={srcSet(family, "avif")} sizes={HERO_SIZES} />
        <source type="image/webp" srcSet={srcSet(family, "webp")} sizes={HERO_SIZES} />
        <img
          src={assetUrl(family, 960, "webp")}
          srcSet={srcSet(family, "webp")}
          sizes={HERO_SIZES}
          width={INTRINSIC_WIDTH}
          height={INTRINSIC_HEIGHT}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  );
}
