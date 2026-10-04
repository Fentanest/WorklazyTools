import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { renderBanner } from "../../src/features/product-banner/render.ts";
import { createDisplayModel } from "../../src/features/product-banner/displayModel.ts";
import { createDefaultSettings } from "../../src/features/product-banner/settings.ts";
import { DESIGN_IDS, type BannerSettings, type DesignId } from "../../src/features/product-banner/stateTypes.ts";
import { stateWith } from "../fixtures/product-banner/state.ts";
import { buildBannerRuntime } from "../../scripts/product-banner-runtime.mjs";

export const shotDir = process.env.PB_RENDER_SHOT_DIR || "docs/jobs/todo/product-banner/work/shots-T3";
export function hostDocument(runtime: string, designs: readonly DesignId[] = DESIGN_IDS, count = 10, patch: Partial<BannerSettings> = {}) {
  const banners = designs.map((design) => {
    const project = stateWith(count).project, settings = { ...createDefaultSettings("ko", design), ...patch };
    const rendered = renderBanner(createDisplayModel({ ...project, settings }));
    // Host-only local image substitution. Production renderer/URL policy has no localhost escape.
    const markup = rendered.markup.replace(/https:\/\/example\.com\/img\/(\d+)\.jpg/gu, "/img/$1.svg");
    return `<div class="host"><h2>${design}</h2><style>${rendered.css}</style>${markup}</div>`;
  }).join("");
  return `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T3 local renderer host</title><style>body{margin:16px;font-family:system-ui;background:#e7ebf0}.host{width:960px;max-width:100%;margin-bottom:24px}h2{font-size:16px}</style>${banners}<script>${runtime}</script></html>`;
}
export async function startHost(runtime: string) {
  const server = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1"), image = url.pathname.match(/^\/img\/(\d+)\.svg$/u);
    if (image) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect x="28" y="18" width="164" height="124" rx="16" fill="hsl(${Number(image[1])*37} 55% 78%)"/><circle cx="110" cy="72" r="30" fill="white"/><text x="110" y="125" font-family="sans-serif" font-size="18" text-anchor="middle">Product ${image[1]}</text></svg>`);
    } else if (url.pathname === "/missing") { res.writeHead(404).end(); }
    else {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      const designs = (url.searchParams.get("designs")?.split(",") || [...DESIGN_IDS]) as DesignId[];
      res.end(hostDocument(runtime, designs, Number(url.searchParams.get("count") ?? 10), {
        autoPlay: url.searchParams.get("auto") === "true", intervalSeconds: 2,
        theme: url.searchParams.get("theme") === "dark" ? "dark" : "light",
        language: url.searchParams.get("language") === "en" ? "en" : "ko",
        ...Object.fromEntries(["showButton", "showName", "showPrice", "showDiscount"].filter((key) => url.searchParams.has(key)).map((key) => [key, url.searchParams.get(key) === "true"])),
      }));
    }
  });
  // Port 0 asks the OS for an unused port; this harness only closes its own server.
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return { server, url: `http://127.0.0.1:${port}` };
}
if (process.argv.includes("--serve")) {
  const host = await startHost(await buildBannerRuntime());
  await mkdir("docs/jobs/todo/product-banner/work", { recursive: true });
  await writeFile("docs/jobs/todo/product-banner/work/T3-host.json", JSON.stringify({ url: host.url, pid: process.pid }));
  console.log(`T3 local host ${host.url} PID ${process.pid}`);
  process.stdin.on("data", () => host.server.close());
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => host.server.close());
}
