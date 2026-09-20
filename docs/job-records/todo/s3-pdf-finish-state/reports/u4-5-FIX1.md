# U4-5 fix-1 구현 보고서

- 작업 브랜치: `s3-pdf-finish`
- 기준 HEAD: `8ec3e4edd97439dfc5b7807645d22c8373d69d11`
- 실행일: 2026-09-08 (Asia/Seoul)
- 작성: Codx
- 범위: R1 도장 미리보기 실제 픽셀 불일치, R2 F3 접근성 게이트 누락

## 실행 게이트와 보존 범위

`PROJECT_RULES.md`를 첫 행동으로 전문 확인한 뒤 `AGENTS.md`, fix-1 지시서, astra 검수 보고와 R1/R2 evidence 및 원본 probe, U4-5 착수 지시서, PDF finish 정본·기각 이력을 읽었다. branch와 HEAD는 지시와 일치했고 열린 계획서와 동일 표면의 충돌은 없었다.

사용자 소유 변경 `CLAUDE.md`, `PROJECT_RULES.md`와 미추적 `before.docx`, `after.docx`, `naver05161fb06bc9701a23cfc09ad5773578.html`, `newui/`는 수정·stage하지 않았다. `/tmp/worklazy-xd*`, `/tmp/worklazy-xr*`, `/tmp/worklazy-dc-impl`에는 접근하지 않았고 `/tmp/worklazy-u4-5-review`는 읽기만 했다. main 병합·push·배포는 하지 않았다. 서버는 `--strictPort`와 허용 범위 4280~4289만 사용했고 종료 뒤 listener 0을 확인했다.

## R1 — 미리보기 선택 표시

### 원인과 수리

`PdfStampOverlay`의 model box에 `border-2`가 적용되어 네 변에서 내부 2px씩을 차지했고, `h-full w-full` 이미지가 줄어든 content box에 다시 맞춰졌다. 좌표 모델과 PDF 출력은 올바르지만 실제 화면 이미지만 작아졌다. 선택 표시를 model box 외부의 `outline-solid outline-2`로 옮겨 이미지가 model box 전체를 차지하게 했다.

종전 `tests/pdf-stamp-golden.mjs` 16조합은 실제 브라우저 canvas를 캡처하지 않고 계산한 CSS/viewport 사각형을 출력 좌표와 비교했다. 따라서 “실제 미리보기와 출력이 맞는다”는 종전 주장은 기각한다. 기존 순수 좌표·PDF.js/Poppler 검증은 유지하면서 같은 정규 테스트에 실제 브라우저 픽셀 골든을 추가했다.

### 실제 화면 fixture와 등록 위치

- 등록: `tests/pdf-stamp-golden.mjs` (`npm run test:pdf-finish`의 정규 경로)
- MediaBox: `400×600`, `800×500`, `600×400`, `500×800`
- CropBox: `[20,35,350,510]`, `[45,30,680,410]`, `[30,25,520,330]`, `[40,55,400,680]`
- 회전: `0/90/180/270`
- UserUnit: `1/1.25/1.5/2`
- 조합: 실제 Chrome DPR `1/2` × canvas CSS 폭 배율 `1/0.5` × 회전 4종
- 절차: PDF·PNG 업로드 → 실제 pointer drag/resize → canvas area를 device pixel screenshot → UI의 다운로드 PDF를 같은 표시 폭·bitmap 크기로 PDF.js 렌더 → 적색 도장 pixel bounding box 비교
- 구조 단언: overlay border `0px`, outline `2px`, image/model box 각 변 오차 `<0.1px`, 실제 `devicePixelRatio`, canvas backing 폭 `520/1040px`

### 16조합 preview − output 수치

각 벡터는 CSS px의 `[x, y, width, height]`이며 마지막 열은 절댓값 최대다.

| DPR | CSS 배율 | 회전 | 수리 전 벡터 / max | 수리 후 벡터 / max |
|---:|---:|---:|---:|---:|
| 1 | 1 | 0 | `[5,2,-8,-3]` / 8 | `[1,0,0,1]` / 1 |
| 1 | 1 | 90 | `[5,2,-8,-4]` / 8 | `[1,0,0,0]` / 1 |
| 1 | 1 | 180 | `[5,3,-8,-5]` / 8 | `[1,0,0,0]` / 1 |
| 1 | 1 | 270 | `[5,2,-8,-3]` / 8 | `[1,1,0,-1]` / 1 |
| 1 | 0.5 | 0 | `[5,2,-8,-4]` / 8 | `[1,0,0,0]` / 1 |
| 1 | 0.5 | 90 | `[4,3,-7,-5]` / 7 | `[0,0,1,1]` / 1 |
| 1 | 0.5 | 180 | `[5,2,-8,-4]` / 8 | `[1,0,0,0]` / 1 |
| 1 | 0.5 | 270 | `[4,2,-7,-4]` / 7 | `[0,0,1,0]` / 1 |
| 2 | 1 | 0 | `[5,2.5,-8.5,-4]` / 8.5 | `[1,0.5,-0.5,0]` / 1 |
| 2 | 1 | 90 | `[4.5,2,-8,-4]` / 8 | `[0.5,0,0,0]` / 0.5 |
| 2 | 1 | 180 | `[5,2.5,-8.5,-4]` / 8.5 | `[1,0,-0.5,0]` / 1 |
| 2 | 1 | 270 | `[4.5,2,-8,-3.5]` / 8 | `[0.5,0.5,0,0]` / 0.5 |
| 2 | 0.5 | 0 | `[5,2,-8.5,-3.5]` / 8.5 | `[1,0,-0.5,0.5]` / 1 |
| 2 | 0.5 | 90 | `[4,2.5,-7.5,-5]` / 7.5 | `[0,0.5,0.5,0]` / 0.5 |
| 2 | 0.5 | 180 | `[4.5,2,-8,-3.5]` / 8 | `[0.5,0,0,0]` / 0.5 |
| 2 | 0.5 | 270 | `[4,2.5,-7.5,-4.5]` / 7.5 | `[0,0,0.5,0]` / 0.5 |

수리 전 16/16 불일치(최대 8.5px), outline control과 최종 정규 골든은 16/16 `≤2px`(최대 1px)다. 최종 원자료는 `golden-official/metrics.json`, 실제 preview/output PNG와 다운로드 PDF로 보존했다.

### 좌표 모델·출력 엔진 무변경 증명

`src/features/pdf-editor/finish/{engine,stamp,geometry,...}.ts`에는 diff가 없다. 동일 fixture와 입력으로 정규 golden을 수정 전과 수정 후 각각 실행한 출력 PDF는 byte-identical하다.

| 출력 | 수정 전 SHA-256 | 수정 후 SHA-256 |
|---|---|---|
| all pages | `3831baa3abd1817e83f56928be578a7061f3686179e670475a43abf789568156` | `3831baa3abd1817e83f56928be578a7061f3686179e670475a43abf789568156` |
| selected pages | `12ad29d42e992cd545ca78129f45ebffc5c6d0997ec5c6f4ea038f5850df8548` | `12ad29d42e992cd545ca78129f45ebffc5c6d0997ec5c6f4ea038f5850df8548` |

기존 순수 좌표 16조합, PDF.js/Poppler 8페이지, 선택 출력 `[true,false,true,false]`도 통과했다.

## R2 — F3 접근성 감사 게이트

### 분류기·기본 상태

- 새 owner: `f3-stamp`
- 새 selector: `[data-pdf-stamp-owned]`
- 정확히 1개여야 하는 marker: stamp tab, notice, settings의 image input, 실제 stamp overlay
- 기본 편집 상태: `pdf-stamp-editing-{ko,en}-{light,dark}` 4개
- 각 상태에서 ordinary PDF와 생성 PNG를 업로드하고 overlay/preflight 완료 뒤 F3 범위만 Axe 감사
- stamp notice title/body를 별도 test id로 식별하고 실제 렌더 배경 픽셀 전수 대비를 수집
- F3 incomplete는 shared-existing으로 빠질 수 없고, `measured-pixel`은 원 target/reason, owner와 고유 measurement target이 모두 있을 때만 해소

범위 감사 10페이지 결과는 violations 0, F3 incomplete 0, pixel-resolved incomplete 14, inherited incomplete 247, 외부 요청 0이다. 편집 상태별 Axe는 passes 24, violations 0, unresolved incomplete 0, F3 pixel-resolved 2, marker 네 대상 각각 1개다.

| 편집 상태 | body 실제 최저 대비 | title 실제 최저 대비 |
|---|---:|---:|
| ko light | 5.8648:1 | 14.6179:1 |
| ko dark | 13.0790:1 | 17.3805:1 |
| en light | 5.8648:1 | 14.5232:1 |
| en dark | 13.0790:1 | 17.2436:1 |

모두 4.5:1 이상이다. 이번 결함은 대비 결함이 아니라 F3 owner와 편집 상태가 기본 게이트에 없었던 결함이며 shared debt로 면제하지 않는다.

### 음성 검증 4종 원출력

실행 명령:

```text
node --test --experimental-strip-types --test-name-pattern='a11y F3 gate fails closed' tests/unit/accessibility-audit.test.ts
```

원출력 핵심:

```text
# Subtest: a11y F3 gate fails closed when a required ownership marker is removed
ok 1 - a11y F3 gate fails closed when a required ownership marker is removed
# Subtest: a11y F3 gate fails closed when an owned target cannot be found
ok 2 - a11y F3 gate fails closed when an owned target cannot be found
# Subtest: a11y F3 gate fails closed when an editing-state result is omitted
ok 3 - a11y F3 gate fails closed when an editing-state result is omitted
# Subtest: a11y F3 gate fails closed while an owned incomplete result remains unresolved
ok 4 - a11y F3 gate fails closed while an owned incomplete result remains unresolved
1..4
# tests 4
# pass 4
# fail 0
```

또한 astra 원본 `a11y-gate-probe.mjs`가 실제 notice title/body unresolved 노드 2개를 old shared 형식으로 주입한 결과:

```text
actualUnresolvedF3Nodes: 2
currentGateAcceptedUnresolvedF3: false
error: F3 stamp editing incomplete node lost ownership: pdf-stamp-editing-probe/color-contrast.
```

## Astra 원본 probe 재현

원본 SHA-256:

- `golden-ui.mjs`: `4dbc705124f2a37b8a492210f04145890ad5d766c6b36b80de1f61e70803580c`
- `verify-golden.mjs`: `86ff1ecf452e9489f8722a5383e091dbc898dc13171a50d6cfbbcc2c185ac45a`
- `a11y-gate-probe.mjs`: `22c3ff3f1a322070e466355bc034bd5e4230a6bce7d94546a2518f80f991866c`

원본 probe는 4271 포트, review 경로 쓰기, 이전 archive의 audit import를 하드코딩해 현재 지시의 4280~4289 `--strictPort`와 review read-only 규칙을 동시에 지킬 수 없었다. 원본 파일은 수정하지 않고 `/tmp/worklazy-u4-5-fix1/astra-probe-{adapter,loader}.mjs`로 실행 시 포트만 4283, 출력만 fix1 디렉터리, audit import만 현재 워크트리로 연결했다. 결과는 UI golden 16개, verify failed 0/max 1px, F3 probe 거절이다. review의 종전 UI metrics는 여전히 max 8.5px다. 어댑터 준비 중 첫 두 실행은 Playwright module resolution과 ESM module identity 연결을 잘못해 실패했고 제품 결함이 아니며, 최종 위 SHA의 원본 source 실행으로 교정했다.

## 시각 기준선

선택 border를 외부 outline으로 바꿔 실제 픽셀이 달라진 stamp interaction 9장만 갱신했다.

- `pdf-finish-stamp__interaction__en__dark__desktop.png`
- `pdf-finish-stamp__interaction__en__dark__mobile.png`
- `pdf-finish-stamp__interaction__en__light__desktop.png`
- `pdf-finish-stamp__interaction__en__light__mobile.png`
- `pdf-finish-stamp__interaction__en__light__mobile-320.png`
- `pdf-finish-stamp__interaction__ko__dark__desktop.png`
- `pdf-finish-stamp__interaction__ko__dark__mobile.png`
- `pdf-finish-stamp__interaction__ko__light__desktop.png`
- `pdf-finish-stamp__interaction__ko__light__mobile.png`

최초 비교에서 390px mobile 4장은 각각 782px/0.2376%, en light 320px는 587px/0.2173% 차이로 실패했다. desktop 4장도 임계치 0.1% 아래지만 실제 선택선 픽셀이 변했으므로 공식 filtered update로 9장 모두 갱신했고 최종 9/9가 일치했다. 대표 desktop/mobile과 diff를 직접 열어 선택선·핸들 주변 외 레이아웃 변화가 없음을 확인했다.

## 축소 불가 4항

1. **reversal hunt**: 정규 PDF finish smoke의 20개 직접 진입, preflight, preview 48, watermark/stamp drag·resize·undo·redo와 PDF.js/Poppler 골든을 통과했다. 격리한 `pdfjs-dist@6.2.109` mismatch는 Vite 전 `expected ...6.2.108, received 6.2.109`로 fail-closed했다.
2. **legacy oracle**: client 3, structure 4, render 32, output 4, input 1의 diff가 모두 0이다.
3. **gate health**: full unit 327/327와 위 네 음성 회귀, 원본 astra F3 probe의 unresolved 노드 2개 거절을 확인했다.
4. **user-report route**: 실제 `/en/tools/pdf-editor/stamp/`에서 DPR 1/2 × 표시 배율 1/0.5 × 회전 4종을 upload→pointer edit→download로 전부 실행했고 max preview-output 차이는 1 CSS px다.

## 번들 예산

기준선 `/tmp/worklazy-u4-4-review5/evidence/bundle-baseline.json` SHA-256은 요구된 `4caaa9c6c48df99dd740664d7991c995ffff7e8b6deaa7a1d87e982d302c30ea`와 일치한다. `BUNDLE_ROUTES=pdf-editor`, override `{}`, multiplier 1로 측정했으며 다른 route 감소로 상쇄하지 않았다.

| gzip 지표 | 증분 | 상한 | 잔여 | 판정 |
|---|---:|---:|---:|---|
| entry JS | 8,878B | 20,480B | 11,602B | 통과 |
| PDF route JS | 61,923B | 72,000B | 10,077B | 통과 |
| shared JS | 2,407B | 30,720B | 28,313B | 통과 |
| app JS | 74,107B | 81,920B | 7,813B | 통과 |
| CSS | 393B | 10,240B | 9,847B | 통과 |

원자료: `/tmp/worklazy-u4-5-fix1/bundle-scoped.json`.

## 검증 결과

| 검증 | 결과 |
|---|---|
| `npx tsc -b` | exit 0, 진단 0 (최종 재실행 포함) |
| `npm run test:unit` | 327/327, fail 0, skip 0 |
| `npm run build` | exit 0, 2,849 modules, 정적 71페이지 |
| `npm run test:pdf-finish` | smoke·watermark golden 160·stamp 기존/실제 골든 모두 통과 |
| 실제 stamp golden | 16/16, 실패 0, max 1 CSS px |
| 출력 PDF 전후 SHA | all/selected 모두 byte-identical |
| 영향 visual | update 후 9/9 일치 |
| stamp+finish a11y 10페이지 | violations 0, F3 incomplete 0, 외부 요청 0 |
| legacy organize oracle | client/structure/render/output/input 총 diff 0 |
| dependency mismatch 음성 | Vite 전 exit 1, 정확한 version mismatch |
| scoped `bundle:measure` | 5개 고정 상한 통과 |
| `node --check` 2개, `git diff --check` | exit 0 |

실패 이력: 좁은 네 음성 test를 처음 직접 실행할 때 `--experimental-strip-types`를 빠뜨려 Node가 `.ts` 확장자를 거절했다. 제품·테스트 실패가 아니라 호출 오류이며, 정규 unit 명령과 플래그를 넣은 좁은 재실행은 각각 327/327와 4/4로 통과했다. Astra adapter 초기 2회 실패는 위에 기록했다. PDF.js의 표준 fontDataUrl 경고는 기존 renderer 경고이며 판정 실패가 아니다.

## 동시 검토와 이월

사용자 문구·route·SEO 데이터·정적 페이지·광고 경로는 바꾸지 않아 ko/en 현지화, SEO·정적 페이지, AdSense 격리의 추가 변경은 없다. 서버 전제 코드나 새 의존성도 추가하지 않았다.

지시서의 최소 범위를 지키기 위해 다음은 실행하지 않고 U4-8 뒤 1회로 이월한다: full `test:browser`, `test:new-tools`, `test:utilities`, `test:office`, QR 2종, recovery, Excel 2종, full a11y, full visual, full rendering, `css:orphans`, `legacy:manifest`, `tool-registry-routes`, 성능 12입력.

## 변경 파일과 최종 상태

의도한 변경은 제품 2개, test/harness 3개, visual baseline 9개, 기록 2개다. 생성물·vendor 산출물을 직접 수정하지 않았다. 위 16개 파일만 명시적으로 stage해 `79c2071` (`fix(pdf): align stamp preview and F3 audit`)로 커밋했고 사용자 소유 dirty 파일은 그대로 남겼다.
