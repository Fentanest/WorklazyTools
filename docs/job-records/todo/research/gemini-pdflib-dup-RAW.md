# 조사 위임 — PDF 라이브러리 중복 배포 제거 방법

### 1. 현행 구조 실측 (산출 명령 병기)
- **명령**: `git -C /tmp/worklazy-xd-deploy grep "pdf-lib" src/`
- **`pdf-lib` import 위치 목록**:
  - **Main 측**: `src/features/pdf-editor/finish/engine.ts`, `src/features/pdf-editor/finish/preflight.ts`, `src/features/pdf-editor/finish/structure.ts`, `src/features/pdf-editor/finish/watermark.ts`, `src/features/qr-studio/qrLabelPdf.ts`, `src/utils/pdfFontEmbed.ts`
  - **Worker 측**: `src/features/pdf-editor/pdf.worker.ts`
- **Worker 진입점 및 Vite 설정**:
  - 진입점 (예): `src/features/pdf-editor/pdfWorkerClient.ts` 등에서 `new Worker(new URL("./pdf.worker.ts", import.meta.url), { type: "module" })` 구문으로 생성.
  - 빌드 설정: `cat vite.config.ts` 확인 결과, `worker.format` 은 명시되지 않아 기본값(`'iife'`)이 적용 중이며, `worker.rollupOptions` 에는 `output.entryFileNames` (경로 라우팅) 설정만 존재함.
- **`pdfjs-dist` 공유 방식의 구현 위치**:
  - `src/features/pdf-editor/pdfPreview.ts` 파일의 8번 줄에서 `import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";` 구문으로 사전에 번들링된 외부 파일의 에셋 URL을 획득함.
  - 14번 줄에서 `GlobalWorkerOptions.workerSrc = pdfWorkerUrl;` 로 URL을 주입해 번들러를 완전히 우회하고 하나의 정적 에셋만 브라우저가 다운로드하도록 구현되어 있음.

### 2. 웹 조사 — 공식 문서 근거
- **Vite 에서 Main과 Worker가 의존성을 공유하는 공식 방법**:
  - **공식 지원 없음**: Vite의 구조적 특성상 Main 스레드와 Worker는 **완전히 독립된 별개의 Rollup 빌드(Isolated Build) 파이프라인**을 거침. 따라서 의존성 그래프가 분리되며 네이티브 청크를 자동으로 합쳐주는 공식 기능은 존재하지 않음 ([Vite Web Workers 가이드](https://vite.dev/guide/features.html#web-workers), 확인: 2026-09-09).
  - **`import.meta.url` + `new Worker`**: 워커 파일을 독립된 진입점(Entry)으로 인식시켜 별도 번들을 생성하게 하는 표준 방식이므로, 오히려 의존성이 양쪽 번들에 중복 포함되는 직접적인 원인임.
  - **`worker.format`**: 이 값을 `'es'`로 변경하더라도 Worker 내부의 청크 스플리팅이 활성화될 뿐, Main 빌드 결과물과 청크를 공유하지는 않음 ([Vite GitHub Issue #16554](https://github.com/vitejs/vite/discussions/16554), 확인: 2026-09-09).
  - **`?url` import 우회**: 코드를 번들링하지 않고 정적 에셋으로 URL만 반환함. `pdfjs-dist`처럼 라이브러리가 이미 단일 파일로 묶여 제공될 때만, 이 URL을 가져와 Main과 Worker 양쪽에서 동적 로드하는 식으로 중복 다운로드를 막을 수 있음.
- **Worker 안에서 ESM 동적 import 가 가능한 조건**:
  - **브라우저 지원**: Chrome 80+, Safari 14.1+, **Firefox 114+ (2023년 6월)** 부터 `{ type: 'module' }` 기반 워커 내에서의 `import()` 구문을 정식 지원함 ([MDN Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) / [Can I use: ES6 module workers](https://caniuse.com/mdn-api_worker_worker_ecmascript_modules), 확인: 2026-09-09).
- **`pdf-lib`의 동적 import 안전성**:
  - 브라우저 전용 단일 ESM 배포판(`node_modules/pdf-lib/dist/pdf-lib.esm.min.js`, 파싱 523KB)을 제공하며, 내부에 pako·upng 등 모든 하부 의존성이 인라인되어 있음 ([pdf-lib 공식 저장소](https://github.com/Hopding/pdf-lib)).
  - Node 전용 객체나 Top-level side effect, Bare import 경로가 포함되어 있지 않아, 브라우저 워커에서 안전하게 `await import(url)` 로 가져올 수 있음.

### 3. 위험 목록
- **비-모듈(Non-module) Worker 폴백 상실**:
  - 현재 Vite의 IIFE 방식 워커 빌드는 구형 브라우저에서 `importScripts` 등을 통해 폴백 동작이 가능했으나, 공유를 목적으로 `type: 'module'` 기반 동적 `import()` 로 전환하면 **Firefox 113 이하** 브라우저에서는 `SyntaxError`나 "Dynamic module import is disabled" 예외를 던지며 워커 실행이 완전히 실패함.
- **동적 import 실패 (Network Error) 및 복구 UI 부재**:
  - `?url` 로 분리된 청크 로드 시 네트워크 일시 단절, AdBlocker 개입, 배포로 인한 해시 갱신 등으로 `TypeError: Failed to fetch dynamically imported module` 예외가 터질 수 있음. 기존 `pdfjs-dist` 표시 런타임이 겪은 문제와 동일하며, 명시적 새로고침 안내 UI 복원력이 동반 구현되어야 함.
- **트리쉐이킹(Tree-shaking) 상실에 따른 총 용량 증가 위험**:
  - 기존에는 Rollup이 Main과 Worker 각각에서 실제로 호출하는 함수만 잘라내어 번들에 포함시켰으나, 중복 방지를 위해 단일 ESM 에셋(`pdf-lib.esm.min.js`)을 `?url` 로드 방식으로 전환하면 트리쉐이킹이 무효화되어 파일 전체가 로드됨.

### 4. 결론
- **판정**: **조건부 가능 (우회로 사용)**
- **근거**: Vite의 설정만으로 두 번들을 합치는 네이티브 기능은 불가함. 하지만 라이브러리가 제공하는 사전 번들링된 단일 ESM 파일을 `?url` 로 에셋화한 뒤, Main과 Worker에서 각각 `await import(/* @vite-ignore */ pdfLibUrl)` 형태로 동적 로드하면 브라우저 캐시를 단일화할 수 있음. (Firefox 114+ 지원 하한선 수용 필수)
- **구현 순서 개요**:
  1. `src/utils/pdfLibShared.ts` 등을 생성해 `import pdfLibUrl from "pdf-lib/dist/pdf-lib.esm.min.js?url";` 선언.
  2. `vite.config.ts` 의 `worker.format` 을 명시적인 `'es'` 로 지정.
  3. Main(`engine.ts` 등)과 Worker(`pdf.worker.ts`) 최상단에 있는 정적 `import { ... } from "pdf-lib"` 구문을 전부 제거하고, 실행 시점에 `const { PDFDocument } = await import(/* @vite-ignore */ pdfLibUrl);` 로 초기화하도록 아키텍처 리팩토링.
  4. 로드 실패(`catch`) 시 사용자에게 명시적 새로고침을 안내하는 Fallback 추가.
- **예상 감량액**:
  - **추정 불가 (오히려 순증할 위험이 높음).**
  - 현재 번들 파싱 사이즈 기준 Main 118,977B + Worker 219,622B = 총 **약 338KB** 가 각각의 번들에 트리쉐이킹되어 나누어져 있음 (`scripts/measure-bundle-budget.mjs` 및 백로그 기록 기준).
  - 동적 로드를 위해 통째로 가져올 `pdf-lib.esm.min.js` 의 Gzip 크기는 측정 결과 **206,274B** (파싱 시 523KB)임.
  - 브라우저가 내려받고 파싱하는 중복 *파일 개수*는 1개로 단일화되나, 트리쉐이킹 무효화로 인해 전체 전송/파싱 총량 자체는 **약 185KB 가량 증가할 수 있음**. 목표로 한 "순감량 80~120KB"는 단순히 번들 설정을 꼬아서 얻을 수 있는 것이 아니라, Main 측의 `pdf-lib` 사용 로직 전체를 아예 Worker 내부로 이관(설계 변경)하여 Main 측 의존성을 완전히 도려냈을 때만 달성 가능한 수치임.
