# WU4 통합 보고 — adsense-recheck-20260919

## 상태

- **구현·검증 완료, 운영 미반영**
- 통합 브랜치의 최종 후보를 확정했다. push, main 수정, 배포는 수행하지 않았다.
- 기존 unit 실패 10건과 운영/실광고 확인 항목은 공통 backlog에 보존했으며, 이번 통합의 신규 실패는 0건이다.

## 통합 결과

| 항목 | 결과 |
|---|---|
| 작업 공간 | `/home/better0101/projects/wt-adsense-integration` |
| 브랜치 | `integration/adsense-recheck-20260919` |
| 최초 통합 전 HEAD | `73cdb271241d7c1f0adf3386487f134b6fb78fdd` |
| WU4 2차 재개 전 HEAD | `cd53c2a3f95e905326005712725b305efa5efb9c` |
| WU4 3차 재개 전 HEAD | `3f29a4ac267a9a052e3577fbb75e53a3731d6c0d` |
| WU1/3 fast-forward | `584b7a069b0ca8b215e4451adccc4f0191d62934` |
| WU2 merge | `ffd49f45459994081a9469882f7a86d01ae3dd0c` |
| WU2 수정 재병합 | `5d6eca9dcfcd99919dea64f8d15ce411fd9d17b0` — `97739d54dd4a010c28678e95f8689d02ca8e9030` 반영 |
| 충돌 | 1·2·3차 모두 없음 |
| 통합 조정 1 | `cd53c2a3f95e905326005712725b305efa5efb9c` — `package.json` 끝 개행 복원 |
| 통합 조정 2 | `5ae29f929e26997a34642fe14f525bc139df9286` — WU2 광고 스모크 2파일을 소유자 주석과 함께 광고 참조 allowlist에 추가 |
| 공통 기록 커밋 | `3f29a4ac267a9a052e3577fbb75e53a3731d6c0d` — CHANGELOG, review-notes, backlog 취합 |
| 기록 보정 커밋 | `c53cadcd877215c7a9a0a7398b44c19f0bfc1d93` — S5/S6 실측과 backlog 정정, 실제 작성자 서명 보존 |
| 기록 보정 2 커밋 | `290a11f94025b040d935e8a9f104241a9ca72fe7` — Astra 최종 검수의 backlog 후속 4건 이관 |
| 최초 통합 전 대비 최종 diff | 11 files changed, 961 insertions(+), 6 deletions(-) (`73cdb27..290a11f`) |
| **최종 통합 후보 SHA** | **`290a11f94025b040d935e8a9f104241a9ca72fe7`** |

allowlist 조정은 `tests/unit/app-shell.test.ts`의 명시 목록에 아래 두 항목만 추가했고 검사 로직과 기존 항목은 바꾸지 않았다.

- `tests/ad-eligibility-smoke.mjs`
- `tests/helpers/ad-stub.mjs`

두 항목의 주석은 `Owner: WU2 ad-eligibility smoke — exact-URL stub and fail-closed external blocking assertions.`로 동일하게 기록했다.

## 3차 재사용·재실행 판정

3차 merge 직후 `git diff 3f29a4a..5d6eca9 --stat`은 `tests/ad-eligibility-smoke.mjs` 1파일(+154/−100)뿐이었다. 기록 보정 커밋은 `docs/review-notes.md`, `docs/backlog.md`만 바꿨다. 제품 소스·빌드 입력·의존성·fixture·정적 생성 입력은 바뀌지 않았으므로 3f29a4a의 build·test:static·content-check·캡처 결과를 재사용하고, 검사기 변경으로 무효화된 광고 스모크·판별 모드와 허용목록 단위 검사만 재실행했다.

| 검사 | 구분 | 근거·결과 |
|---|---|---|
| `env -u VITE_LOCAL_QA npm run build` | 재사용 | 3f29a4a 결과 exit 0; App 도구 49개·지역화 정적 페이지 101개. 제품/빌드 입력 무변경 |
| `npm run test:unit` | 재사용 | 3f29a4a에서 547건 중 537 pass·기존 10 fail; `tests/unit` 입력과 제품 코드 무변경 |
| `npm run test:static` | 재사용 | 3f29a4a 결과 exit 0; 정적 생성 입력·제품 코드 무변경 |
| content-check 39항목·FAQ 4조합 | 재사용 | 3f29a4a 결과 39/39, FAQ 4/4; 제품과 `dist` 입력 무변경 |
| 시각 표본 7장 | 재사용 | 제품/UI·빌드 입력 무변경; 기존 실제 열람 결과 유지 |
| `RECOVERY_TEST_PORT=4183 npm run test:ads` | 재실행 | exit 0; 29행 상태 분리, 전 행 4계수 기록·`allowedExternal=0` |
| `RECOVERY_TEST_PORT=4183 node tests/ad-eligibility-smoke.mjs --discriminate` | 재실행 | exit 0; 스텁 비활성 시 기대한 `stub expected` 단언 실패 유형 확인 |
| `node --experimental-strip-types --test tests/unit/app-shell.test.ts` | 재실행 | exit 0; 3/3 통과, repo-wide 광고 실행 참조 허용목록 경로 불변 확인 |

## 최종 검사 증거

| 순서 | 명령/검사 | 종료 코드 | 대상/결과 | 로그·산출물 |
|---:|---|---:|---|---|
| 1 | `RECOVERY_TEST_PORT=4183 npm run test:ads` | 0 | 29행: pass 26 / not-applicable 1 / recorded 1 / unverified 1 / fail 0; 29행 모두 4계수 기록, `allowedExternal=0` | `/tmp/wl-adsense/integration/logs/pass3-test-ads.log`, `pass3-test-ads-summary.log`; `/tmp/wl-adsense/integration/visual-artifacts/adsense-recheck/ad-smoke-results.json` |
| 2 | `RECOVERY_TEST_PORT=4183 node tests/ad-eligibility-smoke.mjs --discriminate` | 0 | 스텁 비활성 상태에서 `AssertionError … stub expected`를 구분해 검사기 판별력 확인 | `/tmp/wl-adsense/integration/logs/pass3-discriminate.log`; `/tmp/wl-adsense/integration/visual-artifacts/adsense-recheck/ad-smoke-discrimination.json` |
| 3 | `node --experimental-strip-types --test tests/unit/app-shell.test.ts` | 0 | 3/3 통과; 저장소 전역 광고 참조 allowlist 포함 | `/tmp/wl-adsense/integration/logs/pass3-app-shell.log` |
| 4 | `npm run test:unit` | 재사용 | 547 tests: 537 pass, 기존 10 fail; 기준과 이름 동일, 신규 실패 0 | `/tmp/wl-adsense/integration/logs/test-unit.log`, `test-unit.exit` |
| 5 | `npm run test:static` | 재사용 | 지역화·hreflang·브라우저 런타임·ads.txt·robots·sitemap 통과, startup recovery 164문서 | `/tmp/wl-adsense/integration/logs/test-static.log`, `test-static.exit` |
| 6 | `env -u VITE_LOCAL_QA npm run build` | 재사용 | exit 0; App 도구 경로 49개와 지역화 정적 페이지 101개 생성 | `/tmp/wl-adsense/integration/build.log`, `build.exit`; `logs/build-reuse.txt` |
| 7 | content-check와 시각 표본 | 재사용 | 39/39항목, FAQ 4/4, 캡처 7/7 실제 열람; UI·제품 입력 무변경 | `/tmp/wl-adsense/integration/content-check.json`; `/tmp/wl-adsense/integration/shots/`; `logs/visual-review.txt` |

S5는 recovery-server의 `state.transform`으로 `QrBulkPanel` chunk에 테스트 전용 렌더 오류를 주입했다. 같은 문서·URL에서 RouteErrorBoundary에 도달했고, 광고 스텁은 총 1·추가 0, 기존 광고 스크립트 태그는 1개 잔류했다. 이는 실제 내부 import 실패가 아니라 주입 재현이며, 순수 렌더 오류 시 잔류 광고를 제품에서 처리할지는 이번 범위 밖 backlog다.

`test:unit`의 exit 1은 아래 기준 10건만 남은 결과다. 테스트 실행이 중단되거나 0건 선택된 결과가 아니며 전체 547개가 집계됐다.

## unit 실패 이름 비교

| 분류 | 실패 이름 | 기준 `29fe72c` | 최종 후보 | 판정 |
|---|---|---:|---:|---|
| document-generator | `tests/unit/document-generator.test.ts` | 1 | 1 | 동일 (`ERR_MODULE_NOT_FOUND`) |
| pdf-finish-engine | `tests/unit/pdf-finish-engine.test.ts` | 1 | 1 | 동일 (`ERR_MODULE_NOT_FOUND`) |
| pdf-finish-modules | `tests/unit/pdf-finish-modules.test.ts` | 1 | 1 | 동일 (`ERR_MODULE_NOT_FOUND`) |
| feature-locales | `Excel duplicate result copy keeps independent-list, zero-row, dialog, and guide contracts` | 1 | 1 | 동일 |
| p1b-components | `ToolGuide keeps its public structure and localized eyebrow through shadcn cards` | 1 | 1 | 동일 |
| p1b-components | `OperationProgress keeps W-D stage rows, active spinner, percentages, and progress semantics` | 1 | 1 | 동일 |
| p1b-components | `ToolCard keeps a link root, per-tool accent, h2 title, and capped tags` | 1 | 1 | 동일 |
| seo | `tool metadata keeps a distinct identity in Korean and English` | 1 | 1 | 동일 |
| seo | `new document tools expose matching Korean and English static FAQs` | 1 | 1 | 동일 |
| ui-legacy-isolation | `the reachable B3 document and Excel Cleaner surfaces emit no legacy or global.css-owned class token` | 1 | 1 | 동일 |
| app-shell allowlist | `repo-wide executable ad references stay inside the explicit runtime and verification allowlist` | 0 | 0 | 통합 조정 후 3/3 통과 |
| **합계** | 기준 실패 이름 집합 대비 | **10** | **10** | **새 실패 0** |

기준 원로그는 `/tmp/wl-adsense/review/baseline-unit-7files.log`, 최종 전체 로그는 `/tmp/wl-adsense/integration/logs/test-unit.log`다.

위 Excel duplicate 행은 최종 원로그 `/tmp/wl-adsense/integration/logs/test-unit.log`가 가리키는 `tests/unit/feature-locales.test.ts:38`에 따라 `feature-locales` 소속으로 복원했다. 3차 기록 보정에서 이를 `p1b-components`로 바꾼 것은 Claude 지시 오류였다.

## content-check와 시각 표본

- `/tmp/wl-adsense/wu1/content-check.mjs`를 `/tmp/wl-adsense/integration/content-check.mjs`로 복사한 뒤 저장소를 통합 worktree, origin을 `http://127.0.0.1:4183`, JSON·캡처 출력을 `/tmp/wl-adsense/integration/`으로 바꿨다.
- 브라우저 문서 스크립트 실행 전에 `localStorage.worklazy_privacy_consent=granted`를 설정했고, 통합 `dist` 외 외부 요청은 차단했다.
- 결과 JSON은 `passed: true`, 39항목 실패 0, FAQ 4조합 실패 0, 캡처 7장을 기록한다.
- 캡처: KO/EN PDF OCR, KO/EN PDF convert, KO image resize, EN video extract-audio, EN PDF stamp. 실제 열람에서 동의 배너는 보이지 않았고 가이드 카드의 빈 섹션·잘림·깨짐도 보이지 않았다.
- 캡처 경로: `/tmp/wl-adsense/integration/shots/`

## 공통 기록과 남은 후속

- `CHANGELOG.md`: OCR FAQ 연결 복구, 가이드 제작 메모·고아 제목·미연결 video 키 정리, 사전 동의 lazy 경로 광고 로더 결함 수정, 가이드/정적 FAQ 검증 강화, 작업 부산물 추적 해제를 Codx/Muse 실제 구현자 서명으로 기록했다.
- `docs/review-notes.md`: 배포 #116 원인, 기존 unit 10건 귀속, 테스트 전용 렌더 오류를 통한 S5 같은 문서 전환·잔류 태그 실측, S6 PDF 루트 한·영 전환, S9 설계 동작, 광고 전면 제외 유지, 명시 선택 규칙을 Codx/Muse 실제 작성자 서명으로 기록했다.
- `docs/backlog.md`: 기존 unit 10건, PdfComparePage 가이드 미연결, Office Editor `?guide=1` 한정, S5 잔류 실측 완료 뒤 제품 처리 결정, S10 실제 overlay, S6 하위 경로 직접 링크 생성 시 추가 검사, AdSense 계정 제외 목록·Auto ads, Codex worktree 신뢰 등록 3줄 정리를 이관했다.
- 최초 기록 커밋: `3f29a4ac267a9a052e3577fbb75e53a3731d6c0d`; 3차 보정 커밋: `c53cadcd877215c7a9a0a7398b44c19f0bfc1d93`.
- S10의 실제 광고 overlay와 계정 설정·실제 노출, S5 순수 렌더 오류 시 잔류 광고의 제품 처리 정책은 로컬 스텁으로 완료 판정하지 않았다.

## 기록 보정 2

- 커밋 `290a11f94025b040d935e8a9f104241a9ca72fe7`에서 `docs/backlog.md`에 Astra 최종 검수 권고 4건을 이관했다: S9 전체 문서 교체의 로컬 상태 유실·경고 UX, 데스크톱 `.bottom-tabs` 노출 가능성, 광고 스모크 빌드 출처 메타데이터 오기, 판별 모드와 `assertNoRealNetwork` 보강.
- 이 제외 보고서의 Excel duplicate 실패 소속을 원로그대로 `feature-locales`로 복원하고 3차 보정의 Claude 지시 오류를 주석으로 남겼다.
- `git diff --stat c53cadc..290a11f`은 추적 파일 기준 `docs/backlog.md` 1개, 4 insertions이며 제품·테스트 코드는 바뀌지 않았다. 문서 전용 보정이므로 검사는 재실행하지 않았고 기존 결과를 재사용했다.
- push, main 수정, 배포, `npm ci`는 수행하지 않았다.

## 최종 상태

- 추적 작업트리 clean; Git 제외 문서 `WU4-REPORT.md`는 기록 보정 2로 갱신.
- 최종 통합 후보: `290a11f94025b040d935e8a9f104241a9ca72fe7`.
- **구현·검증 완료, 운영 미반영**.
- push, main 수정, 배포, `npm ci`는 수행하지 않았다.
