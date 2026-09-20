# WU-A 구현 보고

| 항목 | 값 |
|---|---|
| 작업 ID | `adsense-followup-20260920 / WU-A` |
| 구현자 | Codx (Sol) |
| worktree / branch | `/home/better0101/projects/wt-followup-a` / `work/followup-a-20260920` |
| 기준 커밋 | `290a11f94025b040d935e8a9f104241a9ca72fe7` |
| PLAN | v0.2, SHA-256 `440f68c2464dbdf8df85822f7f8554e8af0473f84421ae3cac2e6f23dbe87cd3` |
| 최종 SHA | `cb2331210d3a4a6c511a84b17d1a40554ad7b02e` |
| push / 통합 / 배포 | 수행하지 않음(WU-A 범위 밖) |

## 커밋과 변경 파일

- `0c5566760e22a99e82c948235d904c909efa2e2e` `fix(ui): hide mobile bottom tabs on desktop`
  - `src/styles/global.css`: `@media (max-width: 820px)` 앞 전역 `.bottom-tabs { display: none; }` 추가. 모바일 블록의 `display: grid`와 3열 규칙은 유지.
- `33d529eede13f5b68d346de24ad8590235141982` `feat(pdf-compare): show tool guide`
  - `src/features/pdf-compare/PdfComparePage.tsx`: `ToolGuideWrapper` 직접 import 및 마지막 `UtilityNotice` 다음, `UtilityPage` 내부 마지막 자식으로 `<ToolGuideWrapper slug="pdfCompare" />` 추가.
- `cb2331210d3a4a6c511a84b17d1a40554ad7b02e` `fix(build): use explicit .ts imports for utils`
  - `src/features/document-generator/storage.ts`: `../../lib/utils.ts`.
  - `src/features/pdf-editor/finish/resultStorage.ts`: `../../../lib/utils.ts`.

`290a11f..cb23312` diff는 위 제품 파일 4개뿐이며 6 insertions / 3 deletions이다. 테스트, 가이드 데이터, package 파일, 광고 정책은 수정하지 않았다. React 변경은 정적 직접 import와 기존 wrapper 배치뿐이라 새 상태·effect·event listener·재렌더 경로를 만들지 않는다.

## 검사 결과

| 검사·범위 | 판정 | 명령·종료 코드 | 결과·증거 |
|---|---|---|---|
| 변경 전 3개 unit 기준 | 실행(예상 실패) | `node --experimental-strip-types --test tests/unit/document-generator.test.ts tests/unit/pdf-finish-engine.test.ts tests/unit/pdf-finish-modules.test.ts` · exit 1 | 확장자 없는 `src/lib/utils`를 찾지 못해 파일별 로딩 실패. tests 3 / pass 0 / fail 3. `/tmp/wl-followup/a/logs/unit-before.log` |
| 변경 후 같은 3개 unit 파일 | 통과 | 같은 명령 · exit 0 | 실제 하위 테스트 tests 61 / pass 61 / fail 0. 총 실행 수 3 → 61. `/tmp/wl-followup/a/logs/unit-after.log` |
| production build | 통과 | `npm run build` · exit 0 | tsc + Vite 2,914 modules + 정적 101 pages. `/tmp/wl-followup/a/logs/build.log` |
| 정적 산출물 | 통과 | `npm run test:static` · exit 0 | localized/metadata/runtime/ads.txt/robots/sitemap 통과, startup recovery 164 documents. `/tmp/wl-followup/a/logs/test-static.log` |
| preview | 통과 후 정상 종료 | `npx vite preview --port 4191 --strictPort` · 기동 성공, 브라우저 검사 후 SIGINT 종료(exit 130) | `http://localhost:4191/` 제공. `/tmp/wl-followup/a/logs/preview.log` |
| 지정 브라우저 DOM·캡처 | 통과 | `node /tmp/wl-followup/a/playwright/browser-checks.mjs` · exit 0 | Playwright + `/usr/bin/google-chrome` 153.0.8010.36. 기존 `tests/helpers/ad-stub.mjs`의 `installAdFirewall`/`assertNoRealNetwork` 직접 재사용. allowedExternal 0, pageerror 0, console error 0. `/tmp/wl-followup/a/logs/browser-checks.log`, `/tmp/wl-followup/a/browser-results.json` |
| diff 형식 | 통과 | `git diff --check` · exit 0 | 오류 없음. |

빌드 후 제품 소스 변경은 없었고 검사는 최종 SHA `cb2331210d3a4a6c511a84b17d1a40554ad7b02e`의 소스와 그 production `dist`를 대상으로 했다.

## 브라우저 실측·육안 확인

- 데스크톱 1365×900 `/ko/tools/text-merger/`: 문서 하단에서 `.bottom-tabs` computed `display: none`, rect `0×0`, 모바일 탭 미노출.
- 모바일 412×839 같은 경로: computed `display: grid`, `position: fixed`, rect `392×72`; grid columns `126.656px 126.672px 126.656px`; 링크 3개가 모두 `y=764`, 좌→우 순서로 한 행 배치.
- `/ko/tools/pdf-compare/`, `/en/tools/pdf-compare/`: 언어별 `section[data-ui-component="tool-guide"]` 1개, 내부 FAQ `details` 3개.
- 캡처 4장을 원본으로 직접 열람했다. 데스크톱 하단 모바일 탭 노출, 모바일 탭 가림/세로 쌓임, PDF 가이드 카드·FAQ 배치 이상은 관찰되지 않았다.

캡처:

- `/tmp/wl-followup/a/shots/text-merger-desktop-bottom.png`
- `/tmp/wl-followup/a/shots/text-merger-mobile-bottom.png`
- `/tmp/wl-followup/a/shots/pdf-compare-ko-guide-desktop.png`
- `/tmp/wl-followup/a/shots/pdf-compare-en-guide-desktop.png`

## Excel 경계 계산 확인

`src/features/excel-compare/ExcelComparePage.tsx:535`의 `fixedChromeBoundary`는 계산 스타일의 `display === "none"`이면 `undefined`를 반환해 탭 rect의 `top`을 세로 경계로 쓰지 않는다. 이번 desktop 실측에서도 `.bottom-tabs` rect가 `width=0`, `height=0`이었고, 이어지는 기존 `rect.width <= 0 || rect.height <= 0` 조건으로도 제외된다. 따라서 데스크톱 탭 숨김은 `keepResultFocusVisible`의 경계 계산에 문제를 만들지 않는다.

## 도구 이슈·이월·미완료

- Playwright CLI 첫 실행은 기본 daemon 로그를 읽기 전용 `~/.cache`에 쓰려 해 `EROFS`로 실패했다. `XDG_CACHE_HOME=/tmp/wl-followup/a/playwright/cache`로 쓰기 범위를 고쳤지만 실행 호출 사이 daemon이 유지되지 않았다. 권한을 넓히거나 설치하지 않고, 동일 Playwright 라이브러리의 단일 임시 스크립트로 전환해 지정 Chrome 경로와 광고 차단 helper import를 고정했으며 최종 브라우저 검사는 통과했다. 제품 결함이나 필수 검사 미완료는 아니다.
- WU-A 필수 항목의 미완료·차단 결함은 없다.
- 전체 unit, WU-B, 통합·push·배포는 PLAN에 따라 이 단계에서 실행/수행하지 않고 통합 단계로 이월한다.

— Codx
