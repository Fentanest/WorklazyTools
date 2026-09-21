import assert from "node:assert/strict";

// AdSense stub + fail-closed network firewall for ad-eligibility smoke tests.
// Only the exact production AdSense script URL is ever stubbed. Every other
// external HTTP(S) request (including analytics) is aborted. Local test-server
// origins are continued. External requests are never continued, so the
// "actually allowed" counter stays 0 by construction.

export const ADSENSE_CLIENT = "ca-pub-8940087269746960";
export const ADSENSE_SCRIPT_URL =
  `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
export const ANALYTICS_HOSTS = new Set([
  "www.googletagmanager.com",
  "wcs.pstatic.net",
]);

export function stubScriptBody() {
  return [
    "(function () {",
    "  var state = (window.__wlAdStub = window.__wlAdStub || { loads: 0, pushes: 0, initTime: Date.now(), adSlots: [] });",
    "  state.loads += 1;",
    "",
    "  // Simulate automatic ad container creation (residual DOM effects).",
    "  var container = document.createElement('div');",
    "  container.id = '__wl_ad_stub_container_' + state.loads;",
    "  container.className = 'wl-ad-stub-marker';",
    "  container.style.display = 'none';",
    "  container.setAttribute('data-wl-stub', 'init-' + state.initTime);",
    "  document.documentElement.appendChild(container);",
    "  state.adSlots.push(container.id);",
    "",
    "  // Simulate AdSense queue and callback registry.",
    "  var queue = (window.adsbygoogle = window.adsbygoogle || []);",
    "  if (typeof queue.push !== \"function\" || String(queue.push).indexOf(\"__wlAdStub\") === -1) {",
    "    queue.push = function __wlAdStub() { ",
    "      state.pushes += 1; ",
    "      // Simulate processing ad units (residual callback effects).",
    "      if (arguments.length > 0 && typeof arguments[0] === 'object') {",
    "        state.lastAdRequest = { time: Date.now(), args: String(arguments[0]).slice(0, 100) };",
    "      }",
    "      return 0; ",
    "    };",
    "  }",
    "",
    "  // Simulate auto-process on queue (residual side effect).",
    "  if (queue.length === 0) {",
    "    queue.push({ google_ad_client: 'ca-pub-8940087269746960' });",
    "  }",
    "})();",
    "",
  ].join("\n");
}

export function createCounters() {
  return {
    attempt: 0, // requests to the exact AdSense script URL
    stub: 0, // attempts answered with the local stub
    blocked: 0, // external requests aborted (all non-stub external)
    blockedAnalytics: 0, // subset: googletagmanager.com / wcs.pstatic.net
    allowedExternal: 0, // external requests continued (must stay 0)
    log: [], // { time, url, disposition, analytics? }
  };
}

function isAnalytics(url) {
  try {
    return ANALYTICS_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function installAdFirewall(context, serverOrigin, counters, { stub = true } = {}) {
  const origin = new URL(serverOrigin).origin;
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = request.url();
    let protocol = "";
    let requestOrigin = "";
    try {
      const parsed = new URL(url);
      protocol = parsed.protocol;
      requestOrigin = parsed.origin;
    } catch {
      await route.continue();
      return;
    }
    if (protocol !== "http:" && protocol !== "https:") {
      await route.continue();
      return;
    }
    if (url === ADSENSE_SCRIPT_URL) {
      counters.attempt += 1;
      if (stub) {
        counters.stub += 1;
        counters.log.push({ time: new Date().toISOString(), url, disposition: "stub" });
        await route.fulfill({
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
          body: stubScriptBody(),
        });
      } else {
        counters.blocked += 1;
        counters.log.push({ time: new Date().toISOString(), url, disposition: "blocked-no-stub" });
        await route.abort();
      }
      return;
    }
    if (requestOrigin === origin) {
      await route.continue();
      return;
    }
    const analytics = isAnalytics(url);
    counters.blocked += 1;
    if (analytics) counters.blockedAnalytics += 1;
    counters.log.push({ time: new Date().toISOString(), url, disposition: "blocked", analytics });
    await route.abort();
  });
}

export function assertNoRealNetwork(counters, scenario) {
  assert.equal(
    counters.allowedExternal,
    0,
    `${scenario}: external requests were continued (real network allowed)`,
  );
}
