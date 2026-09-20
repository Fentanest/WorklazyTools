# pdf-lib 중복 배포 제거 — Gemini 조사 + Claude 실측 검증 (2026-09-09)

> 원문 `gemini-pdflib-dup-RAW.md`. **「Gemini 산출물은 단서다」 규칙에 따라 검증한 결과만 아래에 채택**한다.

## ❌ 기각 — Gemini 의 main 측 import 목록이 틀렸다
Gemini 는 main 측 `pdf-lib` 소비처로 **6개**를 적었다: `finish/engine.ts`·`finish/preflight.ts`·`finish/structure.ts`·`finish/watermark.ts`·`qr-studio/qrLabelPdf.ts`·`utils/pdfFontEmbed.ts`.
**실측(`git grep -l "pdf-lib" main -- 'src/**'`) 결과 main 에는 3개뿐이다.**
```
main:src/features/pdf-editor/pdf.worker.ts
main:src/features/qr-studio/qrLabelPdf.ts
main:src/pages/LicensesPage.tsx
```
`finish/*` 는 **아직 main 에 없다**(진행 중인 `s3-pdf-finish` 브랜치 파일). Gemini 가 `git -C /tmp/worklazy-xd-deploy grep` 을 썼다고 적었는데 그 경로는 main 기반 worktree 이므로 `finish/*` 가 나올 수 없다 — **출처 불명의 목록이다. 이 목록을 쓰지 마라.**
**→ U4 병합 후 소비처가 늘어나므로, 착수 시점에 `main` 에서 다시 세어야 한다.**

## ✅ 채택 — 실측으로 확인된 것
| 주장 | 검증 | 결과 |
|---|---|---|
| `pdf-lib` 가 단일 ESM 배포판을 제공 | `ls node_modules/pdf-lib/dist/` | **확인. `pdf-lib.esm.min.js` = 523,417B** (map 별도) |
| Vite worker 설정에 `format` 미지정 | `git show main:vite.config.ts` | **확인.** `worker` 블록에 `plugins` 와 `rollupOptions.output.entryFileNames` 만 존재 → **기본값 적용** |
| worker 측 소비처 | `git grep` | **확인. `pdf.worker.ts:4` 가 `degrees, PDFDocument, rgb, StandardFonts` 를 import** |

## 🔎 미검증 — 외부 주장(URL·확인일 있음, 채택 전 실측 필요)
- **Vite 는 main 과 worker 를 완전히 독립된 Rollup 빌드로 처리**하며 청크 자동 공유 기능이 **없다**. → [Vite Web Workers](https://vite.dev/guide/features.html#web-workers) · [vitejs/vite#16554](https://github.com/vitejs/vite/discussions/16554), 확인 2026-09-09.
  - **이것이 사실이면 중복은 설정으로 못 없애고, `?url` + 동적 import 우회가 유일한 길**이다. 표시 런타임(`pdfjs-dist`)에서 이미 성공한 방식과 같다.
- `worker.format: 'es'` 로 바꿔도 **worker 내부 청크 분할만 활성화**되고 main 과 청크를 공유하지 않는다.
- **module worker 내 동적 `import()` 지원**: Chrome 80+ · Safari 14.1+ · **Firefox 114+(2023-06)**. → [MDN Worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) · [caniuse](https://caniuse.com/mdn-api_worker_worker_ecmascript_modules), 확인 2026-09-09.
- `pdf-lib` 는 **Node 전용 객체·top-level side effect·bare import 가 없어** worker 에서 `await import(url)` 안전. → [pdf-lib 저장소](https://github.com/Hopding/pdf-lib).

## ⚠️ 위험(Gemini 지적 — 타당해 보이나 실측 필요)
- **비-module worker 폴백 상실**: 현재 기본값 빌드는 구형 브라우저에서 동작하지만, 공유를 위해 `type: 'module'` + 동적 `import()` 로 바꾸면 **Firefox 113 이하에서 worker 실행이 완전히 실패**할 수 있다.
- **동적 import 실패 시 복구** — 이 프로젝트는 표시 런타임에서 **같은 문제를 겪고 "명시적 새로고침 안내"로 해결한 전례**가 있다(U4-4 R-A). 같은 계약을 재사용할 수 있다.
- 캐시·버전 불일치.

## 착수 전 확인 목록
1. **main 에서 `pdf-lib` 소비처 재측정**(U4 병합 후 늘어남).
2. Vite 독립 빌드 주장을 **실제 빌드 산출물로 확인**(두 번들에 같은 모듈이 들어가는지 module 메타데이터로).
3. **폴백 경로 설계** — Firefox 113 이하 등에서의 동작. 표시 런타임의 새로고침 복구 계약 재사용 가능 여부.
4. **감량 실측** — 목표 80~120KB 는 백로그의 기존 추정이며 이 조사로 확정된 값이 아니다.
