import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { bannerDimension, bannerUrlMessages, exportBannerUrl, parseBannerUrl } from "../../src/features/product-banner/bannerUrl.ts";

const example = "https://s.click.aliexpress.com/e/_c3Gv8KKN?bz=300*250";
test("banner URL accepts normalized origins and exact affiliate query bytes", () => {
  for (const input of [example, `  ${example}  `, example.replace("https:", "http:"), example.replace("s.click", "S.CLICK"), example.replace(".com/", ".com:443/")]) {
    assert.deepEqual(parseBannerUrl(input), { ok: true, src: example, size: { width: 300, height: 250 } });
  }
  const src = `${example}&tracking=~%20+%7E%2f&same=1&same=2#fragment`;
  assert.equal((parseBannerUrl(src) as { src: string }).src, src);
  assert.equal((parseBannerUrl(example.split("?")[0] + "#fragment?bz=3*4") as { size: unknown }).size, null);
  assert.equal(parseBannerUrl("").ok, false);
  assert.equal(parseBannerUrl("not a URL").ok, false);
});
test("banner URL rejects unsafe origins, repaired paths, separators, controls and invalid tokens", () => {
  for (const src of [
    "https://evil.example/e/token", "https://s.click.aliexpress.com.evil.example/e/token", "javascript:alert(1)", "data:text/html,test", "ftp://s.click.aliexpress.com/e/token",
    "https://s.click.aliexpress.com:444/e/token", "http://s.click.aliexpress.com:443/e/token", "https://user:pass@s.click.aliexpress.com/e/token",
    "https://s.click.aliexpress.com/e/token/extra", "https://s.click.aliexpress.com/e/token/", "https://s.click.aliexpress.com/e/a%2Fb", "https://s.click.aliexpress.com/e/a%5Cb", "https://s.click.aliexpress.com/e/a%252Fb",
    "https://s.click.aliexpress.com/e/", `https://s.click.aliexpress.com/e/${"a".repeat(65)}`, "https://s.click.aliexpress.com/e/a.b", "https://s.click.aliexpress.com/e/토큰",
    "https://s.click.aliexpress.com/e/a/../b", "https://s.click.aliexpress.com/e/a\\b", `${example}\n`, example.replace("/e/", "/e/\t"), `${example}&x=\u007f`, `${example}&x=\u0085`, `${example}&x=\u009f`,
  ]) assert.equal(parseBannerUrl(src).ok, false, src);
  assert.equal(parseBannerUrl(`https://s.click.aliexpress.com/e/${"a".repeat(64)}`).ok, true);
});
test("banner URL sizes require one bounded bz or explicit integer viewport dimensions", () => {
  const base = example.split("?")[0];
  for (const query of ["", "?bz=", "?bz=3x4", "?bz=3*4&bz=3*4", "?bz=0*250", "?bz=4097*250", "?bz=-3*4", "?bz=3.5*4", "?bz=1e3*4"]) {
    assert.deepEqual(parseBannerUrl(base + query), { ok: true, src: base + query, size: null });
  }
  for (const value of ["", "0", "4097", "1.5", "1e2", "-1", " 300", "Infinity"]) assert.equal(bannerDimension(value), null);
  for (const value of [1, 4096, "300"]) assert.equal(bannerDimension(value), Number(value));
  assert.equal(new JSDOM(exportBannerUrl(example, 728, 90, "en").code).window.document.querySelector("iframe")!.getAttribute("src"), example);
  assert.throws(() => exportBannerUrl(example, 1.5, 250, "en"));
  assert.throws(() => exportBannerUrl("https://evil.example", 300, 250, "en"));
});
test("banner URL output DOM contains only the escaped frame and optional localized ad disclosure", () => {
  const src = `${example}&data=~%20\"'><img src=x onerror=alert(1)>&other='`;
  for (const language of ["ko", "en"] as const) for (const notice of [true, false]) {
    const output = exportBannerUrl(src, 300, 250, language, notice);
    const document = new JSDOM(output.code).window.document, frame = document.querySelector("iframe")!;
    assert.deepEqual([...document.body.children].map((el) => el.tagName), notice ? ["IFRAME", "P"] : ["IFRAME"]);
    assert.equal(frame.getAttribute("src"), src);
    assert.equal(frame.getAttribute("width"), "300"); assert.equal(frame.getAttribute("height"), "250");
    assert.equal(frame.getAttribute("title"), bannerUrlMessages[language].title);
    assert.equal(frame.getAttribute("style"), "border:0"); assert.equal(frame.getAttribute("scrolling"), "no");
    assert.equal(frame.getAttribute("referrerpolicy"), "strict-origin-when-cross-origin");
    assert.equal(frame.hasAttribute("sandbox"), false); assert.equal(frame.hasAttribute("srcdoc"), false);
    assert.equal(document.querySelector("p")?.textContent ?? null, notice ? bannerUrlMessages[language].disclosure : null);
    assert.equal(document.querySelectorAll("script,img").length, 0);
    assert.equal([...document.querySelectorAll("*")].flatMap((el) => el.getAttributeNames()).filter((attr) => /^on/iu.test(attr)).length, 0);
    assert.equal(output.bytes, new TextEncoder().encode(output.code).byteLength);
    assert.match(output.code, /&quot;.*&gt;.*&lt;img/u);
  }
  assert.deepEqual(Object.keys(bannerUrlMessages.ko), Object.keys(bannerUrlMessages.en));
});
