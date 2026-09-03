export const THEME_COLOR_KEYS = [
  "dk1",
  "lt1",
  "dk2",
  "lt2",
  "accent1",
  "accent2",
  "accent3",
  "accent4",
  "accent5",
  "accent6",
  "hlink",
  "folHlink",
] as const;

export type ExcelThemePalette = string[];

interface ThemeColor {
  argb?: string;
  theme?: number;
  tint?: number;
  indexed?: number;
  auto?: boolean;
  [key: string]: unknown;
}

interface ThemeStyle {
  fill?: {
    type?: string;
    pattern?: string;
    fgColor?: ThemeColor;
    bgColor?: ThemeColor;
  };
  font?: { color?: ThemeColor };
  border?: Record<string, { color?: ThemeColor } | undefined>;
}

const XML_PREFIX = "(?:[A-Za-z_][\\w.-]*:)?";

export function parseThemePalette(xml: string): ExcelThemePalette | undefined {
  const scheme = xml.match(new RegExp(`<${XML_PREFIX}clrScheme\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}clrScheme\\s*>`, "i"))?.[1];
  if (!scheme) return undefined;

  const palette = THEME_COLOR_KEYS.map((key) => {
    const section = scheme.match(new RegExp(`<${XML_PREFIX}${key}\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}${key}\\s*>`, "i"))?.[1];
    if (!section) return undefined;
    const srgbTag = section.match(new RegExp(`<${XML_PREFIX}srgbClr\\b[^>]*>`, "i"))?.[0];
    const systemTag = section.match(new RegExp(`<${XML_PREFIX}sysClr\\b[^>]*>`, "i"))?.[0];
    return normalizeRgb(
      srgbTag ? readXmlAttribute(srgbTag, "val") : systemTag ? readXmlAttribute(systemTag, "lastClr") : undefined,
    );
  });

  return palette.every((color): color is string => Boolean(color)) ? palette : undefined;
}

export function applyExcelTint(rgb: string, tint = 0) {
  const normalized = normalizeRgb(rgb);
  if (!normalized) return undefined;
  const amount = Number.isFinite(tint) ? Math.max(-1, Math.min(1, tint)) : 0;
  const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;
  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  if (delta !== 0) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = ((hue * 60) + 360) % 360;
  }

  const adjustedLightness = amount < 0
    ? lightness * (1 + amount)
    : lightness * (1 - amount) + amount;
  const chroma = (1 - Math.abs(2 * adjustedLightness - 1)) * saturation;
  const intermediate = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = adjustedLightness - chroma / 2;
  const [redPrime, greenPrime, bluePrime] = hue < 60
    ? [chroma, intermediate, 0]
    : hue < 120
      ? [intermediate, chroma, 0]
      : hue < 180
        ? [0, chroma, intermediate]
        : hue < 240
          ? [0, intermediate, chroma]
          : hue < 300
            ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];

  return [redPrime, greenPrime, bluePrime]
    .map((channel) => Math.max(0, Math.min(255, Math.round((channel + offset) * 255))).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function bakeThemeColorsInStyle<T>(style: T, palette?: ExcelThemePalette): T {
  if (!palette) return style;
  const model = style as ThemeStyle;
  if (model.fill?.type === "pattern" && model.fill.pattern === "solid") {
    model.fill.fgColor = bakeThemeColor(model.fill.fgColor, palette);
    model.fill.bgColor = bakeThemeColor(model.fill.bgColor, palette);
  }
  if (model.font) model.font.color = bakeThemeColor(model.font.color, palette);
  if (model.border) {
    Object.values(model.border).forEach((edge) => {
      if (edge) edge.color = bakeThemeColor(edge.color, palette);
    });
  }
  return style;
}

function bakeThemeColor(color: ThemeColor | undefined, palette: ExcelThemePalette) {
  if (!color || !Number.isInteger(color.theme)) return color;
  const base = palette[color.theme as number];
  if (!base) return color;
  const rgb = applyExcelTint(base, color.tint);
  if (!rgb) return color;
  const baked = { ...color, argb: `FF${rgb}` };
  delete baked.theme;
  delete baked.tint;
  return baked;
}

function readXmlAttribute(tag: string, name: string) {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
}

function normalizeRgb(value: string | undefined) {
  const normalized = value?.replace(/^#/, "").toUpperCase();
  return normalized && /^[0-9A-F]{6}$/.test(normalized) ? normalized : undefined;
}
