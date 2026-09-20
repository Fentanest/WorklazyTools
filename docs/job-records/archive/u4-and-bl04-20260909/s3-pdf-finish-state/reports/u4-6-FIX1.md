# U4-6 fix-1 구현 보고 — Codx / 2026-09-09

## 결과

- 브랜치: `s3-pdf-finish`
- 기준: `cea060b65cd983bf3b2b3fdce698a4092e187169`
- 수정 커밋: `509730a` (`fix(pdf): preserve form appearance and popup relations`)
- main 병합·push·배포: 수행하지 않음
- 사용자 소유 변경: `CLAUDE.md`, `PROJECT_RULES.md`, DOCX 2개, 네이버 HTML, `newui/`를 수정하거나 stage하지 않음
- 금지 worktree: 접근하지 않음

R1과 R2를 모두 수리했다. 양식 평면화는 기존 정상 appearance stream만 사용해 BBox에 Matrix를 적용한 경계를 Widget Rect로 맞추고, 모든 Widget의 기하를 선검사한 뒤 `q/cm/Do/Q`로 그린다. 값이나 appearance는 생성하지 않으며 `updateFieldAppearances:false`를 유지한다. 유효하지 않은 Rect/BBox/Matrix, 특이행렬, AP 누락·손상, XFA, 서명은 한·영 `form-unsupported` 사전 오류로 차단되어 결과가 생기지 않는다.

첨부/주석 제거는 최초 제거 집합에서 `/Popup`·`/Parent` 관계를 고정점까지 닫아 종속 Popup을 함께 제거한다. 살아 있는 annotation의 `/Popup`·`/IRT`·`/Parent` 중 제거된 대상만 가리키는 참조를 정리하며, 최종 validator가 부모 없는 Popup을 거부한다.

## R1 — appearance 기하 보존

정규 fixture 5종은 source와 flattened output을 PDF.js 6.2.108 및 Poppler 24.02.0에서 각각 72dpi/scale 1로 렌더했다. 아래 모든 칸이 동일하다.

| fixture | BBox / Matrix | PDF.js source→output | Poppler source→output |
|---|---|---|---|
| identity | `[0 0 100 20]` / identity | 2,000px, `[100,180,199,199]`, `ab80b4ec…033b` → 동일 | 동일 → 동일 |
| scaled-bbox | `[0 0 50 10]` / identity | 동일 → 동일 | 동일 → 동일 |
| offset-bbox | `[10 20 110 40]` / identity | 동일 → 동일 | 동일 → 동일 |
| scaled-matrix | `[0 0 100 20]` / `[2 0 0 2 0 0]` | 동일 → 동일 | 동일 → 동일 |
| translated-matrix | `[0 0 100 20]` / `[1 0 0 1 30 40]` | 동일 → 동일 | 동일 → 동일 |

전체 RGBA SHA-256은 `ab80b4ec04286b9a480cc9e16f943258ef1faf20c68573a4df6d103d9810033b`다. 검수자의 원본 `appearance-review.mjs`도 현재 제품을 read-only mapping해 5종×양 renderer의 source/output 완전 일치를 재현했다.

실제 제품 probe는 scaled BBox 입력에서 `preflight=ready`, input/output 파란 픽셀 `2,000→2,000`, `produced=true`, `preserved=true`였다. 정규 smoke는 ko/en 각각 같은 입력의 실제 다운로드를 열어 같은 픽셀·경계를 단언했다. singular Matrix 입력은 ko/en 현지화 오류, 실행 disabled, 다운로드 0이다. 검수 probe가 4274를 하드코딩해 사용자 허용 범위와 충돌하므로 원본 바이트는 건드리지 않고 `/tmp/worklazy-u4-6-fix1/port-loader.mjs`로 숫자 리터럴만 런타임에 4284로 바꿨다.

증거:

- `evidence/structure-golden.json`, `evidence/pdf-structure-golden.json`
- `appearance/results.json`과 source/output PDF·PNG
- `evidence/product-appearance.json`

## R2 — 종속 Popup 폐쇄

결정론적 최소 fixture의 네 조합 결과다.

| 조합 | 남은 subtype | 첨부 / decoded sentinel | 누락 ref / 깨진 관계 / parentless Popup / PDF.js parent 경고 |
|---|---|---:|---:|
| 보존 | FileAttachment, Popup, Text, Popup, FreeText | 1 / 1 | 0 / 0 / 0 / 0 |
| 첨부만 제거 | Text, Popup, FreeText | 0 / 0 | 0 / 0 / 0 / 0 |
| 주석만 제거 | FileAttachment | 1 / 1 | 0 / 0 / 0 / 0 |
| 둘 다 제거 | 없음 | 0 / 0 | 0 / 0 / 0 / 0 |

검수자의 원본 `structure-review.mjs`를 수정 없이 현재 저장소에 read-only mapping해 복합 입력을 다시 만들고 여섯 옵션을 실행했다.

| 모드 | bytes / 간접 객체 | 고아 / dangling / decode / parentless | 링크 / 이름 목적지 |
|---|---:|---:|---:|
| remove | 7,972 / 230 | 0 / 0 / 0 / 0 | 108 / 84 |
| flatten | 14,378 / 256 | 0 / 0 / 0 / 0 | 108 / 84 |
| preserveForm | 13,536 / 267 | 0 / 0 / 0 / 0 | 108 / 84 |
| attachmentsOnly | **23,628 / 472** | **0 / 0 / 0 / 0** | 108 / 84 |
| annotationsOnly | 26,768 / 353 | 0 / 0 / 0 / 0 | 108 / 84 |
| metadataOnly | 30,176 / 556 | 0 / 0 / 0 / 0 | 108 / 84 |

입력은 42,433B, 610객체, 12페이지, 첨부 decoded 합계 1,286,144B다. `attachmentsOnly`의 첨부 sentinel은 0이고 live markup/reply/form/XMP/Info는 옵션대로 남았다. PDF.js로 12페이지 annotation을 모두 읽었을 때 source와 `attachmentsOnly` 모두 `missing or invalid parent annotation` 경고는 0이었다. 그 밖의 기존 FreeText 계열 경고 24개는 양쪽에서 같고 parent 경고로 세지 않았다.

검수 원본 `assert-evidence.py`는 결함을 선언하기 위해 `attachmentsOnly.parentlessPopups == 24`를 기대하므로 수리 후 바로 그 줄에서 의도대로 실패했다. 검수 파일은 read-only로 보존하고, 복사본 `probes/assert-evidence-fixed.py`에서 기대값만 0으로 바꾼 뒤 여섯 모드의 고아·dangling·decode·관계·sentinel 불변식을 모두 통과시켰다. 결과는 `evidence/verified-summary.json`, 전체 객체 원출력은 `heavy/results.json`에 있다.

## 필수 검증

| 명령/범위 | 결과 |
|---|---|
| `npx tsc -b --pretty false` | exit 0 |
| `NODE_OPTIONS=--max-old-space-size=4096 npm run build` | exit 0, 2,851 modules, 정적 71페이지 |
| `npm run test:unit` | 332/332, fail 0, skip 0 |
| `npm run test:static` | exit 0, startup recovery 119 |
| `npm run test:pdf-finish` | smoke 통과; watermark 4 fixture/128 image/32 text render; stamp 16 좌표/16 실제 브라우저/8 renderer 페이지; structure 5 appearance×2 renderer와 4 관계 조합 통과 |
| `npm run fixtures:pdf-legacy-oracle` | client 3 + structure 4 + render 32 + output 4 + input 1, diff 0 |
| `npm run test:pdf-finish-oracle` (`PDF_FINISH_ORACLE_PORT=4282`) | preflight 87, allow 56, exclude 31, 56 fixture/57페이지, 양 renderer SHA 56/56, 제외 transform 0, 음성 대조 양쪽 검출 |
| `VISUAL_ONLY=pdf-finish-structure VISUAL_CONCURRENCY=1 VISUAL_TEST_PORT=4285 npm run test:visual` | 9/9 일치 |
| F4a+finish 7개 `A11Y_PAGE_IDS`, `A11Y_TEST_PORT=4286`, total limit 0 | violations 0, F4a incomplete 0, inherited 125, 외부 요청 0 |
| 의존 패치 hash mismatch 음성 | Vite 전 exit 1, `build/pdf.mjs` hash mismatch 검출 |
| `git diff --check` / staged diff check | exit 0 / exit 0 |

fixture 결정성 unit의 최초 전체 실행은 새 category 수 기대값이 종전 104로 남아 332개 중 1개가 실패했다. 기대값을 생성 manifest와 같은 111(appearance 6, relationships 1 추가)로 고친 뒤 전체 332/332를 다시 실행했다. 제품 실패를 재실행으로 지우지 않았다.

## 번들

고정 baseline `/tmp/worklazy-u4-6-review/evidence/bundle-baseline.json`, `BUNDLE_ROUTES=pdf-editor`로 측정했다. 상한·override·multiplier를 변경하지 않았다.

| gzip 지표 | 현재 절대값 | 기준 대비 증분 | 상한 | 잔여 |
|---|---:|---:|---:|---:|
| entry JS | 310,368B | 11,091B | 20,480B | 9,389B |
| PDF route JS | 1,148,347B | 71,060B | 82,000B | 10,940B |
| shared JS 순증 | 1,375,774B | 2,430B | 30,720B | 28,290B |
| app JS | 5,929,213B | 85,498B | 96,000B | 10,502B |
| CSS | 38,087B | 400B | 10,240B | 9,840B |

`overrides={}`, `multiplier=1`, 신규 lazy route 없음이며 5개 모두 통과했다. 출력은 `evidence/bundle-scoped.json`에 있다.

## 동반 검토와 커밋 경계

ko/en 사용자 오류 문구를 함께 갱신했고 `test:static`으로 현지화·hreflang·정적 페이지·브라우저 runtime·ads/robots/sitemap을 확인했다. route, SEO 핵심 의미, 광고 위치, 광고 제외 격리, 서버 전제, 의존성은 바뀌지 않았다. 생성물은 fixture 생성기에서 만들었고 `dist/`, `public/vendor/**`, 라이선스 산출물은 수정하지 않았다.

커밋에는 지시 범위의 19개 파일만 들어 있다. 커밋 직전 staged diff check가 통과했고, 커밋 뒤 남은 tracked 변경은 시작부터 사용자 소유였던 `CLAUDE.md`, `PROJECT_RULES.md`뿐이다.
