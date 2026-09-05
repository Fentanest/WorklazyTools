import { availableToolRoutes } from "./tool-registry-routes.mjs";

const profile = (locale, theme, viewport) => Object.freeze({ locale, theme, viewport });

const koLightDesktop = profile("ko", "light", "desktop");
const koLightMobile = profile("ko", "light", "mobile");
const koDarkDesktop = profile("ko", "dark", "desktop");
const koDarkMobile = profile("ko", "dark", "mobile");
const enLightDesktop = profile("en", "light", "desktop");
const enLightMobile = profile("en", "light", "mobile");
const enDarkDesktop = profile("en", "dark", "desktop");
const enDarkMobile = profile("en", "dark", "mobile");

const fullProfiles = Object.freeze([
  koLightDesktop,
  koLightMobile,
  koDarkDesktop,
  koDarkMobile,
  enLightDesktop,
  enLightMobile,
  enDarkDesktop,
  enDarkMobile,
]);

const representativeProfiles = Object.freeze([
  koLightDesktop,
  koDarkMobile,
  enLightMobile,
  enDarkDesktop,
]);

const mobileBottomProfiles = Object.freeze([koDarkMobile, enLightMobile]);
const koreanOnlyProfiles = Object.freeze([koLightDesktop, koDarkMobile]);
const koreanOnlyBottomProfiles = Object.freeze([koDarkMobile]);
const englishRedirectProfiles = Object.freeze([enLightMobile, enDarkDesktop]);
const interactionProfiles = Object.freeze([enDarkDesktop]);
const koreanInteractionProfiles = Object.freeze([koLightDesktop]);
const migratedToolIds = new Set([
  "text-formatter",
  "work-calculator",
  "payroll-calculator",
  "security-tools",
  "image-privacy",
  "text-tools",
  "data-converter",
  "timezone-calculator",
  "text-merger",
  "hwp-editor",
  "office-editor",
  "document-compare",
  "excel-cleaner",
  "excel-merger",
  "excel-compare",
  "qr-studio",
  "audio-studio",
  "pdf-editor",
]);

const DEFAULT_READY_SELECTOR = ".page:not(.tool-route-loading)";
const DEFAULT_BOTTOM_TARGET_SELECTOR = ".tool-page > :last-child";
const HWP_ENGLISH_NA_REASON = "The HWP editor is intentionally Korean-only; its English URL redirects to /en/tools and is recorded as a separate redirect scenario.";

const scenario = (definition) => Object.freeze({
  fixture: null,
  actions: Object.freeze([]),
  readySelector: DEFAULT_READY_SELECTOR,
  assertSelector: DEFAULT_READY_SELECTOR,
  bottomTargetSelector: null,
  localeNotApplicableReason: null,
  ...definition,
  profiles: Object.freeze([...definition.profiles]),
  actions: Object.freeze([...(definition.actions ?? [])].map((action) => Object.freeze(action))),
});

const indexScenarios = [
  scenario({
    scenarioId: "home-default--initial",
    routeId: "home-default",
    stateId: "initial",
    stateType: "initial",
    path: "/",
    kind: "index",
    profiles: fullProfiles,
    profileReductionReason: "No reduction: the shared landing surface keeps the full locale, theme, and viewport product.",
    readySelector: ".home-page .hero",
    assertSelector: ".home-page .hero",
  }),
  scenario({
    scenarioId: "tools-media-filter--initial",
    routeId: "tools-media-filter",
    stateId: "initial",
    stateType: "initial",
    path: "/tools?category=media",
    kind: "index",
    profiles: fullProfiles,
    profileReductionReason: "No reduction: the shared tool index keeps the full locale, theme, and viewport product.",
    readySelector: ".tools-index-page .tool-category-section .ui-tool-card",
    assertSelector: ".tools-index-page .tool-category-section .ui-tool-card",
  }),
];

const defaultFixtureFor = (toolId) => toolId === "security-tools"
  ? Object.freeze({ kind: "deterministic-password", value: "Worklazy2!Safe#Tool9" })
  : null;

const initialScenarioFor = (route) => {
  const koreanOnly = route.toolId === "hwp-editor";
  const migrated = migratedToolIds.has(route.toolId);
  return scenario({
    scenarioId: `${route.id}--initial`,
    routeId: route.id,
    toolId: route.toolId,
    stateId: "initial",
    stateType: "initial",
    path: route.path,
    kind: "tool",
    profiles: koreanOnly ? koreanOnlyProfiles : representativeProfiles,
    profileReductionReason: koreanOnly
      ? "English is product-level N/A. Korean keeps paired desktop/light and mobile/dark coverage; the redirect has its own scenario."
      : "Representative pairwise coverage retains both locales, themes, and viewports without the eight-way full product.",
    fixture: defaultFixtureFor(route.toolId),
    readySelector: migrated ? `[data-tool-page='${route.toolId}']` : DEFAULT_READY_SELECTOR,
    assertSelector: migrated ? `[data-tool-page='${route.toolId}']` : DEFAULT_READY_SELECTOR,
    localeNotApplicableReason: koreanOnly ? HWP_ENGLISH_NA_REASON : null,
  });
};

const bottomScenarioFor = (route) => {
  const koreanOnly = route.toolId === "hwp-editor";
  const migrated = migratedToolIds.has(route.toolId);
  return scenario({
    scenarioId: `${route.id}--bottom`,
    routeId: route.id,
    toolId: route.toolId,
    stateId: "bottom",
    stateType: "bottom",
    path: route.path,
    kind: "tool",
    profiles: koreanOnly ? koreanOnlyBottomProfiles : mobileBottomProfiles,
    profileReductionReason: koreanOnly
      ? "The clearance contract is mobile-only and English is product-level N/A, so the Korean dark mobile profile is the sole applicable profile."
      : "The clearance contract is mobile-only; KO/dark and EN/light retain both locales and themes while avoiding redundant desktop captures.",
    fixture: defaultFixtureFor(route.toolId),
    actions: [{ type: "scroll-bottom" }],
    readySelector: migrated ? `[data-tool-page='${route.toolId}']` : DEFAULT_READY_SELECTOR,
    assertSelector: migrated ? `[data-tool-page='${route.toolId}']` : DEFAULT_READY_SELECTOR,
    bottomTargetSelector: migrated ? `[data-tool-page='${route.toolId}'] > :last-child` : DEFAULT_BOTTOM_TARGET_SELECTOR,
    localeNotApplicableReason: koreanOnly ? HWP_ENGLISH_NA_REASON : null,
  });
};

const interactionDefinitions = Object.freeze({
  "excel-merger": Object.freeze({
    stateId: "interaction-sheet-selection",
    fixture: { kind: "inline-file", fileName: "visual-merger.csv", mimeType: "text/csv", contents: "Name,Amount\nWorklazy,10\nTools,20" },
    actions: [
      { type: "upload", selector: "[data-tool-page='excel-merger'] input[type='file']" },
      { type: "wait", selector: "[data-testid='excel-sheet-name-list']" },
      { type: "click-option", selector: "[data-testid='excel-sheet-selection-mode'] [data-ui-component='segmented-control']", optionIndex: 2 },
      { type: "click", selector: "[data-testid='excel-sheet-name-chip']" },
      { type: "click", selector: "[data-testid='excel-sheet-name-chip']" },
      { type: "scroll-into-view", selector: "[data-testid='excel-sheet-selector']", offset: -88 },
    ],
    assertSelector: "[data-testid='excel-sheet-name-chip'][aria-pressed='true']",
  }),
  "excel-compare": Object.freeze([
    Object.freeze({
      stateId: "interaction-key-mode",
      actions: [
        { type: "click", selector: "[data-testid='excel-compare-mode-grid'] button:nth-child(2)" },
        { type: "scroll-into-view", selector: "[data-testid='excel-compare-mode-grid']", offset: -88 },
      ],
      assertSelector: "[data-testid='excel-compare-mode-grid'] button:nth-child(2)[aria-checked='true']",
    }),
    Object.freeze({
      stateId: "interaction-pair",
      actions: [
        { type: "upload", selector: "[data-testid='excel-compare-page'] input[type='file']", fixture: { kind: "inline-file", fileName: "visual-left.csv", mimeType: "text/csv", contents: "ID,Value\n1,Left" } },
        { type: "upload", selector: "[data-testid='excel-compare-page'] input[type='file']", fixture: { kind: "inline-file", fileName: "visual-right.csv", mimeType: "text/csv", contents: "ID,Value\n1,Right" } },
        { type: "wait", selector: "[data-testid='excel-sheet-fields']" },
        { type: "wait-enabled", selector: "[data-testid='excel-pair-swap']" },
      ],
      assertSelector: "[data-testid='excel-pair-files']",
    }),
  ]),
  "excel-cleaner": Object.freeze([
    Object.freeze({
      stateId: "interaction-rule",
      fixture: { kind: "inline-file", fileName: "visual-cleaner.csv", mimeType: "text/csv", contents: "Name,Amount\n Worklazy ,10\n Tools ,20" },
      actions: [
        { type: "upload", selector: "[data-tool-page='excel-cleaner'] input[type='file']" },
        { type: "wait", selector: "[data-testid='excel-cleaner-sheets']" },
        { type: "click", selector: "[data-testid='excel-cleaner-add-rule'] button" },
        { type: "wait", selector: "[data-testid='excel-cleaner-rule']" },
      ],
      assertSelector: "[data-testid='excel-cleaner-rule']",
    }),
    Object.freeze({
      stateId: "interaction-result",
      fixture: { kind: "inline-file", fileName: "visual-cleaner.csv", mimeType: "text/csv", contents: "Name,Amount\n Worklazy ,10\n Tools ,20" },
      actions: [
        { type: "upload", selector: "[data-tool-page='excel-cleaner'] input[type='file']" },
        { type: "wait", selector: "[data-testid='excel-cleaner-sheets']" },
        { type: "click", selector: "[data-testid='excel-cleaner-add-rule'] button" },
        { type: "wait-enabled", selector: "[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']" },
        { type: "click", selector: "[data-testid='excel-cleaner-actions'] [data-ui-component='primary-button']" },
        { type: "wait", selector: "[data-testid='excel-cleaner-results']", timeoutMs: 240_000 },
        { type: "scroll-into-view", selector: "[data-testid='excel-cleaner-results']", offset: -88 },
      ],
      assertSelector: "[data-testid='excel-cleaner-results']",
    }),
  ]),
  "pdf-editor": Object.freeze([
    Object.freeze({
      stateId: "interaction-organize-thumbnails",
      fixture: { kind: "generated-pdf", fileName: "visual-pages.pdf", pageCount: 2 },
      actions: [
        { type: "upload", selector: "[data-tool-page='pdf-editor'] input[type='file']" },
        { type: "wait", selector: ".pdf-page-card", timeoutMs: 60_000 },
        { type: "scroll-into-view", selector: ".pdf-page-grid", offset: -88 },
        { type: "wait", selector: ".pdf-page-card .pdf-thumbnail-frame img", timeoutMs: 60_000 },
      ],
      assertSelector: ".pdf-page-card .pdf-thumbnail-frame img",
    }),
    Object.freeze({
      stateId: "interaction-image-to-pdf-thumbnails",
      fixture: { kind: "generated-png", fileName: "visual-page.png", width: 320, height: 220 },
      actions: [
        { type: "click", selector: ".pdf-tool-navigation a:nth-child(2)" },
        { type: "upload", selector: "[data-tool-page='pdf-editor'] input[type='file']" },
        { type: "wait", selector: ".pdf-image-card" },
        { type: "scroll-into-view", selector: ".pdf-image-grid", offset: -88 },
      ],
      assertSelector: ".pdf-tool-page[data-pdf-mode='image-to-pdf'] .pdf-image-card",
    }),
    Object.freeze({
      stateId: "interaction-pdf-to-image-thumbnails",
      fixture: { kind: "generated-pdf", fileName: "visual-images.pdf", pageCount: 2 },
      actions: [
        { type: "click", selector: ".pdf-tool-navigation a:nth-child(3)" },
        { type: "upload", selector: "[data-tool-page='pdf-editor'] input[type='file']" },
        { type: "wait", selector: ".pdf-page-card", timeoutMs: 60_000 },
        { type: "scroll-into-view", selector: ".pdf-page-grid", offset: -88 },
        { type: "wait", selector: ".pdf-page-card .pdf-thumbnail-frame img", timeoutMs: 60_000 },
      ],
      assertSelector: ".pdf-tool-page[data-pdf-mode='pdf-to-image'] .pdf-page-card",
    }),
    Object.freeze({
      stateId: "interaction-convert-thumbnails",
      fixture: { kind: "generated-pdf", fileName: "visual-convert.pdf", pageCount: 2 },
      actions: [
        { type: "click", selector: ".pdf-tool-navigation a:nth-child(4)" },
        { type: "upload", selector: "[data-tool-page='pdf-editor'] input[type='file']" },
        { type: "wait", selector: ".pdf-page-card", timeoutMs: 60_000 },
        { type: "scroll-into-view", selector: ".pdf-page-grid", offset: -88 },
        { type: "wait", selector: ".pdf-page-card .pdf-thumbnail-frame img", timeoutMs: 60_000 },
      ],
      assertSelector: ".pdf-tool-page[data-pdf-mode='convert'] .pdf-page-card",
    }),
  ]),
  "document-compare": Object.freeze([
    Object.freeze({
      stateId: "interaction-toggle-on",
      actions: [
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 0 },
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 0 },
      ],
      assertSelector: "[data-testid='document-output-options'] [role='switch'][aria-checked='true']",
    }),
    Object.freeze({
      stateId: "interaction-toggle-off",
      actions: [{ type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 0 }],
      assertSelector: "[data-testid='document-output-options'] [role='switch'][aria-checked='false']",
    }),
    Object.freeze({
      stateId: "interaction-docx-result",
      actions: [
        { type: "upload", selector: "[data-tool-page='document-compare'] input[type='file']", elementIndex: 0, fixture: { kind: "generated-docx", fileName: "visual-before.docx", text: "Worklazy document before." } },
        { type: "upload", selector: "[data-tool-page='document-compare'] input[type='file']", elementIndex: 1, fixture: { kind: "generated-docx", fileName: "visual-after.docx", text: "Worklazy document after with a change." } },
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 1 },
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 2 },
        { type: "wait-enabled", selector: "[data-testid='document-action-bar'] [data-ui-component='primary-button']" },
        { type: "click", selector: "[data-testid='document-action-bar'] [data-ui-component='primary-button']" },
        { type: "wait", selector: "[data-testid='document-result-card']", timeoutMs: 240_000 },
        { type: "click", selector: "[data-testid='document-view-result']" },
        { type: "wait", selector: "[data-testid='document-result-view']", timeoutMs: 240_000 },
      ],
      assertSelector: "[data-testid='document-result-view']",
    }),
    Object.freeze({
      stateId: "interaction-hwp-result",
      actions: [
        { type: "upload", selector: "[data-tool-page='document-compare'] input[type='file']", elementIndex: 0, fixture: { kind: "base64-file", path: "fixtures/rhwp-roundtrip-empty.hwp.b64", fileName: "visual-before.hwp", mimeType: "application/x-hwp" } },
        { type: "upload", selector: "[data-tool-page='document-compare'] input[type='file']", elementIndex: 1, fixture: { kind: "base64-file", path: "fixtures/rhwp-roundtrip-empty.hwp.b64", fileName: "visual-after.hwp", mimeType: "application/x-hwp" } },
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 1 },
        { type: "click", selector: "[data-testid='document-output-options'] [role='switch']", elementIndex: 2 },
        { type: "wait-enabled", selector: "[data-testid='document-action-bar'] [data-ui-component='primary-button']" },
        { type: "click", selector: "[data-testid='document-action-bar'] [data-ui-component='primary-button']" },
        { type: "wait", selector: "[data-testid='document-result-card']", timeoutMs: 240_000 },
        { type: "click", selector: "[data-testid='document-view-result']" },
        { type: "wait", selector: "[data-testid='document-result-view']", timeoutMs: 240_000 },
      ],
      assertSelector: "[data-testid='document-result-view']",
    }),
  ]),
  "video-studio": Object.freeze({
    stateId: "interaction-gif-output",
    fixture: { kind: "file", path: "fixtures/video-vp9-benchmark.mp4" },
    actions: [
      { type: "upload", selector: "input[type='file']" },
      { type: "wait", selector: ".video-output-format-grid select" },
      { type: "select", selector: ".video-output-format-grid select", value: "gif" },
    ],
    assertSelector: "[data-testid='video-gif-settings']",
  }),
  "audio-studio": Object.freeze([
    Object.freeze({
      stateId: "interaction-waveform",
      fixture: { kind: "generated-wav", fileName: "visual-tone.wav", durationSeconds: 0.25, sampleRate: 8_000 },
      actions: [
        { type: "upload", selector: "[data-tool-page='audio-studio'] input[type='file']" },
        { type: "wait-shadow-canvas", selector: ".audio-waveform" },
        { type: "wait", selector: ".ui-operation-progress.ui-status-success" },
        { type: "scroll-into-view", selector: ".audio-waveform-shell", offset: -88 },
      ],
      assertSelector: ".audio-waveform",
    }),
    Object.freeze({
      stateId: "interaction-effect-robot",
      fixture: { kind: "generated-wav", fileName: "visual-effect.wav", durationSeconds: 0.25, sampleRate: 8_000 },
      actions: [
        { type: "upload", selector: "[data-tool-page='audio-studio'] input[type='file']" },
        { type: "wait-shadow-canvas", selector: ".audio-waveform" },
        { type: "wait", selector: ".ui-operation-progress.ui-status-success" },
        { type: "click", selector: "[data-testid='audio-voice-presets'] button:nth-child(4)" },
        { type: "scroll-into-view", selector: ".audio-voice-effect-panel", offset: -88 },
      ],
      assertSelector: "[data-testid='audio-voice-presets'] button:nth-child(4)[aria-checked='true']",
    }),
  ]),
  "image-studio": Object.freeze({
    stateId: "interaction-batch-tab",
    actions: [{ type: "click", selector: ".studio-tabs button:nth-child(2)" }],
    assertSelector: ".studio-tabs button:nth-child(2).active",
  }),
  "text-merger": Object.freeze({
    stateId: "interaction-comma-separator",
    actions: [{ type: "select", selector: "[data-testid='text-merger-separator']", value: "comma" }],
    assertSelector: "[data-testid='text-merger-separator']",
  }),
  "text-formatter": Object.freeze({
    stateId: "interaction-format-result",
    actions: [
      { type: "replace-text", selector: "[data-testid='formatter-input']", value: '{"name":"Worklazy","ok":true}' },
      { type: "click", selector: "[data-testid='formatter-actions'] [data-ui-component='primary-button']", elementIndex: 0 },
      { type: "wait-value-includes", selector: "[data-testid='formatter-output']", value: '  "name"' },
    ],
    assertSelector: "[data-testid='formatter-editors']",
  }),
  "work-calculator": Object.freeze({
    stateId: "interaction-leave-result",
    actions: [{ type: "click-option", selector: "[data-testid='work-mode'] [data-ui-component='segmented-control']", optionIndex: 1 }],
    assertSelector: "[data-testid='leave-result']",
  }),
  "timezone-calculator": Object.freeze({
    stateId: "interaction-base-city",
    actions: [{ type: "select-index", selector: "[data-testid='timezone-base-city']", optionIndex: 1 }],
    assertSelector: "[data-testid='timezone-base-city']",
  }),
  "payroll-calculator": Object.freeze({
    stateId: "interaction-net-mode",
    actions: [{ type: "click-option", selector: "[data-testid='payroll-mode'] [data-ui-component='segmented-control']", optionIndex: 1 }],
    assertSelector: "[data-testid='payroll-breakdown']",
  }),
  "security-tools": Object.freeze({
    stateId: "interaction-password-strength",
    fixture: { kind: "deterministic-password", value: "Worklazy2!Safe#Tool9" },
    actions: [{ type: "wait", selector: "[data-testid='password-strength'][aria-valuenow='4']" }],
    assertSelector: "[data-testid='password-strength'][aria-valuenow='4']",
  }),
  "qr-studio": Object.freeze([
    Object.freeze({
      stateId: "interaction-bulk-mode",
      actions: [{ type: "click-option", selector: "[data-testid='qr-mode'] [data-ui-component='segmented-control']", optionIndex: 1 }],
      assertSelector: "[data-testid='qr-bulk-page']",
    }),
    Object.freeze({
      stateId: "interaction-create",
      actions: [
        { type: "replace-text", selector: "[data-testid='qr-content']", value: "https://worklazy.net/visual-b4" },
        { type: "wait", selector: "[data-testid='qr-preview'][data-ready='true']" },
        { type: "scroll-into-view", selector: "[data-testid='qr-preview']", offset: -88 },
      ],
      assertSelector: "[data-testid='qr-preview'][data-ready='true']",
    }),
    Object.freeze({
      stateId: "interaction-scan",
      actions: [
        { type: "wait", selector: "[data-testid='qr-preview'][data-ready='true']" },
        { type: "scan-canvas-qr", sourceSelector: "[data-testid='qr-preview'] canvas", modeSelector: "[data-testid='qr-mode'] [data-ui-component='segmented-control']", optionIndex: 2, inputSelector: "[data-testid='qr-photo-picker'] input[type='file']", fileName: "visual-generated-qr.png" },
        { type: "wait", selector: "[data-testid='qr-scan-result']", timeoutMs: 60_000 },
        { type: "scroll-into-view", selector: "[data-testid='qr-scan-result-slot']", offset: -88 },
      ],
      assertSelector: "[data-testid='qr-scan-result']",
    }),
  ]),
  "data-converter": Object.freeze({
    stateId: "interaction-json-source",
    actions: [{ type: "select", selector: "[data-testid='converter-route'] select:first-of-type", value: "json" }],
    assertSelector: "[data-testid='converter-route'] select:first-of-type",
  }),
  "hwp-editor": Object.freeze({
    stateId: "interaction-document-loaded",
    fixture: { kind: "base64-file", path: "fixtures/rhwp-roundtrip-empty.hwp.b64", fileName: "visual-hwp-document.hwp", mimeType: "application/x-hwp" },
    actions: [
      { type: "upload", selector: "[data-tool-page='hwp-editor'] input[type='file']" },
      { type: "wait", selector: "[data-testid='hwp-focus-toolbar']" },
    ],
    assertSelector: "[data-testid='hwp-editor-shell'] iframe",
  }),
  "office-editor": Object.freeze({
    stateId: "interaction-workspace",
    path: "/tools/office-editor/app/",
    actions: [{ type: "wait", selector: "[data-tool-page='office-editor-app']" }],
    readySelector: "[data-tool-page='office-editor-app']",
    assertSelector: "[data-testid='office-canvas-shell']",
  }),
  "image-privacy": Object.freeze({
    stateId: "interaction-clean-result",
    fixture: { kind: "generated-png", fileName: "visual-privacy.png", width: 48, height: 32 },
    actions: [
      { type: "upload", selector: "[data-tool-page='image-privacy'] input[type='file']" },
      { type: "wait-enabled", selector: "[data-tool-page='image-privacy'] [data-ui-component='primary-button']" },
      { type: "click", selector: "[data-tool-page='image-privacy'] [data-ui-component='primary-button']", elementIndex: 0 },
      { type: "wait", selector: "[data-testid='image-privacy-result']" },
    ],
    assertSelector: "[data-testid='image-privacy-result']",
  }),
  "text-tools": Object.freeze({
    stateId: "interaction-text-cleanup",
    actions: [
      { type: "replace-text", selector: "[data-testid='text-tools-input']", value: "할수  있습니다\n할수  있습니다" },
      { type: "click", selector: "[data-testid='text-actions'] button:nth-child(2)", elementIndex: 0 },
      { type: "wait-value-includes", selector: "[data-testid='text-tools-output']", value: "할수 있습니다" },
    ],
    assertSelector: "[data-testid='text-tools-editors']",
  }),
});

const interactionScenariosFor = (route) => {
  const configured = interactionDefinitions[route.toolId];
  if (!configured) return [];
  const definitions = Array.isArray(configured) ? configured : [configured];
  const koreanOnly = route.toolId === "hwp-editor";
  const migrated = migratedToolIds.has(route.toolId);
  return definitions.map((definition) => scenario({
    scenarioId: `${route.id}--${definition.stateId}`,
    routeId: route.id,
    toolId: route.toolId,
    stateId: definition.stateId,
    stateType: "interaction",
    path: definition.path ?? route.path,
    kind: "tool",
    profiles: koreanOnly ? koreanInteractionProfiles : interactionProfiles,
    profileReductionReason: koreanOnly
      ? "The HWP editor is Korean-only; one Korean light desktop profile covers the loaded-document workspace while initial and bottom retain mobile and dark coverage."
      : "Minimum interaction coverage uses one EN/dark/desktop profile; initial and bottom scenarios retain the remaining locale, theme, and viewport axes.",
    fixture: definition.fixture ?? defaultFixtureFor(route.toolId),
    actions: definition.actions,
    readySelector: definition.readySelector ?? (migrated ? `[data-tool-page='${route.toolId}']` : DEFAULT_READY_SELECTOR),
    assertSelector: definition.assertSelector,
    localeNotApplicableReason: koreanOnly ? HWP_ENGLISH_NA_REASON : null,
  }));
};

const toolScenarios = availableToolRoutes.flatMap((route) => {
  const interactions = interactionScenariosFor(route);
  return [initialScenarioFor(route), bottomScenarioFor(route), ...interactions];
});

const hwpEnglishRedirectScenario = scenario({
  scenarioId: "hwp-editor-empty--redirect-en-tools",
  routeId: "hwp-editor-empty",
  toolId: "hwp-editor",
  stateId: "redirect-en-tools",
  stateType: "redirect",
  path: "/tools/hwp-editor",
  kind: "redirect",
  profiles: englishRedirectProfiles,
  profileReductionReason: "Only English profiles apply to this product-level redirect; KO is covered by the tool's initial and bottom scenarios.",
  actions: [{ type: "assert-path", pathname: "/en/tools" }],
  readySelector: ".tools-index-page",
  assertSelector: ".tools-index-page",
  localeNotApplicableReason: "Korean is N/A for this redirect assertion because /ko/tools/hwp-editor is the supported tool route.",
});

export const visualRegressionScenarios = Object.freeze([
  ...indexScenarios,
  ...toolScenarios,
  hwpEnglishRedirectScenario,
]);

export const interactionCoveredToolIds = Object.freeze(Object.keys(interactionDefinitions).sort());

export const interactionNotApplicableReasons = Object.freeze({});

const QA_STATE_TYPES = new Set(["initial", "bottom", "interaction"]);

export const qaCaptureScenarios = Object.freeze(visualRegressionScenarios
  .filter(({ stateType }) => QA_STATE_TYPES.has(stateType))
  .map((definition) => scenario({
    ...definition,
    profiles: definition.localeNotApplicableReason
      ? fullProfiles.filter(({ locale }) => definition.profiles.some((profileDefinition) => profileDefinition.locale === locale))
      : fullProfiles,
    profileReductionReason: definition.localeNotApplicableReason
      ? "QA capture keeps the full theme and viewport product for every product-applicable locale; the documented N/A locale remains excluded."
      : "No reduction: bundle QA keeps the full locale, theme, and viewport product for initial, bottom, and interaction states.",
  })));

const qrBulkBase = {
  routeId: "qr-bulk-qa",
  toolId: "qr-studio",
  path: "/tools/qr-studio/bulk",
  kind: "tool",
  profiles: fullProfiles,
  profileReductionReason: "No reduction: the dedicated U3 evidence set retains the full locale, theme, and viewport product.",
  readySelector: "[data-testid='qr-bulk-page']",
  bottomTargetSelector: null,
  localeNotApplicableReason: null,
};

export const qrBulkQaScenarios = Object.freeze([
  scenario({
    ...qrBulkBase,
    scenarioId: "qr-bulk-qa--initial",
    stateId: "initial",
    stateType: "initial",
    assertSelector: "[data-testid='qr-bulk-page']",
  }),
  scenario({
    ...qrBulkBase,
    scenarioId: "qr-bulk-qa--result",
    stateId: "result",
    stateType: "interaction",
    fixture: {
      kind: "inline-file",
      fileName: "qr-visual.csv",
      mimeType: "text/csv",
      contents: "Text,Name,Description\nhttps://worklazy.net/,샘플 QR,브라우저에서 생성한 결과",
    },
    actions: [
      { type: "upload", selector: "[data-testid='qr-bulk-page'] input[type='file']" },
      { type: "wait", selector: "[data-testid='qr-payload-type']" },
      { type: "wait-enabled", selector: "[data-testid='qr-bulk-generate'] button" },
      { type: "click", selector: "[data-testid='qr-bulk-generate'] button" },
      { type: "wait", selector: "[data-testid='qr-bulk-results']" },
      { type: "scroll-into-view", selector: "[data-testid='qr-bulk-results']", offset: -88 },
    ],
    assertSelector: "[data-testid='qr-bulk-results']",
  }),
]);
