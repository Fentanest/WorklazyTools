import { escapeHtml, utf8Bytes } from "./serialization.ts";

// These bounds limit the iframe viewport, not the remotely served banner.
export const BANNER_URL_SIZE = { min: 1, max: 4096 } as const;
export const BANNER_URL_PREVIEW_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
export const bannerUrlMessages = {
  ko: {
    method: "입력 방식", file: "파일 가져오기", url: "배너 주소", input: "알리익스프레스 배너 주소", empty: "배너 주소를 붙여넣으세요.",
    invalid: "올바른 배너 주소를 입력하세요.", origin: "https://s.click.aliexpress.com 주소만 사용할 수 있습니다. 다른 도메인·포트·로그인 정보는 허용하지 않습니다.",
    path: "주소 경로는 /e/ 다음에 영문·숫자·밑줄·하이픈 1~64자만 허용합니다. 추가 경로·인코딩된 구분자·제어문자는 사용할 수 없습니다.",
    size: "bz 크기를 확인할 수 없습니다. 너비와 높이를 직접 입력하세요.", sizeRange: "너비와 높이는 1~4096px 사이의 정수로 입력하세요.",
    width: "iframe 너비(px)", height: "iframe 높이(px)", viewport: "크기 변경은 iframe 표시 영역에만 적용됩니다. 주소의 bz와 배너 내부 크기는 바꾸지 않습니다.",
    notice: "광고 고지 포함", disclosure: "광고 · 이 배너를 통한 구매 시 수수료를 받을 수 있습니다.", title: "알리익스프레스 제휴 광고 배너",
    preview: "미리보기", placeholder: "외부 배너를 불러오지 않은 자리 표시 영역입니다.", load: "실제 배너 불러오기", unload: "미리보기 닫기",
    previewHelp: "버튼을 누르면 외부 사이트에 접속합니다. 외부 사이트의 정책이나 연결 상태에 따라 배너 표시가 제한될 수 있습니다.",
    export: "iframe 코드", copy: "iframe 코드 복사", copied: "코드를 복사했습니다.", copyFailed: "복사할 수 없습니다. 아래 코드를 선택해 복사하세요.",
    session: "배너 주소는 편집용 파일에 저장되지 않습니다.",
  },
  en: {
    method: "Input method", file: "Import files", url: "Banner URL", input: "AliExpress banner URL", empty: "Paste a banner URL.",
    invalid: "Enter a valid banner URL.", origin: "Only https://s.click.aliexpress.com is allowed. Other domains, ports and login credentials are not supported.",
    path: "Use /e/ followed by 1–64 letters, digits, underscores or hyphens. Extra paths, encoded separators and control characters are not allowed.",
    size: "No usable bz size was found. Enter the width and height manually.", sizeRange: "Enter whole-number widths and heights from 1 to 4096px.",
    width: "Iframe width (px)", height: "Iframe height (px)", viewport: "Size changes affect only the iframe viewport. They do not change bz in the URL or resize the banner inside it.",
    notice: "Include ad disclosure", disclosure: "Ad · Purchases through this banner may earn a commission.", title: "AliExpress affiliate ad banner",
    preview: "Preview", placeholder: "Placeholder only. The external banner has not been loaded.", load: "Load actual banner", unload: "Close preview",
    previewHelp: "Loading connects to an external site. Its policies or connection status may prevent the banner from displaying.",
    export: "Iframe code", copy: "Copy iframe code", copied: "Code copied.", copyFailed: "Copy failed. Select the code below and copy it manually.",
    session: "Banner URLs are not saved in editing files.",
  },
} as const;
type UrlError = "empty" | "invalid" | "origin" | "path";
export type BannerUrlResult = { ok: true; src: string; size: { width: number; height: number } | null } | { ok: false; error: UrlError };
export function bannerDimension(value: string | number): number | null {
  const raw = String(value);
  if (!/^\d+$/u.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= BANNER_URL_SIZE.min && n <= BANNER_URL_SIZE.max ? n : null;
}
export function parseBannerUrl(input: string): BannerUrlResult {
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(input)) return { ok: false, error: "path" };
  const raw = input.trim();
  if (!raw) return { ok: false, error: "empty" };
  let url: URL;
  try { url = new URL(raw); } catch { return { ok: false, error: "invalid" }; }
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "s.click.aliexpress.com" || url.port || url.username || url.password) return { ok: false, error: "origin" };
  // Inspect the original path too: URL parsing must not silently repair backslashes or dot segments.
  const path = raw.match(/^https?:\/\/[^/?#]+([^?#]*)/iu)?.[1];
  if (!path || !/^\/e\/[A-Za-z0-9_-]{1,64}$/u.test(path) || path !== url.pathname) return { ok: false, error: "path" };
  url.protocol = "https:";
  // Never reserialize searchParams: affiliate encodings (including ~%20) must survive intact.
  const query = raw.split("#", 1)[0].match(/\?.*/u)?.[0] ?? "";
  const sizes = url.searchParams.getAll("bz");
  const match = sizes.length === 1 ? /^(\d+)\*(\d+)$/u.exec(sizes[0]) : null;
  const width = match ? bannerDimension(match[1]) : null, height = match ? bannerDimension(match[2]) : null;
  return { ok: true, src: `${url.origin}${url.pathname}${query}${url.hash}`, size: width && height ? { width, height } : null };
}
export function exportBannerUrl(src: string, width: number, height: number, language: "ko" | "en", disclosure = true) {
  const parsed = parseBannerUrl(src);
  if (!parsed.ok || !bannerDimension(width) || !bannerDimension(height)) throw new Error("INVALID_BANNER_URL");
  const text = bannerUrlMessages[language];
  const code = `<iframe src="${escapeHtml(parsed.src)}" width="${width}" height="${height}" title="${escapeHtml(text.title)}" style="border:0" scrolling="no" referrerpolicy="strict-origin-when-cross-origin"></iframe>${disclosure ? `\n<p>${escapeHtml(text.disclosure)}</p>` : ""}`;
  return { code, bytes: utf8Bytes(code) };
}
