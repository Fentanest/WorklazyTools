# WU1 구현 완료 보고

- 작업 ID: `adsense-recheck-20260919 / WU1`
- 담당: Codx
- 상태: WU1 구현·커밋 완료, push·배포 미실행
- 기준 커밋: `29fe72cb5a25c6d9643d69f66d713f1386a4ff4e`
- 최종 SHA: `1d6302785ffb16163a501948d465f0c687683e85`
- PLAN: v0.3, SHA-256 `40c69eeb25b6ec4c7b58832070d94b84eef493c4915e0f50875e5b49a360c75d`
- 브랜치/worktree: `work/adsense-guides-20260919` / `/home/better0101/projects/wt-adsense-guides`
- `npm ci`, `npm install`: 실행하지 않음

## 커밋

1. `bc252d3b6a032f647946660841775b2a3aca1fa1` — `fix(guides): connect PDF OCR route FAQs`
2. `1d6302785ffb16163a501948d465f0c687683e85` — `fix(guides): validate and publish audited guide content`

첫 커밋에서 보존 변경을 검증해 고정했다. KO/EN 모두 `faq_19`, `faq_20`, OCR `pathFaqs`, OCR `pathBlocks`를 `pdfEditor.standard`에서 `pdfEditor.convert`로 이동했고, standard의 root `new_faq_1`을 포함한 OCR 외 10개 선택 결과는 기준 커밋과 동일하다. Git 인덱스 쓰기와 두 커밋이 정상 완료되어 EROFS는 재발하지 않았다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `src/locales/ko/guides.json` | OCR FAQ/블록 이관, convert/OCR 선택 목록, 제작 메모 사용자 문구화, 고아 제목 제거, 미연결 `video` 키 삭제 |
| `src/locales/en/guides.json` | KO와 동일한 구조 정리 및 영문 39건 처리 |
| `src/i18n/guideData.ts` | 명시 선택/전체 fallback/빈 선택 금지 정책 주석 |
| `scripts/static-faq-expectations.json` | 기존 정적 FAQ 기대표 데이터화, convert 전용 기대 질문 추가 |
| `scripts/validate-static-output.mjs` | 파싱 기반 FAQPage 검사, 세 오류 분리, 본문/JSON-LD 질문 집합 비교, 함수 export/CLI guard |
| `scripts/validate-guides.mjs` | App.tsx AST 라우트 정본, 실제 slug-route 연결 검증, 빈 선택·필수 FAQ·제작 메모·고아 문단 검증, 순수 함수/CLI guard |
| `tests/unit/static-output-validation.test.ts` | 정상/FAQPage 없음/필수 질문 없음/본문 불일치 fixture |
| `tests/unit/guides-validation.test.ts` | 현재 데이터, 19개 원문 fixture, 고아 문단, FAQ mutation, 경로 오타·빈 선택, negative control |
| `docs/guide-production-notes.md` | FAQ 선택 정책과 제거한 19개 제작 메모 원문·위치 보존 |

항목별 위치·원문·판정·대체 문구·정적/런타임 근거는 `WU1-ITEMS.md`에 기록했다. 이 파일과 본 보고서는 저장소 `.gitignore`의 `docs/jobs/` 규칙에 따라 worktree 사본에만 존재한다.

## 검사 결과

| 명령/검사 | 종료 코드 | 결과 | 로그/산출물 |
|---|---:|---|---|
| PDF FAQ 기준/현재 데이터 비교 | 0 | KO/EN 각 OCR 외 standard 10개 선택 동일, root `new_faq_1` 보존, OCR/convert 비어 있지 않음 | `/tmp/wl-adsense/wu1/logs/pdf-faq-nonregression.log` |
| `npm run test:guides` | 0 | App 도구 라우트 49개 통과 | `/tmp/wl-adsense/wu1/logs/test-guides-final.log` |
| `npm run test:unit` | 1 | 537건 중 527 통과, 10 실패; 신규 두 테스트는 이 실행에서도 통과 | `/tmp/wl-adsense/wu1/logs/test-unit.log` |
| `node --experimental-strip-types --test tests/unit/guides-validation.test.ts tests/unit/static-output-validation.test.ts` | 0 | 최종 변경 기준 29/29 실행 통과(상위 10테스트 + 19 fixture 하위 테스트) | `/tmp/wl-adsense/wu1/logs/new-unit-tests-final.log` |
| `npm run build` | 0 | `test:guides`, TypeScript, Vite 빌드 통과; 지역화 정적 페이지 101개 생성 | `/tmp/wl-adsense/wu1/logs/build.log` |
| `npm run test:static` | 0 | 정적 출력 및 startup recovery 164문서 통과 | `/tmp/wl-adsense/wu1/logs/test-static.log` |
| `npx vite preview --port 4181 --strictPort` | 0(정상 종료) | 4181 기동 및 OCR 경로 HTTP 응답 확인 후 종료 | `/tmp/wl-adsense/wu1/logs/preview.log` |
| `/tmp/wl-adsense/wu1/content-check.mjs` | 0 | 39항목, FAQ 2경로×2언어, 캡처 7장 통과 | `/tmp/wl-adsense/wu1/logs/content-check.log`, `/tmp/wl-adsense/wu1/content-check.json` |
| `git diff --check` | 0 | 형식 오류 없음 | `/tmp/wl-adsense/wu1/logs/git-diff-check.log` |
| KO/EN JSON 파싱 | 0 | 통과 | 최종 실행 기록 |

신규 테스트 재실행 중 처음 한 번 `node --test ...`에 `--experimental-strip-types`를 누락해 테스트 본문 진입 전 `ERR_UNKNOWN_FILE_EXTENSION`으로 종료했다. 즉시 프로젝트 방식으로 고쳐 위 최종 로그에서 전부 통과시켰으며 제품 결함으로 집계하지 않았다.

### 전체 단위 테스트의 비차단 실패

`npm run test:unit`의 10건은 WU1 변경 파일 밖에서 발생했으며, 기준 커밋 대비 발생 시점은 이번 작업에서 별도 확정하지 않았다.

- `document-generator`, `pdf-finish-engine`, `pdf-finish-modules`: extensionless `src/lib/utils` import의 `ERR_MODULE_NOT_FOUND` 3건
- `feature-locales`: 기존 `features.json` Excel compare guide 구조 기대 1건
- `p1b-components`: 기존 ToolGuide 소비자 수, OperationProgress coral class, ToolCard 계약 기대 3건
- `seo`: 기존 video title과 document FAQ 수 기대 2건
- `ui-legacy-isolation`: 기존 Excel Cleaner `accent-primary` 1건

WU1 소유 밖 기대값을 낮추거나 제품 파일을 수정하지 않았다. 최종 신규 테스트, 가이드 검사, 빌드, 정적 검사, 브라우저 위치 검사는 모두 통과했다.

## 39건 처리 집계

- 수정: 17
- 유지: 0
- 제거: 20
- 미연결 삭제: 2
- 격리 미노출: 0
- 미확인: 0

`textTools` KO/EN 메모는 원본 JSON에서 네 문자열로 끊겨 있어 각 항목 행 안에서 한 문단으로 복원했다. 미연결 KO/EN `video` 키는 코드·검사기·테스트에 해당 가이드 키 참조가 없음을 확인한 뒤 삭제했다. 고아 제목 20건은 해당 가이드 문단 위치에서 제거됐고, 정상 페이지 제목 등 다른 문맥의 동일 문자열은 판정에서 제외했다.

## 정적·런타임·시각 확인

- OCR FAQ: KO/EN 각 `faq_19`, `faq_20` 2개이며 정적 본문, 파싱한 FAQPage JSON-LD, 런타임 DOM 질문 집합이 일치한다.
- convert FAQ: KO/EN 각 `faq_0`, `faq_1`, `faq_2`, `faq_4` 4개이며 세 위치의 질문 집합이 일치한다. 전용 필수 질문은 KO `PDF를 Word나 Excel로 완벽하게 복원할 수 있나요?`, EN `Can it perfectly restore Word or Excel structure?`이다.
- 시각 표본 7장: `/tmp/wl-adsense/wu1/shots/`의 KO/EN OCR·convert, KO image resize, EN video extract-audio, EN PDF stamp. 가이드 카드의 빈 섹션·잘림·깨짐은 보이지 않았다.
- EN PDF compare는 기존 `PdfComparePage`에 `ToolGuideWrapper`가 없어 런타임 가이드가 노출되지 않았다. 소스와 정적 출력의 문구 변경은 확인했다.
- EN office editor 랜딩은 `/en/tools/office-editor/app/`으로 즉시 이동해 랜딩 가이드가 런타임에 노출되지 않았다. 소스와 정적 출력의 문구 변경 및 격리 작업 화면 정상 진입을 확인했다.

## 판단·미완료·배포 상태

- convert 선택은 실제 convert 전용 FAQ를 포함하는 `faq_0`, `faq_1`, `faq_2`, `faq_4`로 정했다. 공통 페이지 번호 질문은 기대표에 사용하지 않았다.
- xls-preserve KO/EN은 격리 정적 HTML에 가이드가 없지만 preview 런타임에는 가이드가 렌더됐다. 따라서 실제 확인 결과에 따라 `격리 미노출`이 아니라 `제거`로 기록했다.
- PDF compare·office editor의 기존 런타임 가이드 미연결과 전체 단위 테스트 10건은 WU1 소유 밖이라 수정하지 않고 근거를 남겼다.
- WU1 요구 범위의 미완료·재현 불가 항목은 없다.
- 커밋 완료. 원격 push, 통합, 배포는 실행하지 않았다.

## 후속(Astra 권고 반영)

- 공유 가이드 키가 `scripts/static-faq-expectations.json`의 검증 대상 `(slug, route)` 연결쌍을 2개 이상 해석하면, 각 연결 route에 비어 있지 않은 `pathFaqs` 명시 선택이 있도록 `scripts/validate-guides.mjs`를 보강했다. 누락·빈 선택은 `Explicit pathFaqs required for shared guide key '<key>' at route '<route>'` 오류로 실패한다. 단일 검증 route의 전체 FAQ fallback은 유지했다.
- `pdfEditor.convert.pathFaqs["/tools/pdf-editor/convert"]` 삭제 mutation이 위 오류로 실패하는 테스트와 단일 route fallback 통과 테스트를 추가했다. KO/EN negative control은 각 문장을 별도 fixture의 블록 마지막 문단에 배치해 고아 문단 검사를 실제로 거치도록 바꿨다.
- `docs/guide-production-notes.md`에 공유 가이드 키의 route별 명시 선택 정책 한 줄을 추가했다. guides.json 데이터와 제품 코드는 수정하지 않았다.

| 검사 | 종료 코드 | 결과 | 로그 |
|---|---:|---|---|
| `node --experimental-strip-types --test tests/unit/guides-validation.test.ts tests/unit/static-output-validation.test.ts` | 0 | 39/39 통과 | `/tmp/wl-adsense/wu1/logs/wu1-followup-unit.log` |
| `npm run test:guides` | 0 | App 도구 라우트 49개 통과 | `/tmp/wl-adsense/wu1/logs/wu1-followup-guides.log` |
| `git diff --check` | 0 | 형식 오류 없음 | 터미널 출력 |

- 이번 후속에서는 지시대로 build, `test:static`, 전체 unit을 실행하지 않았다. WU4 통합 후보 검사로 이월한다.
- 커밋: `584b7a069b0ca8b215e4451adccc4f0191d62934` — `fix(guides): require explicit pathFaqs for shared guide keys`
- 최종 SHA: `584b7a069b0ca8b215e4451adccc4f0191d62934`
- push·통합·배포는 실행하지 않았다.
