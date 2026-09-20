# S2b QR 라벨 PDF 한글 폰트 감량 구현 보고

- 작업 브랜치: `s2b-qr-font`
- 기준: `main=f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e`
- 최종 HEAD: `93a2318d445d78e5283b48be993578f7f061b96c`
- 정지점: 브랜치 커밋·전체 게이트·QA `dist` 완료. main 병합·push 없음.

## 착수 게이트 원문

```text
$ git rev-parse HEAD main origin/main
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
1a04f2571109495a76b8468af95b2f4edcd862cf

$ git status --short
 M AGENTS.md
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html
```

`PROJECT_RULES.md` 전문 → 디스패치 → 워킹트리 `AGENTS.md` → 정본 「v3 확정」·「정본화 보강」 → 로드맵 결정 10·11/C-A~C-D → R3 보고서·draft·regen-a 고정 자산 → 관련 운영/기각 기록 순서로 읽었다. 열린 계획서 16개를 검색해 이번 표면과 상반된 현재 지시가 없음을 확인했다. U4의 미래 공용 `pdfFontEmbed`가 들어오면 U4 import 경계가 우선이라는 계약도 확인했다.

`s2b-qr-font`를 main에서 분기한 뒤 첫 커밋은 기존 `AGENTS.md` 변경만 포함했다.

```text
c680030 docs: add Codex model role assignment to AGENTS.md
```

## 구현 A~D

### A. 자산·벤더

- 정본 `regen-a`와 byte equality가 있는 생성 입력 5개를 `scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/`에 추적했다.
- `scripts/build-qr-label-font-subset.py`와 hash-pinned `scripts/requirements-fonts.txt`를 추가했다.
- 재생성은 fontTools 4.59.2, GNU gzip 1.12, 원본/목록/출력 SHA, cmap exact 3,394, GID·hmtx·outline 차이 0을 요구한다.
- 일반 Node vendor는 gzip/coverage/provenance를 먼저 fail-closed 검증하고 bounded gunzip한다. 전체 OTF/OFL까지 검증한 후 staging에서 소유 snapshot 두 개만 교체하며 rollback한다.
- public subset snapshot은 생성물로 ignore하고 `docs/OFFICE_EDITOR_ASSETS.md`에 역할별 해시표와 재생성 절차를 기록했다.

고정값:

| 항목 | 바이트 | SHA-256 |
|---|---:|---|
| 전체 OTF | 4,644,748 | `69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68` |
| subset OTF | 931,704 | `b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be` |
| subset gzip 추적 입력 | 561,161 | `e1db3cdcbb8d76fc0546ec582bed773b3b7ef3da60867b6828493a6b342c7e66` |
| Unicode 목록 | 23,757 | `ac8fefb54a969022fc1b139a3a7a1937f711e71280fb992683eb0d4d43978b0c` |
| coverage | 19,686 | `58f248442d4e8e5726559644a746740bd0066cebabf154956e0bb7e1458eafea` |

raw OTF는 79.94%, 고정 gzip은 84.97% 감소했다. 추적 생성 입력 합계는 606,249B다.

### B. 제품 코드

- `qrLabelFont.ts`: 엄격 coverage guard, 원문+NFC 선택, 8,192 codepoint/8ms task 양보, panel별 lazy loader, 두 asset size/SHA cache, optional AbortSignal, subset 자산 오류의 full 1회 폴백.
- `QrBulkPanel.tsx`: ZIP/PDF 공용 동기 export lease, storage/results/preset snapshot, busy 중 PDF 비활성, cancel/run/cleanup/unmount invalidation, 최종 Blob 뒤 token 재검사. 폰트/PDF helper/PNG 읽기 클릭 후 병렬화.
- `qrLabelPdf.ts`: `registerFontkit`/`embedFont`만 `QrLabelFontInitError`; PDF 생성·PNG·draw·save는 typed 경계 밖. subset typed 실패만 같은 PNG entries로 full 1회 재생성.
- `QR_LABEL_FONT_PATH`는 기존 전체 OTF 의미·경로·바이트를 보존했다. 사용자 문구는 변경하지 않았다.

### C. 테스트·계측

- `tests/unit/qr-label-font.test.ts`: schema, 원문+NFC, 현대 한글 NFD 11,172 전수, task yield/Abort, cache/실패/dispose, typed 경계, export lease 정적 계약 10건.
- `tests/qr-font-scenarios.mjs`: `subset|full|corrupt`, 기본값/오타 거부, PDF embedded OTF 추출, 실제 HTTP proxy 손상 주입.
- QR smoke는 기존 취소·재실행·7 payload·ZIP·manifest를 보존하고 3시나리오 PDF count/size/SHA를 검사한다.
- QR metrics는 scenario별 새 브라우저/NetLog 보고서와 embedded font 결과를 기록한다.
- `test:qr-font-render`는 sample/inventory/expanded 전체/subset PDF를 Poppler RGBA와 PDF.js extraction으로 대조한다.

### D. 기록

- `CHANGELOG.md`: 코드 변경을 Codx로 기록.
- `docs/review-notes.md`: 공급/레시피/전송/번들/렌더/실패/제품 규칙 근거 기록.
- `docs/backlog.md`: Ghostscript tofu descriptor 경계와 PDF.js 기존 추출 오류를 U4 관련 후속으로 이관.
- `docs/OFFICE_EDITOR_ASSETS.md`: 전체/subset/입력/coverage/provenance/tool lock 역할별 표.

## 전송량 전후

조건: QA production, Chrome 152, fresh browser/context, SW block, cache off, 무스로틀 local preview, NetLog encoded response body+HTTP headers. 이전 S2 PDF 단계는 5,153,562B, JS gzip 508,018B, 누적 6,067,785B.

| scenario | font request | PDF stage requests | PDF stage transfer | 이전 대비 | cumulative | output PDF | embedded |
|---|---|---:|---:|---:|---:|---:|---|
| subset | subset | 3 | 1,450,793B | −3,702,769B / −71.85% | 2,365,596B | 603,829B | 931,704B / `b84d27a5…a252be` |
| full | full (`똠`) | 3 | 5,163,839B | +10,277B / +0.20% | 6,078,642B | 3,854,300B | 4,644,748B / `69975a0a…148d68` |
| corrupt | corrupt subset → full | 4 | 6,095,694B | +942,132B / +18.28% | 7,010,497B | 3,854,297B | 4,644,748B / `69975a0a…148d68` |

각 PDF의 raw embedded OTF stream은 정확히 1개였다. subset/full identity 전송은 각각 932,057B/4,645,103B다. 모든 font request는 PDF stage에서만 시작했고 cache/SW hit와 외부 요청은 0이었다. 상세 JSON: `/tmp/worklazy-s2b/qr/{subset,full,corrupt}/metrics.json`.

## 렌더 회귀

| fixture | preset / entries / pages | full PDF | subset PDF | compared pixels | changed | PDF.js full vs subset |
|---|---|---:|---:|---:|---:|---|
| sample | A4 / 25 / 2 | 3,979,131B | 728,659B | 4,011,288 | 0 | identical |
| inventory | A4 / 155 / 7 | 4,742,244B | 1,491,805B | 14,039,508 | 0 | identical |
| expanded | Letter / 170 / 8 | 4,829,717B | 1,579,298B | 15,510,528 | 0 | identical |

총 17페이지·33,561,324픽셀에서 차이 0. 결과: `/tmp/worklazy-s2b/render-final/results.json`.

Poppler의 반복 `Mismatch between font type and embedded font file`, Ghostscript의 원본 전체 OTF부터 발생하는 한글 tofu, PDF.js의 입력 대비 일부 추출 오류는 기존 pdf-lib descriptor/ToUnicode 경계다. 이번 oracle은 Poppler full-vs-subset 픽셀 0과 PDF.js full-vs-subset 동일이며 기존 결함 수리는 backlog로 이관했다.

## 번들 5종

분기점 production `/tmp/s2b-bundle-baseline.json` 대비 production, override 없음, multiplier 1, 신규 route 없음, route→shared 이동 0B.

| metric | baseline | branch | delta | limit | result |
|---|---:|---:|---:|---:|---|
| entryJsGzip | 299,283 | 299,287 | +4 | 20,480 | PASS |
| affectedRouteJsGzip | 2,440,427 | 2,450,827 | +10,400 | 61,440 | PASS |
| sharedJsGzip | 2,716,489 | 2,716,473 | −16 | 30,720 | PASS |
| appJsGzip | 5,456,199 | 5,466,587 | +10,388 | 81,920 | PASS |
| cssGzip | 37,687 | 37,687 | 0 | 10,240 | PASS |

보고서: `/tmp/worklazy-s2b/bundle-final.json`.

## 완료 기준 검증

모든 명령 exit 0. 시간은 Codex 실행 wall time의 약값이다.

| command | exit | duration | result / artifact |
|---|---:|---:|---|
| baseline `npm run bundle:measure` | 0 | ~77s | `/tmp/s2b-bundle-baseline.json` |
| `npm run build` | 0 | ~88s | production vendor+tsc+Vite+61 pages |
| `npx tsc -b --pretty false` | 0 | ~20s | 0 diagnostics |
| `npm run test:unit` | 0 | 3.3s | 241/241 |
| `npm run test:qr-bulk` | 0 | ~41s | 3 fonts + preserved QR/ZIP/manifest contract |
| `npm run test:utilities` | 0 | ~92s | ko/en utilities |
| `npm run test:static` | 0 | 1.3s | localized/static/runtime, startup 104 docs |
| `npm run test:browser` | 0 | ~49s | Excel/Word/PDF |
| `npm run test:new-tools` | 0 | ~100s | HWP/Image/Audio/Video |
| `npm run test:office` | 0 | 25.3s | 96 download, 7 cache, DOCX 5,089B |
| `npm run test:recovery` | 0 | ~270s | 147/147 desktop+Android |
| `LANG=ko_KR.UTF-8 … npm run test:visual` | 0 | 105.75s | 175/175, no baseline update |
| `LANG=en_US.UTF-8 … npm run test:visual` | 0 | 105.33s | 175/175, no baseline update |
| `VITE_LOCAL_QA=1 npm run build` | 0 | ~85s | final `dist`, 61 pages |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 0 | 28.4s | 8 pages, violations/external 0 |
| `npm run test:rendering` | 0 | ~41s | 3 pages × 3, max CLS 0, external 0 |
| baseline comparison `npm run bundle:measure` | 0 | ~74s | all five limits PASS |
| `npm run css:orphans` | 0 | 1.5s | 0 orphan selector arms |
| `npm run legacy:manifest` | 0 | 0.3s | 153 removed / 0 split / 2 active |
| `node tests/tool-registry-routes.mjs` | 0 | 0.5s | 20 expected, no missing/unexpected/duplicate |
| `git diff --check` | 0 | <0.1s | no whitespace error |
| three `npm run measure:qr -- --scenario=…` | 0 | ~11s each | `/tmp/worklazy-s2b/qr/` |
| `npm run test:qr-font-render` | 0 | ~33s | 3/3, pixels 0, extraction identical |
| `/tmp` venv subset regeneration | 0 | — | cmap 3394, 931704B, gzip 561161B, glyph differences 0 |
| clean `npm ci` with `/tmp` cache | 0 | 22.5s | 775 packages |
| clean `npm run vendor:qr-font` twice | 0 | 0.14s each | 9 files including unowned sentinel, identical SHA |
| clean `npm run build` | 0 | ~93s | Python-free subset supply, 61 pages |

원문 로그: `/tmp/worklazy-s2b/logs/`.

## 실행 중 실패와 판정

- subset regeneration 최초 실행은 `/tmp`→repo `os.replace`에서 `EXDEV`; 입력 불변 확인 후 같은 filesystem staging으로 수정해 재현 성공.
- 첫 QR smoke는 결과가 보이는 즉시 PDF를 클릭해 새 `busy` disabled 계약에 걸림; 제품을 완화하지 않고 enabled 대기를 추가.
- PNG typed-boundary 음성 unit은 pdf-lib raw thrown value를 `Error`로 가정해 실패; `QrLabelFontInitError`가 아님만 검사하도록 정정.
- clean worktree 첫 `npm ci`는 home npm cache read-only `EROFS`; `/tmp/worklazy-s2b/npm-cache`로 재시도해 성공.
- port 4188은 기존 preview가 점유; 제품과 분리된 4190 preview로 브라우저 게이트 실행.
- Vite `vm-browserify` eval/chunk size, Poppler descriptor, HWP/BoxParser 메시지는 기존 경고이며 각 실제 판정은 통과.

## 제품 규칙

| contract | result | evidence |
|---|---|---|
| GitHub Pages static only | PASS | client/helper/build assets only; API/SSR/server runtime 0 |
| ko/en + internal names hidden | PASS | user copy changes 0; asset errors use existing localized PDF error |
| SEO/static/sitemap | PASS | route/SEO input changes 0; production static gate and 61 pages |
| ads/analytics isolation | PASS | boundary code unchanged; QA a11y/rendering and QR tests external 0 |
| generated asset rule | PASS | public subset and dist generated only; tracked inputs under scripts/assets |
| dependencies | PASS | npm deps unchanged; Python tool only temporary hash-pinned venv |
| original full font | PASS | path, 4,644,748B, SHA unchanged |
| user files | PASS | three initial untracked files remain untracked |

## 후보 판정·범위 밖 발견

- Brotli stream은 일부 최신 브라우저에 있으나 Chrome 152 미지원, full OTF q11 절감 14.85% 대 subset gzip 84.97%, 별도 fallback 비용 때문에 미채택.
- 클릭 후 font/helper/PNG parallelism만 채택. 클릭 전 prefetch는 전송 감량이 없어 미채택.
- CSV ExcelJS/JSZip 분리, qrLabelPdf 508KB chunk, U4 common font boundary, jszip removal, runtime subset, GS/PDF.js defect repair는 명시 제외.
- full OTF/OFL은 cache가 없으면 pinned upstream fetch를 사용한다. subset supply만 Python/network independent이며 완전 offline full supply는 주장하지 않는다.
- 새 제품 범위 밖 결함은 발견하지 않았다. 기존 descriptor/PDF.js 문제만 backlog에 기록했다.

## QA 검수 안내

최종 `dist`는 `VITE_LOCAL_QA=1 npm run build` 산출이다.

```bash
npm run preview -- --host 127.0.0.1 --port 4190 --strictPort
```

- `/ko/tools/qr-studio/bulk`
- `/en/tools/qr-studio/bulk`
- KS X 1001 범위 라벨: subset 경로
- 범위 밖 예: 첫 제목에 `똠`: full 경로
- corrupt 자동 검증: `npm run test:qr-bulk` 또는 `npm run measure:qr -- --scenario=corrupt`

최종 dist 폰트:

```text
931704  b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be  subset
4644748 69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68  full
```

## 최종 Git 원문

```text
$ git status --porcelain
?? after.docx
?? before.docx
?? naver05161fb06bc9701a23cfc09ad5773578.html

$ git log --oneline main..s2b-qr-font
93a2318 docs: record S2b font reduction evidence
0198036 feat: reduce QR label PDF font transfers
ae1feea build: vendor pinned QR label font subset
c680030 docs: add Codex model role assignment to AGENTS.md

$ git diff --stat main..s2b-qr-font
 .gitignore                                         |   1 +
 AGENTS.md                                          |   8 +
 CHANGELOG.md                                       |   1 +
 docs/OFFICE_EDITOR_ASSETS.md                       |  25 +-
 docs/backlog.md                                    |   6 +-
 docs/review-notes.md                               |  86 +++++++
 package.json                                       |   1 +
 .../NotoSansKR-Regular.ksx1001.otf.gz              | Bin 0 -> 561161 bytes
 .../noto-cjk-sans-2.004-ksx1001-v1/coverage.json   |   1 +
 .../coverage.schema.json                           |   1 +
 .../noto-cjk-sans-2.004-ksx1001-v1/provenance.json |   1 +
 .../unicodes-alias.txt                             |   1 +
 scripts/build-qr-label-font-subset.py              | 266 +++++++++++++++++++++
 scripts/requirements-fonts.txt                     |   1 +
 scripts/vendor-qr-label-font.mjs                   | 116 ++++++---
 src/features/qr-studio/QrBulkPanel.tsx             | 171 ++++++++++---
 src/features/qr-studio/qrLabelFont.ts              | 144 +++++++++++
 src/features/qr-studio/qrLabelPdf.ts               |  30 ++-
 tests/qr-bulk-smoke.mjs                            |  57 +++--
 tests/qr-font-render-regression.mjs                | 153 ++++++++++++
 tests/qr-font-scenarios.mjs                        |  83 +++++++
 tests/qr-stage-metrics.mjs                         |  27 ++-
 tests/unit/qr-label-font.test.ts                   | 265 ++++++++++++++++++++
 23 files changed, 1341 insertions(+), 104 deletions(-)
```

Final refs:

```text
main        f29d249d5d57c5fa7b68b8d87b84a20b8af43e7e
origin/main 1a04f2571109495a76b8468af95b2f4edcd862cf
HEAD        93a2318d445d78e5283b48be993578f7f061b96c
```
