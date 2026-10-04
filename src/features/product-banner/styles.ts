/** Container queries work before JavaScript and use each banner's own width. */
export const bannerCss = `
.wlpb-v1-root{--wlpb-columns:var(--wlpb-count);--wlpb-bg:var(--wlpb-background);--wlpb-fg:var(--wlpb-text);--wlpb-line:var(--wlpb-border);--wlpb-color:var(--wlpb-accent);container-type:inline-size;box-sizing:border-box;width:100%;max-width:var(--wlpb-width);min-width:0;background:var(--wlpb-bg);color:var(--wlpb-fg);border:1px solid var(--wlpb-line);border-radius:12px;font:14px/1.5 system-ui,sans-serif;color-scheme:light}
.wlpb-v1-root[data-wlpb-theme="dark"]{--wlpb-bg:var(--wlpb-dark-background);--wlpb-fg:var(--wlpb-dark-text);--wlpb-line:var(--wlpb-dark-border);--wlpb-color:var(--wlpb-dark-accent);color-scheme:dark}
@media(prefers-color-scheme:dark){.wlpb-v1-root[data-wlpb-theme="auto"]{--wlpb-bg:var(--wlpb-dark-background);--wlpb-fg:var(--wlpb-dark-text);--wlpb-line:var(--wlpb-dark-border);--wlpb-color:var(--wlpb-dark-accent);color-scheme:dark}}
.wlpb-v1-root *{box-sizing:border-box}
.wlpb-v1-root [hidden]{display:none!important}
.wlpb-v1-layout{padding:12px;--wlpb-columns:min(var(--wlpb-count),var(--wlpb-total))}
.wlpb-v1-list{display:flex;gap:12px;overflow-x:auto;list-style:none;margin:0;padding:0;align-items:stretch}
.wlpb-v1-root[data-wlpb-ready="true"] .wlpb-v1-list{touch-action:pan-y}
.wlpb-v1-item{flex:0 0 calc((100% - (var(--wlpb-columns) - 1)*12px)/var(--wlpb-columns));min-width:0;overflow-wrap:anywhere;position:relative}
.wlpb-v1-link{display:flex;flex-direction:column;color:inherit;text-decoration:none;min-width:0;height:100%;gap:8px}
.wlpb-v1-photo{height:var(--wlpb-image-height);display:flex;align-items:center;justify-content:center;border-radius:8px;background:var(--wlpb-bg);overflow:hidden;flex-shrink:0}
.wlpb-v1-img{display:block;width:100%;height:100%;object-fit:contain}
.wlpb-v1-fallback{padding:12px;text-align:center;font-size:12px}
.wlpb-v1-details{display:flex;flex-direction:column;gap:4px;min-width:0}
.wlpb-v1-details:empty{display:none}
.wlpb-v1-name{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.5;max-height:3em}
.wlpb-v1-prices{display:flex;flex-wrap:wrap;gap:4px 8px;font-variant-numeric:tabular-nums}
.wlpb-v1-original{text-decoration:line-through}
.wlpb-v1-discount{font-weight:700;color:var(--wlpb-color)}
.wlpb-v1-link[data-wlpb-cta]{height:auto;margin-top:8px;display:block;color:var(--wlpb-color);text-decoration:underline;padding:8px 0;min-height:44px}
.wlpb-v1-product-card .wlpb-v1-item,.wlpb-v1-grid .wlpb-v1-item{border:1px solid var(--wlpb-line);border-radius:8px;padding:10px;display:flex;flex-direction:column}
.wlpb-v1-product-card .wlpb-v1-link,.wlpb-v1-grid .wlpb-v1-link{flex:1}
.wlpb-v1-product-card .wlpb-v1-name,.wlpb-v1-grid .wlpb-v1-name{height:3em}
.wlpb-v1-slim .wlpb-v1-layout{--wlpb-columns:1}
.wlpb-v1-slim{display:grid;grid-template-columns:minmax(0,1fr) auto}
.wlpb-v1-slim .wlpb-v1-controls{padding:12px;align-content:center}
.wlpb-v1-slim .wlpb-v1-footer{grid-column:1/-1}
.wlpb-v1-slim .wlpb-v1-item,.wlpb-v1-vertical .wlpb-v1-item{display:flex;align-items:center;gap:12px}
.wlpb-v1-slim .wlpb-v1-link,.wlpb-v1-vertical .wlpb-v1-link{flex:1;flex-direction:row;align-items:center;height:auto}
.wlpb-v1-slim .wlpb-v1-photo,.wlpb-v1-vertical .wlpb-v1-photo{width:var(--wlpb-image-height);max-width:35%}
.wlpb-v1-slim .wlpb-v1-link[data-wlpb-cta],.wlpb-v1-vertical .wlpb-v1-link[data-wlpb-cta]{flex:0 1 auto}
.wlpb-v1-vertical .wlpb-v1-list{display:flex;flex-direction:column;overflow:visible}
.wlpb-v1-vertical{max-width:min(var(--wlpb-width),420px)}
.wlpb-v1-vertical .wlpb-v1-item{flex:auto;border-bottom:1px solid var(--wlpb-line);padding-bottom:12px}
.wlpb-v1-grid .wlpb-v1-layout{--wlpb-columns:min(var(--wlpb-grid-columns),var(--wlpb-total))}
.wlpb-v1-grid .wlpb-v1-list{display:grid;grid-template-columns:repeat(var(--wlpb-columns),minmax(0,1fr));overflow:visible}
.wlpb-v1-controls{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:0 12px 12px}
.wlpb-v1-control{background:var(--wlpb-bg);color:var(--wlpb-fg);border:1px solid var(--wlpb-line);border-radius:8px;font:inherit;min-width:44px;min-height:44px;padding:6px 12px;cursor:pointer}
.wlpb-v1-link:focus-visible,.wlpb-v1-source:focus-visible,.wlpb-v1-control:focus-visible{outline:3px solid var(--wlpb-color);outline-offset:2px}
.wlpb-v1-link:focus-visible{outline-offset:-3px}
.wlpb-v1-footer{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 12px;border-top:1px solid var(--wlpb-line);padding:10px 12px;font-size:12px;overflow-wrap:anywhere}
.wlpb-v1-ad{font-weight:700}
.wlpb-v1-notice{flex:1 1 240px}
.wlpb-v1-source{margin-left:auto;color:inherit;text-decoration:underline;text-underline-offset:3px;text-align:right;max-width:100%;padding:4px 0}
@container(max-width:740px){.wlpb-v1-photo-strip .wlpb-v1-layout{--wlpb-columns:min(2,var(--wlpb-count),var(--wlpb-total))}.wlpb-v1-product-card .wlpb-v1-layout{--wlpb-columns:min(2,var(--wlpb-count),var(--wlpb-total))}.wlpb-v1-grid .wlpb-v1-layout{--wlpb-columns:min(2,var(--wlpb-grid-columns),var(--wlpb-total))}}
@container(max-width:440px){.wlpb-v1-photo-strip .wlpb-v1-layout,.wlpb-v1-product-card .wlpb-v1-layout{--wlpb-columns:1}.wlpb-v1-slim .wlpb-v1-layout,.wlpb-v1-slim .wlpb-v1-controls{grid-column:1/-1}.wlpb-v1-slim .wlpb-v1-item{flex-wrap:wrap}.wlpb-v1-slim .wlpb-v1-link[data-wlpb-cta]{flex-basis:100%;margin:0}}
@container(max-width:350px){.wlpb-v1-grid .wlpb-v1-layout{--wlpb-columns:1}}
`;
