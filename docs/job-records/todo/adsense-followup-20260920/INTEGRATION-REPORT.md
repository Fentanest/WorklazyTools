# adsense-followup-20260920 통합 보고

| 항목 | 값 |
|---|---|
| 작업 ID | `adsense-followup-20260920 / 통합` |
| 통합 담당 | Codx (Sol) |
| worktree / branch | `/home/better0101/projects/wt-followup-integration` / `integration/adsense-followup-20260920` |
| PLAN | v0.2 정본, SHA-256 `440f68c2464dbdf8df85822f7f8554e8af0473f84421ae3cac2e6f23dbe87cd3` (§5·§6·§7) |
| WU-A 고정 제출 | `cb2331210d3a4a6c511a84b17d1a40554ad7b02e` (`0c55667`·`33d529e`·`cb23312`) |
| WU-B 1차 고정 제출 | `d7fb5f6cebaa311a5e88147b1c0e80f808fc4fb7` (`58e4629`·`7697853`·`d7fb5f6`) |
| WU-B Astra 차단 보강 제출 | `cc95a947a3861cba2794160212a3fd36b6d54c0a` |
| 1차 merge 전 / 후 | `cb2331210d3a4a6c511a84b17d1a40554ad7b02e` → `c942a379663e6245421169699a6fb9bd41ddeca0` |
| 1차 공통 기록 커밋 | `2fe293d412e667fe916e25258a39c73a0db2786c` |
| 2차 merge 전 / 후 | `2fe293d412e667fe916e25258a39c73a0db2786c` → `40972dc3fed5c0b8d856e654dc116d798671b79c` |
| 2차 기록 보정 커밋 | `10186dfeaec33466c5e3198ded866e45eb391f56` |
| 최종 통합 후보 SHA | **`10186dfeaec33466c5e3198ded866e45eb391f56`** |
| 상태 | **구현·검증 완료, 운영 미반영** |
| push / main / 배포 | 수행하지 않음 |

현재 `PLAN.md`에는 정본 뒤 진행 이력 v0.2.1·v0.2.2 두 줄이 추가돼 파일 전체 해시는 달라졌지만, 정본 부분(1–85행)의 SHA-256은 위 `440f68c2…`와 정확히 일치한다.

## 병합

- 병합 명령: `git merge --no-ff --no-edit work/followup-b-20260920` · exit 0.
- 충돌 없이 merge commit 1개 `c942a379663e6245421169699a6fb9bd41ddeca0`가 생성됐다. 부모는 WU-A `cb23312`와 WU-B `d7fb5f6`이다.
- 병합 전 WU-A 기준 diff(`290a11f..cb23312`): 제품 4파일, 6 insertions / 3 deletions.
- 병합 대상 WU-B 기준 diff(`290a11f..d7fb5f6`): 테스트 3파일, 136 insertions / 43 deletions.
- 병합 후 기준 diff(`290a11f..c942a37`): 7파일, 142 insertions / 46 deletions. 소유 파일 겹침과 충돌 해결은 없다.
- WU-B 보고서는 지정 원본에서 이 worktree의 `docs/jobs/todo/adsense-followup-20260920/WU-B-REPORT.md`로 복사했고, 양쪽 SHA-256은 `9a6577e5b0d673db895b3727086b461937a0663e04ab5fdd6bd591a42a70b13b`로 같다.
- 전후 근거: `/tmp/wl-followup/integration/logs/premerge-*`, `/tmp/wl-followup/integration/logs/merge.log`, `/tmp/wl-followup/integration/logs/postmerge-*`.

## 최종 검사

각 명령은 연결하지 않고 순차 실행했다. build는 `VITE_LOCAL_QA`를 명시적으로 제거했고, build 뒤 같은 production `dist`를 static·ads·시각 검사에 사용했다.

| 명령·범위 | 종료 코드 | 대상 수·판정 | 로그·산출물 |
|---|---:|---|---|
| `env -u VITE_LOCAL_QA npm run build` | 0 | 통과 · Vite 2,914 modules, 정적 101 pages | `/tmp/wl-followup/integration/logs/build.log` |
| `npm run test:unit` | 1 | **실패/4건 이월** · 605 tests, 601 pass, 4 fail, 전체 실행 완료 | `/tmp/wl-followup/integration/logs/test-unit.log`, `test-unit-failures.txt` |
| `npm run test:static` | 0 | 통과 · localized pages/metadata/runtime/ads.txt/robots/sitemap, startup recovery 164 documents | `/tmp/wl-followup/integration/logs/test-static.log` |
| `RECOVERY_TEST_PORT=4193 npm run test:ads` | 0 | 통과 · 29상태(pass 26, not-applicable 1, recorded 1, unverified 1), **fail 0**, 전 시나리오 `allowedExternal=0`, `runHead=c942a37` | `/tmp/wl-followup/integration/logs/test-ads.log`, `tests/visual-artifacts/adsense-recheck/ad-smoke-results.json` |
| `RECOVERY_TEST_PORT=4193 npm run test:ads -- --discriminate` | 0 | 통과 · 정확한 `AssertionError [ERR_ASSERTION]`, attempt 1 / stub 0 / blocked 3 / `allowedExternal=0`, `runHead=c942a37` | `/tmp/wl-followup/integration/logs/test-ads-discriminate.log`, `tests/visual-artifacts/adsense-recheck/ad-smoke-discrimination.json` |
| Chrome 시각 DOM 검사 | 0 | 통과 · 4프로필, Chrome 153.0.8010.36, pageerror 0 / console error 0 / `allowedExternal=0` | `/tmp/wl-followup/integration/logs/browser-checks.log`, `/tmp/wl-followup/integration/browser-results.json` |
| `npm run preview -- --host 127.0.0.1 --port 4193 --strictPort` | 130 | 정상 기동 후 브라우저 검사 완료 시 SIGINT로 종료 | `/tmp/wl-followup/integration/logs/preview.log` |

각 종료 코드는 같은 로그 디렉터리의 `*.exit`에도 보존했다. 광고 판별 명령은 일반 광고 스모크가 종료된 뒤 순차 실행했다.

## unit 실패 비교 — 이름 기준

기준은 547 tests / 537 pass / 10 fail이었고, 통합 후보는 605 tests / 601 pass / 4 fail이다. 확장자 없는 import 3건이 풀리면서 해당 파일 내부 테스트가 실제 실행되어 총 실행 수가 58건 늘었다. 잔여 4건 외 추가 실패는 없다.

| 기준 실패 이름 | 통합 결과 | 처리 |
|---|---|---|
| `tests/unit/document-generator.test.ts` (`ERR_MODULE_NOT_FOUND`) | 해소 | `src/lib/utils.ts` 명시 import — Codx |
| `tests/unit/pdf-finish-engine.test.ts` (`ERR_MODULE_NOT_FOUND`) | 해소 | `src/lib/utils.ts` 명시 import — Codx |
| `tests/unit/pdf-finish-modules.test.ts` (`ERR_MODULE_NOT_FOUND`) | 해소 | `src/lib/utils.ts` 명시 import — Codx |
| `Excel duplicate result copy keeps independent-list, zero-row, dialog, and guide contracts` | 해소 | 실제 `guides.json` 선택 내용 검사로 이관 — Muse |
| `tool metadata keeps a distinct identity in Korean and English` | 해소 | 승인 SEO 카피 현행값 반영 — Muse |
| `new document tools expose matching Korean and English static FAQs` | 해소 | 현 FAQ 개수와 KO/EN 동수 검사 반영 — Muse |
| `ToolGuide keeps its public structure and localized eyebrow through shadcn cards` | 잔여 | `p1b-components` · `adsense-followup2` 이월 |
| `OperationProgress keeps W-D stage rows, active spinner, percentages, and progress semantics` | 잔여 | `p1b-components` · `adsense-followup2` 이월 |
| `ToolCard keeps a link root, per-tool accent, h2 title, and capped tags` | 잔여 | `p1b-components` · `adsense-followup2` 이월 |
| `the reachable B3 document and Excel Cleaner surfaces emit no legacy or global.css-owned class token` | 잔여 | `ui-legacy-isolation` · `adsense-followup2` 이월 |

해소 방식은 승인 카피·현 데이터 반영과 검사 위치 이관이며, 잔여 4건의 기대값은 수정하지 않았다. 따라서 unit을 전체 통과로 합산하지 않는다.

## 시각 재확인

`/usr/bin/google-chrome`과 기존 `tests/helpers/ad-stub.mjs`의 `installAdFirewall` / `assertNoRealNetwork`를 재사용했다. 캡처 4장을 생성한 뒤 원본으로 직접 열람했다.

- 1365×900 `/ko/tools/text-merger/`: `.bottom-tabs` computed `display: none`, rect `0×0`.
- 412×839 같은 경로: computed `display: grid`, `position: fixed`, 3개 링크가 동일 행의 3열(`126.656px 126.672px 126.656px`).
- `/ko/tools/pdf-compare/`, `/en/tools/pdf-compare/`: 언어별 가이드 섹션 1개, 내부 FAQ `details` 3개.
- 모바일 탭 겹침·세로 쌓임, 데스크톱 모바일 메뉴 노출, 가이드 카드/FAQ 겹침·잘림은 관찰되지 않았다.

캡처:

- `/tmp/wl-followup/integration/shots/text-merger-desktop-bottom.png`
- `/tmp/wl-followup/integration/shots/text-merger-mobile-bottom.png`
- `/tmp/wl-followup/integration/shots/pdf-compare-ko-guide-desktop.png`
- `/tmp/wl-followup/integration/shots/pdf-compare-en-guide-desktop.png`

## 1차 공통 기록과 후보

공통 기록 커밋 `2fe293d412e667fe916e25258a39c73a0db2786c`는 다음 세 파일만 포함한다.

- `CHANGELOG.md`: PC 하단 모바일 메뉴 노출 수정, PDF 비교 사용법 안내·FAQ 표시를 사용자 의미 변경으로 기록 — Codx.
- `docs/review-notes.md`: unit 10→4 귀속과 해소 6건의 실제 변경 방식 — Muse(Claude 판정); 스모크 판별 강화·메타데이터 정정 — Muse.
- `docs/backlog.md`: 스모크 메타데이터·판별 단언, 하단 탭, PDF 비교 가이드를 완료 표기하고 잔여 unit 4건을 `adsense-followup2`로 이월.

검사는 merge commit `c942a37`에서 완료했고, 이후 변경은 위 기록 문서 3개뿐이었다. 제품·테스트·설정·의존성·fixture·`dist` 입력이 바뀌지 않아 검사 결과를 1차 통합 후보 `2fe293d`에 재사용했다. 1차 기준 diff(`290a11f..2fe293d`)는 제품 4파일, 테스트 3파일, 공통 기록 3파일의 총 10파일(151 insertions / 51 deletions)이며 `git diff --check`는 통과했다.

전 도구 회귀·전체 시각 회귀·성능 검사는 PLAN §6의 적용 대상이 아니다. 남은 unit 4건은 계획대로 이월하며 이번 통합의 신규 실패는 없다. Astra 검수와 Claude 판정 전이므로 push, main 수정, 배포, 운영 확인은 수행하지 않았다.

**최종 상태: 구현·검증 완료, 운영 미반영.**

— Codx

## 2차 재병합·무효화 검사·기록 보정

- 병합 전 HEAD `2fe293d412e667fe916e25258a39c73a0db2786c`에서 `git merge --no-ff --no-edit work/followup-b-20260920`을 실행해 exit 0, merge commit `40972dc3fed5c0b8d856e654dc116d798671b79c`를 생성했다. 부모는 `2fe293d`와 Astra 차단 보강 제출 `cc95a94`다.
- `git diff 2fe293d..40972dc --stat`는 `tests/unit/feature-locales.test.ts` 1파일, 1 insertion / 1 deletion뿐이다. KO 자동 연결 단언은 긍정 구절에도 통과하던 표현에서 `자동으로 연결한 것은 아닙니다`를 정확히 검사하는 표현으로 보강됐다.
- `node --experimental-strip-types --test tests/unit/feature-locales.test.ts`는 exit 0, 4/4 통과(취소·스킵 0)다. 로그: `/tmp/wl-followup/integration/logs/pass2-feature-locales.log`, 종료 코드: `pass2-feature-locales.exit`.
- `npm run test:unit`은 exit 1, 605 실행 / 601 통과 / 4 실패 / 취소·스킵 0으로 종료했다. 실패는 예상한 `p1b-components` 3건과 `ui-legacy-isolation` 1건뿐이며 신규 실패는 없다. 로그: `/tmp/wl-followup/integration/logs/pass2-test-unit.log`, 종료 코드: `pass2-test-unit.exit`, 실패 목록: `pass2-test-unit-failures.txt`.
- 1차 `build`·`test:static`·`test:ads`·시각 확인 결과를 재사용한다. 1차 후 제품 코드·빌드 입력·의존성·fixture·광고/브라우저 검사기·`dist`가 변경되지 않았고, 2차 merge는 unit 테스트 1파일의 부정 구절 단언만 보강했다. 따라서 무효화된 `feature-locales`와 전체 unit만 재실행했다.
- `docs/review-notes.md`의 “기대를 낮추지 않았다”를 실제 SEO·FAQ·feature-locales 변경 내용으로 교체하고 Claude 판정·Muse 서명을 명시했다. 기록 보정 커밋 `10186dfeaec33466c5e3198ded866e45eb391f56`은 이 문서 1파일만 변경한다.
- 기록 커밋은 제품·테스트·설정·의존성·fixture를 바꾸지 않으므로 `40972dc`에서의 2차 검사 결과는 최종 통합 후보 `10186dfeaec33466c5e3198ded866e45eb391f56`에 유효하다.
- 2차 전후·병합 근거: `/tmp/wl-followup/integration/logs/pass2-premerge-state.log`, `pass2-merge.log`, `pass2-merge.exit`, `pass2-postmerge-state.log`.
- push·main 반영·배포·운영 확인은 수행하지 않았다.

**2차 최종 상태: 구현·검증 완료, 운영 미반영.**

— Codx
