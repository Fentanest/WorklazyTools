# English UI literal audit

`npm run test:i18n` checks English locale JSON values and every TSX source with
TypeScript's parser. JSX text, literal attributes, messages and template pieces
containing `[가-힣ㄱ-ㅎ]` fail the check. Comments are not string AST nodes.
Translation keys, Korean/English `L`/`local` pairs and explicit language-selected
branches are allowed. An `L` call without an English alternative is rejected.
`tests/unit/i18n-literal-audit.test.ts` covers a real leak, accepted language
pairs, narrow exception scope and a zero-file selection.

`i18n-literal-allowlist.json` is intentionally scoped to named declarations,
not entire files. It records the reason for Korean loading-name data, Korean
advertising disclosure, language-indexed field labels, a guarded Korean-only
change-label return, Korean-only license-purpose metadata, and an internal
missing-context error hidden by the localized route error boundary. A new
unrelated literal in one of those files still fails.

The only Korean values allowed in English locale JSON are the native Korean
language name and the three deliberately bilingual root language-landing
labels. These are not a general fallback for English tool copy.

`ToolGuideLink` owns the shared affordance and `common:actions.guideLink` owns
its copy. Korean text and the arrow remain unchanged. Legacy Excel-comparison
resource keys remain available for compatibility but the UI uses the common
component. Redactor output consequences and guide-load failure also have
explicit Korean/English resources. Banner-language option labels use that
feature's existing language-paired messages.

Runtime check, after a build:

```sh
I18N_PHASE=after node tests/i18n-leak-smoke.mjs
```

It reads the English sitemap and generated HTML paths, plus the expired-result
route; captures visible text and accessible labels/titles/placeholders/alt;
and probes bounded synthetic input, result, rejection and empty states. It
blocks all external requests, follows compatibility redirects locally, and
keeps logs, scope, exclusions, incomplete states and selected screenshots under
`scratch/i18nleak`. `I18N_ROUTES` explicitly selects comma-separated paths for a
corrected/targeted probe; that report is labeled targeted, not full coverage.
The script uses synthetic English content and never sends files to providers.
Zero selected routes is an error. Unsupported Office/HWP/media execution states
are listed as not covered, not reported as successful results.

Data-only Korean remains valid: holidays/source records, Korean spelling rules
and their examples, font names in document formats, import-column aliases,
Korean metadata translated by the catalog/SEO/city display layer, and Korean
user content. Those data/helper files were included in the one-time `src/`
static inventory; the automatic literal guard specifically covers TSX and
English locale resources, and is complemented by the runtime check.

The HWP editor also receives an explicit `lang=en|ko` query parameter when
created. Without it the embedded Studio defaults to stored Korean regardless
of the English parent page. Callers that set their own locale (such as the HWP
PDF panel) keep the helper's no-argument URL contract. This only changes initial
locale selection; it does not restart an open document or change vendor bytes.

Studio 0.8.7's IME input has a hardcoded Korean accessible name even in its
English locale. The parent localizes that one control after the editor-ready
handshake, using an exact original-label match. Style/font names, Korean sample
glyphs and the blank document's filename remain document data. Vendor assets
and user document content are not modified.
