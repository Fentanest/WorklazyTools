# U4-4 fix-2 구현 보고 — PDF 워터마크 응답성·오탐·가시성

- 작업 브랜치: `s3-pdf-finish`
- 기준 HEAD: `15bad33cfb569ee032ba90c4fe42b75c1c48cf73`
- 결과 커밋: `5a9d5b7b5c570ffa7ebb190b23f2e8d4d2aa4a2b` (`fix(pdf): keep watermark processing responsive`)
- main 병합/push/배포: 수행하지 않음
- 포트: 4280~4289 `--strictPort`만 사용, 종료 시 listener 없음
- 사용자 미추적 `after.docx`, `before.docx`, 네이버 확인 HTML, `newui/`: 열지 않고 stage/commit에서 제외

## 1. 결과 요약

정상 PDF의 52초 UI 정지를 일으킨 두 경로를 모두 수리했다.

1. PDF.js 6.2.108 RGB→RGBA remainder loop가 `srcPos`를 누락해 이후 chunk마다 앞 구간을 반복하던 문제를 modern/legacy의 full/minified 빌드에 hash 고정 패치했다.
2. 위험/결과 검사가 이미지 payload를 포함한 decoded content stream 전체를 문자열로 만들던 경로를 byte lexer와 cooperative decode/scan으로 바꿨다.

큰 미리보기 canvas는 OffscreenCanvas worker로 옮기되 PDF.js 표시 코드는 worker 본체에 중복 번들하지 않고, 패치된 고정 버전 `pdf.min.mjs` 해시 자산을 동적 로드한다. 업로드 검사·미리보기·PDF document/object URL을 같은 파일 lifecycle controller와 request token으로 묶어 제거/교체/unmount 뒤 늦은 상태·canvas·결과 등록을 차단했다.

## 2. 확정 성능 목표

조건: Chrome 152, 1280×900, DPR 1, CPU/network throttle 없음, 각 case 새 context, 11개 유효 PDF×3회 중앙값.

| 지표 | 수정 전 | 최종 | 목표 | 판정 |
|---|---:|---:|---:|---|
| 최대 heartbeat, 16MiB | 3.328초 | 67.185ms | ≤200ms | PASS |
| 최대 heartbeat, 32MiB | 13.083초 | 57.040ms | ≤200ms | PASS |
| 최대 heartbeat, 64MiB | 52.293초 | 67.590ms | ≤200ms | PASS |
| 외부 cancel click→UI | 파일 제거 약 50초 대기 | 101.806ms | ≤250ms | PASS |
| 총 처리시간 16/32/64MiB | heartbeat 제곱 증가 | 2.463/2.571/3.602초 | 준선형 | PASS, 64/16=1.46 |
| 결과 보존 | 약 52초 뒤 완료 | 세 curve 모두 source preview·overlay·download 존재 | 보존 | PASS |

- 11개 전체 중 최대 heartbeat 중앙값: **76.565ms**
- Long Task 중앙값: 11개 모두 **0ms**
- cancel 뒤 `staleCanvas=false`, `staleResult=false`, `retrySucceeded=true`
- 최종 원보고서: `/tmp/worklazy-u4-4-fix2/performance-final-optimized.json`
- 보고서 SHA-256: `daf80de564137fb1de250cdd4a69cf15c993894afb6af2caaa9d0e0fe5bfac41`
- fixture manifest SHA-256: `046cc7edf428971e6580b4bad873d001ed6af4b753b96bc48a24d1f3cbfa60ee`

대조 진단에서 전용 미리보기 worker를 제거하면 32/64MiB heartbeat 중앙값이 약 **219/387ms**로 회귀했다. 따라서 main-thread 호환 경로만 사용하는 안은 기각했다.

## 3. 의존 패치 재현성

- `pdfjs-dist` package 범위 `^6.2.108`을 정확 버전 `6.2.108`로 고정했으며 버전 자체는 올리지 않았다.
- `scripts/patches/pdfjs-dist-6.2.108-rgb-chunks.json`이 package version, 원본/결과 SHA-256, 치환 문자열과 정확히 2회인 occurrence를 기록한다.
- `scripts/apply-dependency-patches.mjs`가 원본만 패치하고 이미 패치된 결과는 idempotent 검증한다. 알려지지 않은 hash·횟수·버전은 fail-closed한다.
- `prepare`, `dev`, `prebuild`가 패치 적용/검증을 실행한다.
- `node_modules`, `public/vendor`, `dist`를 수기로 수정하지 않았다.

| 파일 | 원본 SHA-256 | 패치 SHA-256 |
|---|---|---|
| `build/pdf.mjs` | `487bde1bcf89e041f791173d0509a1dc18d0feb6655d78395e1611f9da0de17d` | `e0fac5c8abfe978d550ea1efc23bcd384bb4c9e1e5c91e13084cbb6d0ca69812` |
| `legacy/build/pdf.mjs` | `842284e0d1d439e60701e3355c2128cd3016ebebf14220e27f512467682aad66` | `36644d07144713ca05f8749012cf174afc7c94a50b08efd6966442741d830004` |
| `build/pdf.min.mjs` | `e0be3863c23c8af2305b16548febd58e7f8874a460253317d7771cddbc1c0f6d` | `a678944e8b233ef4ebe832ad08ff3ede55e8a7fee8c3e03a4f622a8caa5c6c5c` |
| `legacy/build/pdf.min.mjs` | `9fab0c910bf1484835c5c2aeb68f7eb3dfce7f9eb435a004526c5af86d70890c` | `377bcc2a9ca97fb68fcd6137955be0c8538573c02a708933121281c2f5f68da3` |

패치 manifest SHA-256: `8f6aaea47e122f7f85fc5f5d20251321f59b5652981817af70ccbdcc6880b8ef`.

## 4. stream scan·양보·취소

- byte scanner가 literal string, comment, hex, name, array/dictionary delimiter와 operator를 구분한다.
- raw unfiltered inline image는 W/H/BPC/CS/IM dictionary로 row stride와 payload 길이를 구해 payload를 건너뛴다.
- filter/unknown dictionary는 scan을 `uncertain`으로 표시하고 bounded fallback terminator 탐색을 한다.
- token은 최대 256 bytes, scan은 64KiB마다 macrotask 양보+abort 재검사한다.
- Flate `DecompressionStream`은 chunk 누적과 결과 copy 양쪽에서 1MiB마다 양보+abort 재검사한다.
- 분할할 수 없는 library fallback decode는 시작/끝 abort 및 결과 미등록 계약을 유지한다.
- 위험 검사와 결과 validator 양쪽이 같은 byte 경로를 사용한다. 생성한 작은 watermark marker stream 외에는 이미지 바이너리를 문자열화하지 않는다.
- 4MiB stream unit에서 `setTimeout(...abort...)`가 실제 실행되고 `AbortError`로 끝났다.

## 5. A3 반례 4건

| 반례 | 결과 |
|---|---|
| inline payload 안의 EI 유사 bytes | 597-byte payload와 astra 597B 원본 표본 모두 false risk/false clip 없이 정상 처리·download |
| 회전 이미지 완전 이탈 | 200×200 PDF, 100×50 PNG, tile 60%, 45°, offset 180은 `empty-placement`; create disabled·download 0 |
| 1-pixel 양성 대조 | 0°, offset 199는 placement 1개로 통과 |
| 공백/줄바꿈 텍스트 | `"   "`, `"\n\n"` 모두 ko/en `empty-text` template field error; create disabled·download 0 |
| 복잡한 clip/path 불확실성 | 확실한 zero rectangle만 fail. 불확실 fixture는 경고·명시 동의 뒤 output 1,376B; 완전 가시성은 주장하지 않고 미리보기/다운로드 확인 안내 유지 |

불확실 scan은 확정 empty clip의 증거가 아니다. 위험 문서를 일괄 거부하거나 자동 layer 교체하지 않는다.

## 6. 접근성 귀속

`[data-pdf-watermark-owned]` marker를 다음 실제 동적 표면에 적용했다.

- text/image 입력과 helper/error
- content/layer/pattern과 single position
- font/margin/color, rotation/opacity/size, tile gap/x/y offset
- preview disclaimer
- preflight checking/error/warnings
- risk confirmation

감사기는 selector 미발견, 빈 target, 해석 불가 target을 `shared-existing`으로 강등하지 않고 오류로 종료한다. 실제 text/image/error/risk DOM smoke의 unowned target은 0이다. 원본 a11y negative probe는 원본 통과와 6개 mutation 실패를 확인했다.

- local-QA 12페이지 axe violations: **0**
- incomplete: **F2 0 / inherited 925**
- external requests: **0**
- 보고서: `/tmp/worklazy-u4-4-fix2/a11y-final.json`

## 7. P3 2건

### 다중 줄 tile 상단 경계

font size, line height, placement height, tile 간격은 그대로 두고 Form XObject BBox 상단에 `max(1pt, size/32)`만 추가했다.

| 렌더러 | 수정 전 | 최종 |
|---|---:|---:|
| PDF.js | 14,520 / 10,972 | 14,520 / 10,972 (불변) |
| Poppler | 16,023 / 12,144 | 16,137 / 12,208 (상단 +20pt 대조와 일치) |

하단 확장 대조는 무변화였고 font size 축소나 tile spacing 변경은 하지 않았다.

### 내부 명칭 없는 안내

- ko: `미리보기는 페이지의 회전과 보이는 영역을 기준으로 위치를 대략 보여 줍니다. 저장한 PDF의 글자와 이미지가 조금 다를 수 있으니 다운로드 후 확인해 주세요.`
- en: `The preview shows approximate placement using the page rotation and visible area. Text and images may look slightly different in the saved PDF, so check it after downloading.`

화면의 PDF.js/UserUnit 내부 명칭은 제거했으나 기술 문서의 UserUnit 범위 설명은 유지했다.

## 8. 번들 5종

`BUNDLE_ROUTES=pdf-editor`, 고정 `/tmp/s3-bundle-baseline.json`, override 없음, multiplier 1.

| 지표(gzip) | 순증분 | 상한 | 판정 |
|---|---:|---:|---|
| entry JS | +7,177B | +20,480B | PASS |
| affected PDF route JS | +22,750B | +61,440B | PASS |
| shared JS, movement 제외 | +3,068B | +30,720B | PASS |
| app JS | +33,786B | +81,920B | PASS |
| CSS | +235B | +10,240B | PASS |

QR/image-studio→shared 이동 509,794B는 순증분과 분리했다. 첫 정적 worker import 대조는 shared +153,800B, app +184,494B로 실패해 기각했다. 최종은 worker 1.67kB와 패치된 `pdf.min.mjs` 해시 자산으로 분리해 통과했다.

- 최종 보고서: `/tmp/worklazy-u4-4-fix2/bundle-final.json`
- module attribution: `/tmp/worklazy-u4-4-fix2/bundle-modules-final.json`
- 보고서 SHA-256: `b696764f75359f839dbb7317ae049832cca190e72f22e3622c415e67f542ad2f`

## 9. 시각 기준선 변경 24개

변경 사유는 세 finish interaction 화면의 ko/en 사용자 안내 문구와 그 줄흐름뿐이다. 공식 생성기로 다음 3 scenario × 2 locale × 2 theme × 2 viewport를 갱신했다.

```text
pdf-finish-page-numbers__interaction__en__light__desktop.png
pdf-finish-page-numbers__interaction__en__light__mobile.png
pdf-finish-page-numbers__interaction__en__dark__desktop.png
pdf-finish-page-numbers__interaction__en__dark__mobile.png
pdf-finish-page-numbers__interaction__ko__light__desktop.png
pdf-finish-page-numbers__interaction__ko__light__mobile.png
pdf-finish-page-numbers__interaction__ko__dark__desktop.png
pdf-finish-page-numbers__interaction__ko__dark__mobile.png
pdf-finish-header-footer__interaction__en__light__desktop.png
pdf-finish-header-footer__interaction__en__light__mobile.png
pdf-finish-header-footer__interaction__en__dark__desktop.png
pdf-finish-header-footer__interaction__en__dark__mobile.png
pdf-finish-header-footer__interaction__ko__light__desktop.png
pdf-finish-header-footer__interaction__ko__light__mobile.png
pdf-finish-header-footer__interaction__ko__dark__desktop.png
pdf-finish-header-footer__interaction__ko__dark__mobile.png
pdf-finish-watermark__interaction__en__light__desktop.png
pdf-finish-watermark__interaction__en__light__mobile.png
pdf-finish-watermark__interaction__en__dark__desktop.png
pdf-finish-watermark__interaction__en__dark__mobile.png
pdf-finish-watermark__interaction__ko__light__desktop.png
pdf-finish-watermark__interaction__ko__light__mobile.png
pdf-finish-watermark__interaction__ko__dark__desktop.png
pdf-finish-watermark__interaction__ko__dark__mobile.png
```

- `LANG=ko_KR.UTF-8`: **211/211 PASS**
- `LANG=en_US.UTF-8`: **211/211 PASS**

## 10. astra 원본 probe

원본 SHA를 확인하고 probe/review 산출물을 수정하지 않았다. 4270과 검수 경로를 하드코딩한 브라우저 probe에는 bwrap read-only mapping과 4280→4288 same-origin proxy adapter만 사용했다.

| probe | 결과 |
|---|---|
| `resume-performance.mjs` | 원본 SHA 일치, 실행 종료 0. Node direct renderer 최장 gap 64MiB 1.399초(기존 52초 대비 축소); 실제 제품 browser 목표는 별도 11×3 하네스가 통과 |
| `adversarial-engine.mjs` | 종료 0, inline false risk 없음, termination 확인 |
| `cancel-fuzz.mjs` | 종료 0; 1,256 fuzz max 1.921ms; direct abort 26.13ms/UI 0.319ms; full engine abort 52.22ms/UI 1.18ms; retry 성공 |
| `render-new.mjs`, `bbox-controls.mjs` | 종료 0, 원본 SHA 일치; P3 exact metrics 확인 |
| `contracts-new.mjs` | 종료 0, 원본 SHA 일치. 구 cancel 관찰 대신 cancel-fuzz의 현행 계약을 판정 근거로 사용 |
| `a11y-aggregation-negative` | 종료 0, 원본 통과+6 mutation 실패 |
| `browser-focused.mjs` | 종료 0; whitespace, rotated edge, uncertain output, 4 a11y states, large32 profile 확인 |
| `browser-new.mjs` | 구 계약이 597B 정상 파일의 risk-confirmation click을 기대해 해당 지점 종료. false risk 제거의 성공 관찰이며 PASS로 세지 않음 |
| `golden-recount-all` | 독립 파일 없음. 현행 generator/test가 160/160 직접 재집계 |

격리 자료: `/tmp/worklazy-u4-4-fix2/probe-sandbox/`.

## 11. 전체 회귀표

| 명령/영역 | 최종 결과 |
|---|---|
| `npm run prepare` | 6.2.108 full/min modern/legacy hash·occurrence 검증 PASS |
| `npx tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | **318/318 PASS**, fail/skip 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | **2,847 modules**, 정적 **69페이지** 생성 PASS |
| `npm run test:static` | localized/SEO/self-hosted runtime/startup recovery **116** PASS |
| `npm run test:pdf-finish` | 16 direct entries, 48 preview placements, A3/lifecycle/output/retry PASS |
| watermark golden | PDF.js+Poppler 기존 image 128 + text 32 = **160/160 PASS** |
| `TEST_SCOPE=pdf npm run test:browser` | PASS |
| 전체 `npm run test:browser` | Excel/Word/PDF/shared UI PASS |
| `npm run test:new-tools` | HWP/Image/Audio/Video PASS; host Dolby Vision capability skip은 결정적 fallback 검증 PASS |
| utilities / office | PASS |
| QR bulk / QR font render | PASS; font 3 fixture changed pixels 0 |
| recovery | **147 cases PASS** |
| legacy oracle | client 3, structure 4, render 32, output 4, input 1, **diff 0** |
| Excel Cleaner / Compare | cancellation·retry·report·mobile PASS |
| visual ko/en | 각각 **211/211 PASS**, 실제 변화 24개만 갱신 |
| local-QA a11y | 12 pages, violations 0, F2 incomplete 0, external 0 |
| rendering | 7 pages×3, external 0, finish 계열 CLS max **0.0001480366** |
| scoped bundle | 위 5종 모두 PASS |
| CSS orphan | 0 arms |
| legacy manifest | 155 rules / 153 removed / 0 split / 2 active |
| tool registry | 20, missing/unexpected/duplicate 0 |
| `git diff --cached --check` | PASS |

반복된 PDF.js `standardFontDataUrl` 경고는 기존 환경 경고이며 두 렌더러 골든과 결과 검증은 통과했다.

## 12. 종료 상태

- 커밋 뒤 tracked working tree 변경 없음.
- 남은 status는 사용자 소유 untracked 4종뿐이다.
- 4280~4289 listener 없음.
- `/tmp/worklazy-u4-4-fix2/REPORT.md` 작성 및 존재 확인 완료.

— Codx
