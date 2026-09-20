# U4-4 fix-4 구현 보고서

- 작업 branch: `s3-pdf-finish`
- 시작 HEAD: `e30018dd2d4801c5abba54a88f200e9ac69325d3`
- 최종 commit: `c3288856b10953e663a0910a9ca125c7bfe667eb`
- 작성자: Codx
- push/main 병합/배포: 수행하지 않음

## 실행 게이트와 범위

`PROJECT_RULES.md`, `AGENTS.md`, fix-4 dispatch, PDF finish 정본, U4-4 검토 기록과 `/tmp/worklazy-u4-4-review4` 검수 산출물을 대조했다. 시작 branch와 HEAD는 지시값과 일치했고 열린 계획 충돌은 없었다. 사용자 미추적 `before.docx`, `after.docx`, 네이버 확인 HTML, `newui/`는 열거나 stage하지 않았다. 금지된 `/tmp/worklazy-xd`, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에는 접근하지 않았다.

## 수리 결과

### R-A — 표시 런타임 최초 로드 실패 복구

- 공유 PDF 표시 모듈 import 실패를 `PdfDisplayLoadError`로 분리했다. abort는 그대로 전달하고, 표시 모듈 실패는 정상 PDF의 손상/읽기 불가 오류로 변환하지 않는다.
- 브라우저가 실패한 모듈 import를 문서 수명 동안 캐시할 수 있으므로 무효한 자동 재시도 대신 ko/en 공통 UI 경계에 명시적 페이지 새로고침 버튼을 제공한다. 안내는 연결 확인, 새로고침, PDF 재선택을 정확히 설명하며 내부 모듈명·자산 경로·원시 예외를 노출하지 않는다.
- 실제 브라우저에서 최초 공유 표시 자산 요청을 중단한 뒤 자동 재시도 0, 안내/새로고침 버튼 표시, 선택 폐기, 재선택 뒤 preview/save 성공을 확인했다. main/thumbnail worker는 계속 하나의 고유 표시 URL만 공유한다. worker 생성 불가 fallback과 취소 계약도 유지했다.

### R-B — 정적 생성 뒤 배포 실행 자산 계측

- current와 baseline 모두 현행 Vite 계측 build 뒤 현행 정적 생성기를 같은 output tree에 실행하고 나서 deployment inventory를 만든다. baseline은 소스 root만 고정 commit으로 바꾼다.
- 모든 배포 포함 ko/en `.js/.mjs` 경로를 inventory에 보존하고 동일 SHA-256의 gzip 비용만 한 번 부과한다. raw network 관측에는 deployment 제외 규칙을 재사용하지 않아, 제외 트리의 실행 자산이 실제 로드되면 누락으로 드러난다.
- 측정 뒤 생성 `.mjs`를 추가하는 음성 대조는 양방향 inventory guard에서 실패한다.
- 고정 기준선 commit: `5bc6854175331bdd73b267784d9633cdccda8446`
- baseline: 고유 실행 SHA 83개, 배포/측정 경로 99/99, 중복 경로 16, 양방향 missing 0.
- current: 고유 실행 SHA 89개, 배포/측정 경로 105/105, 중복 경로 16, 양방향 missing 0.

| gzip 지표 | 증분 | 상한 | 판정 |
|---|---:|---:|---|
| entry JS | 7,288B | 20,480B | 통과 |
| affected PDF route JS | 58,423B | 61,440B | 통과 |
| shared JS(귀속 이동 제외) | 2,095B | 30,720B | 통과 |
| app JS | 68,529B | 81,920B | 통과 |
| CSS | 300B | 10,240B | 통과 |

override는 `{}`, multiplier는 1이며 상한 변경은 없다. full 비교도 5종을 통과했고 affected 전체 증분은 -450,647B다.

### R-C — 워터마크 오류 상태 대비

- F2 범위의 invalid textarea와 empty-text notice만 light `red-800`, dark `red-200`으로 올렸다. F2 marker, 공용 debt, 허용 한도는 바꾸지 않았다.
- ko/en × light/dark 네 settled error 상태를 Axe 등록 목록에 추가하고 계산 스타일의 textarea/notice 대비 두 값을 각 상태에서 fail-closed로 검사한다.

| 상태 | invalid textarea | error notice |
|---|---:|---:|
| ko light | 7.6428:1 | 6.9595:1 |
| en light | 7.6428:1 | 6.9595:1 |
| ko dark | 8.9891:1 | 8.3795:1 |
| en dark | 8.9891:1 | 8.3795:1 |

모두 4.5:1 이상이며 scoped Axe는 violations 0, F2 incomplete 0, inherited incomplete 253, external requests 0이다. 검수 전 실패값은 light textarea 4.36, light notice 3.98, dark notice 4.20이었다.

### R-D — 128MiB 실제 최대 heartbeat 재측정

12개 고정 입력을 각각 새 browser context에서 3회 측정했다. 측정 범위를 preview-ready에서 끊지 않고 실제 생성 요청, saving 상태, 다운로드 준비까지 포함했다.

128MiB 원시 최대 heartbeat:

| repeat | 전체 최대 | preview 최대 | creation 최대 | 최대 phase | long task | saving 표시 |
|---:|---:|---:|---:|---|---:|---|
| 0 | **347.185ms** | 70.220ms | **347.185ms** | saving | 169ms | 표시 |
| 1 | 161.810ms | **161.810ms** | 92.945ms | inspection-preview | 144ms | 표시 |
| 2 | 154.410ms | 67.215ms | **154.410ms** | saving | 109ms | 표시 |

3회 중 1회가 200ms를 넘었으므로 heartbeat 목표는 **NOT MET**다. 중앙 곡선은 다음과 같다.

| fixture | 총 처리시간 중앙값 | 최대 heartbeat 중앙값 |
|---|---:|---:|
| 16MiB | 1,796.767ms | 142.395ms |
| 32MiB | 2,143.507ms | 57.600ms |
| 64MiB | 3,120.417ms | 88.705ms |
| 128MiB | 5,780.848ms | 161.810ms |

총시간 128/16 비율은 3.217로 준선형이다. 최대 초과는 pdf-lib가 단일 128MiB stream을 `object.copyBytesInto`에서 분할 불가능하게 직렬화하는 saving 구간이다. `objectsPerTick` 양보로 한 stream 내부를 쪼갤 수 없어 저장기 재설계 없이 모든 실행을 200ms 이하로 보장할 수 없으며, 통과로 주장하지 않는다.

대신 saving 진행 상태를 먼저 report하고 event loop에 양보한 뒤 직렬화를 시작하게 했다. 세 128MiB 실행 모두 실제 saving 표시가 관측됐다. 외부 취소 click→UI는 115.170ms, 늦은 결과 0, 같은 탭 재시도 성공이다. Worker 생성 불가 fallback도 preview/download 성공, route error 0이다.

## 검증

| 명령/대조 | 결과 |
|---|---|
| `npx tsc -b` | 통과, 진단 0 |
| `npm run test:unit` | 통과, 320/320 |
| `npm run build` | 통과, 2,847 modules, 정적 69페이지 |
| `VITE_LOCAL_QA=1 npm run build` | 통과, 2,847 modules, 정적 69페이지 |
| scoped `npm run test:a11y` (port 4281) | 5페이지, violations 0, F2 incomplete 0, external 0, 대비 전부 통과 |
| watermark visual (port 4283) | Chrome 152, 8/8, baseline 변경 없음 |
| `npm run test:pdf-watermark-performance` (port 4282, repeat 3) | 측정 완료; 128MiB heartbeat 목표 NOT MET, progress/cancel fallback 통과 |
| `npm run test:pdf-finish` | browser/direct/recovery/inventory/fallback 통과; PDF.js/Poppler golden 160/160 |
| `npm run fixtures:pdf-legacy-oracle` | totalDiffs 0 |
| pdfjs version 6.2.109 격리 음성 대조 | Vite 전 fail-closed: expected 6.2.108, received 6.2.109 |
| scoped/full bundle 비교 | 양방향 inventory 0 missing, 고정 상한 5종 통과 |
| `git diff --check` | 통과 |

도중 실패와 수리도 보존한다.

- 첫 full unit: 빈 `A11Y_PAGE_IDS`를 선택 목록으로 검증해 313/314에서 실패. 빈 값은 전체 실행으로 처리하도록 수정한 뒤 320/320 재통과.
- 첫 scoped a11y: 보고서 상위 디렉터리 미생성으로 실패. harness가 디렉터리를 만들게 한 뒤 통과.
- 첫 표시 복구 smoke: 새로고침 뒤 main/worker 여러 realm의 동일 URL 요청을 정확히 2회로 가정해 실패. 횟수가 아니라 고유 URL 1개와 복구 이후 요청 존재를 검사하도록 고쳐 통과.
- baseline 준비 1: baseline의 SEO API와 당시 정적 생성기 불일치로 실패. current/baseline 동일 현행 생성 절차로 경계를 고정.
- baseline 준비 2: 고정 commit의 video runtime 생성물이 없어 실패. 해당 commit의 vendor 생성 절차를 임시 baseline tree 안에서 실행한 뒤 재측정 성공.

## 산출물

- `/tmp/worklazy-u4-4-fix4/bundle-baseline-v3-static.json` — SHA-256 `ffc52532ffe730e2836f53e88a921d8baeb2500cf9e5d524cb7a70ada0e0bb9d`
- `/tmp/worklazy-u4-4-fix4/bundle-current-scoped.json` — SHA-256 `64ee7a822966db764aab5847cf918fd834388ea12c4f9a3ef48b5fd3583e83d6`
- `/tmp/worklazy-u4-4-fix4/bundle-current-full.json` — SHA-256 `94201b3561c4718f5e798a772f047d94b5c90c03ccf0b676a0846a7d48cdf8a9`
- `/tmp/worklazy-u4-4-fix4/performance.json` — SHA-256 `439c0c511c9ee254a52184b3ddda37a34ebb330ed947845006acd1dd622e4cb7`
- `/tmp/worklazy-u4-4-fix4/a11y-watermark.json` — SHA-256 `3e0437e4c0e62ce71c204c49d1d69aa6e47eec7de64eb871a47a9dd7074118e9`
- browser screenshots: `/tmp/worklazy-u4-4-fix4/pdf-finish-shots/`
- golden output: `/tmp/worklazy-u4-4-fix4/pdf-finish-golden/`

## 지시서상 유예 검증

merge-time에 실행할 full `test:browser`, `test:new-tools`, `test:utilities`, `test:office`, `test:qr-bulk`, `test:qr-font-render`, `test:recovery`, `test:static`, full a11y, `css:orphans`, `legacy:manifest`, `tool-registry-routes`는 이번 fix 범위에서 실행하지 않았다.
