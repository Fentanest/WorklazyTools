# adsense-followup2-20260920 통합 보고

- 작업 ID: `adsense-followup2-20260920 / 통합`
- 통합 담당/기록 서명: Codx (Sol)
- 작업 공간/브랜치: `/home/better0101/projects/wt-followup2-integration` / `integration/adsense-followup2-20260920`
- 상태: **구현·검증 완료, 운영 미반영**
- push/main 수정/배포: 미수행

## 정본과 입력 확인

- 지정 정본 v0.2 원본은 WU-C·WU-D worktree에서 SHA-256 `c4d8e761c96d18f70c87a1ef8962fc743b880715fe80f09282797b41ff7a0911`로 확인했다.
- 통합 worktree의 `PLAN.md`는 v0.2 본문 뒤에 v0.2.1~v0.2.3 진행 기록 3줄이 추가돼 SHA-256 `d0179fb070c317286d21f65a01241f5fe9d45a25ac34018101a0fe9d1b56463d`였다. 지정된 §5·§6·§7은 원본과 동일함을 diff로 확인하고 진행했다.
- 제출 보고서 `WU-C-REPORT.md`, `WU-C-FINDINGS.md`, `WU-D-REPORT.md`는 원본과 SHA-256이 각각 일치하도록 이 폴더에 복사했다.

## merge와 커밋

| 단계 | SHA | 결과 |
|---|---|---|
| merge 전 HEAD | `10186dfeaec33466c5e3198ded866e45eb391f56` | branch clean. `2fe293d..HEAD`는 2파일, +2/-2 |
| WU-C merge | `25de50a3dd69975f423b9cd8d551e3b53cda27cd` | `a1330411173815de0ccbd3ab7ff5a5f3fcfe4d64`를 `--no-ff` merge, 충돌 없음, exit 0 |
| WU-D merge / merge 후 HEAD | `c6f5fc519a1286281cec5d0434eccfe8ee43bae6` | `8dd220c3af7b1c20181f87048ac1dd802f06857c`를 `--no-ff` merge, 충돌 없음, exit 0 |
| 통합 조정 커밋 | `b984a734d4e0ee8e6a03853be8ab90c7221f50a8` | ToolGuide 명시 소비자에 `office-editor/OfficeEditorAppPage.tsx` 1줄 추가, 24→25 |
| 공통 기록 커밋 | `0523801eaed1790c77b344d988297bfd3473012e` | CHANGELOG, review-notes, backlog, agent-dispatch-runbook만 반영 |

merge 직후 `10186df..c6f5fc5` diff는 5파일, +68/-16이었다. 최종 `10186df..0523801` diff는 9파일, +94/-17이다. 기록 커밋은 제품·테스트·빌드 입력을 바꾸지 않는 문서 4파일(+25/-1)만 포함하므로 `b984a73`에서 실행한 최종 검사 결과를 최종 후보에 재사용한다.

## 최종 검사

| 명령/확인 | 종료 코드 | 대상 수·결과 | 로그·증거 |
|---|---:|---|---|
| `node --experimental-strip-types --test tests/unit/p1b-components.test.ts` | 0 | 통합 조정 직후 4/4 통과 | `/tmp/wl-followup2/integration/logs/p1b-adjustment.log` |
| `unset VITE_LOCAL_QA; npm run build` | 0 | prebuild 가이드 49 App 경로, Vite 2,914 modules, 정적 101페이지 | `/tmp/wl-followup2/integration/logs/build.log` |
| `npm run test:unit` | 0 | **605/605 통과, 실패 0**; 실패 이름 없음 | `/tmp/wl-followup2/integration/logs/test-unit.log` |
| `npm run test:static` | 0 | localized/static 출력 통과, startup recovery 164 documents | `/tmp/wl-followup2/integration/logs/test-static.log` |
| `RECOVERY_TEST_PORT=4391 npm run test:ads` | 0 | 29시나리오: pass 26, not-applicable 1, recorded 1, unverified 1 | `/tmp/wl-followup2/integration/logs/test-ads.log` |
| `RECOVERY_TEST_PORT=4391 npm run test:ads -- --discriminate` | 0 | 음성 판별 1건: stub 제거 시 checker 실패 확인 | `/tmp/wl-followup2/integration/logs/test-ads-discriminate.log` |
| `TEST_BASE_URL=http://127.0.0.1:4391 node tests/office-editor-smoke.mjs` | 0 | 다운로드 상태 15, cached 상태 7, KO Calc 편집, 저장 DOCX 5,088 bytes | `/tmp/wl-followup2/integration/logs/office-editor-smoke.log` |
| Chrome 시각·DOM 확인 | 0 | KO/EN ready 각 guide 1·앱 블록 있음·FAQ 5, editing 각 guide 0; Excel checked/unchecked accent 동일 | `/tmp/wl-followup2/integration/logs/visual-check.log`, `visual-check.json` |

광고 기본 검사의 `not-applicable`·`recorded`·`unverified`는 검사기가 정의한 정상 분류이며 종료 코드 0이다. 실제 외부 HTTP(S) 허용은 시각 확인의 모든 컨텍스트에서 0이었다. `tests/helpers/ad-stub.mjs`의 fail-closed 방화벽과 Chrome `/usr/bin/google-chrome`, `XDG_CACHE_HOME=/tmp/wl-followup2/integration/playwright`를 사용했다.

## 시각 재확인

- `/tmp/wl-followup2/integration/shots/ko-office-ready.png`
- `/tmp/wl-followup2/integration/shots/en-office-ready.png`
- `/tmp/wl-followup2/integration/shots/ko-office-editing.png`
- `/tmp/wl-followup2/integration/shots/en-office-editing.png`
- `/tmp/wl-followup2/integration/shots/ko-excel-cleaner-accent.png`

5장을 직접 열람했다. ready 화면은 기존 편집기 아래 가이드·앱 전용 블록·FAQ 5개가 겹침·잘림 없이 보였고, 합성 `office-guide-check.docx`를 연 editing 화면에는 가이드가 없었다. Excel 합성 `formula.xlsx`의 첫 시트 checkbox는 checked/unchecked 모두 computed `accent-color: rgb(232, 80, 47)`이며 클래스는 `size-4 [accent-color:var(--primary)]`였다.

## 최종 후보

- 최종 통합 후보 SHA: **`0523801eaed1790c77b344d988297bfd3473012e`**
- branch/worktree 상태: clean
- 남은 판정: ToolCard 제목 `h2`/정본 `h3` 선택은 사용자 결정 대기. 이번 통합의 제품·검증 차단 결함은 없음.
- 최종 상태: **구현·검증 완료, 운영 미반영**
