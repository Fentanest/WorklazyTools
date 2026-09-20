**main 반영 후보 적합 여부: 적합 — 제품·검증 차단 결함 없음. 런북 문구 보완 권고 2건은 Claude 감사·최종 판정에 전달한다.**

작업 `adsense-followup2-20260920`, 브랜치 `integration/adsense-followup2-20260920`을 읽기 전용으로 1회 검수했다. 시작·종료 모두 `git status --short`는 빈 출력이며, HEAD는 `0523801eaed1790c77b344d988297bfd3473012e`로 동일했다. 수정·커밋·push·npm·빌드·브라우저 실행은 하지 않았다.

1. **[비차단] 통합 정합 일치**

   first-parent 이력은 WU-C merge `25de50a` → WU-D merge `c6f5fc5` → 소비자 조정 `b984a73` → 기록 `0523801`이다. 전체 지정 log에는 두 작업 브랜치의 구현 커밋 4개도 포함된다.

   기준 `10186df` 대비 **9파일, +94/-17**이다. WU-C 2파일과 WU-D 3파일, 공통 기록 4파일이다. p1b 조정은 WU-C 파일에 포함되며, 요청문의 “기록 3”은 열거된 파일 기준 **4개**다. WU-C 제출본 대비 p1b 소비자 1줄만 추가됐고 Excel 파일은 동일하다. WU-D 제출본 대비 3파일 diff는 모두 비었다. [통합 보고:19](/home/better0101/projects/wt-followup2-integration/docs/jobs/todo/adsense-followup2-20260920/INTEGRATION-REPORT.md:19)

2. **[비차단] WU-C 계약·동등 치환 적합**

   ToolGuide 실제 소비자 25개와 명시 목록이 정확히 일치한다. OperationProgress 소비자 16, 접근성·진행률·링크·추적·태그 최대 3개·registry 단언은 유지됐다. 색상 검사는 7 accent의 공통 primary/brand와 오류색 분리를 확인하며, ToolCard 변경은 `group`, `getToolIconTone`, `data-icon-tone`의 낡은 단언 갱신에 한정된다. h2 단언과 제품은 변경되지 않았다. [p1b:16](/home/better0101/projects/wt-followup2-integration/tests/unit/p1b-components.test.ts:16), [p1b:58](/home/better0101/projects/wt-followup2-integration/tests/unit/p1b-components.test.ts:58), [p1b:98](/home/better0101/projects/wt-followup2-integration/tests/unit/p1b-components.test.ts:98)

   FINDINGS의 유입 근거 `eea9b1e`, `92925e8`, `33d529e`와 h3→h2 이력 `c5b64f6`을 git 원문으로 확인했다. 첫 실패에서 중단되는 테스트와 소스 분석으로 확인한 5개 낡은 단언도 구분돼 있다. [WU-C-FINDINGS:5](/home/better0101/projects/wt-followup2-integration/docs/jobs/todo/adsense-followup2-20260920/WU-C-FINDINGS.md:5)

   Excel 변경은 **231행의 토큰 1곳**이다. ui-legacy 테스트·허용목록·global.css는 불변이다. 전후 checked/unchecked 색은 모두 `rgb(232, 80, 47)`이며, 전후 캡처와 통합 Excel 캡처의 SHA-256도 동일하다. 관련 검사 14/14 및 통합 B3 검사가 통과했다. [ExcelCleanerPage:231](/home/better0101/projects/wt-followup2-integration/src/features/excel-cleaner/ExcelCleanerPage.tsx:231), [전후 측정](/tmp/wl-followup2/c/logs/accent-after.json:5), [단위 로그:3212](/tmp/wl-followup2/integration/logs/test-unit.log:3212)

3. **[비차단] WU-D 삽입·상태·가이드 데이터 적합**

   가이드는 canvas shell 다음, drag overlay 앞의 형제로 삽입됐다. `!focusMode` 조건으로 비집중 6상태에서 표시되고 editing/saving에서는 비렌더링된다. 상태 전이·canvas 부모·ResizeObserver·COI/SW·드롭 처리 diff는 없다. 저장 성공·실패 모두 기존대로 editing으로 돌아간다. [OfficeEditorAppPage:587](/home/better0101/projects/wt-followup2-integration/src/features/office-editor/OfficeEditorAppPage.tsx:587), [focusMode:338](/home/better0101/projects/wt-followup2-integration/src/features/office-editor/OfficeEditorAppPage.tsx:338), [저장 처리:242](/home/better0101/projects/wt-followup2-integration/src/features/office-editor/OfficeEditorAppPage.tsx:242)

   KO/EN JSON은 `officeEditor`만 변경됐다. pathBlocks 끝 슬래시 제거, 랜딩과 같은 `faq_0`~`faq_4` 앱 선택 추가, EN Close 문장 1건 정정이 전부다. KO 문장은 원래 저장·다운로드를 안내하므로 유지가 타당하다. 앱 라우트와 Wrapper 정규화, 검증기의 정확 라우트·비어 있지 않은 선택·FAQ ID 존재 규칙을 충족한다. [KO:1589](/home/better0101/projects/wt-followup2-integration/src/locales/ko/guides.json:1589), [KO 경로 선택:1641](/home/better0101/projects/wt-followup2-integration/src/locales/ko/guides.json:1641), [EN:1585](/home/better0101/projects/wt-followup2-integration/src/locales/en/guides.json:1585), [검증기:171](/home/better0101/projects/wt-followup2-integration/scripts/validate-guides.mjs:171)

4. **[비차단] 증거 원문과 보고 표 일치·재사용 가능**

   | 검사 | 원문 확인 결과 |
   |---|---|
   | unit | **605/605**, fail·cancelled·skipped·todo 모두 0. [로그:3803](/tmp/wl-followup2/integration/logs/test-unit.log:3803) |
   | guides/build | 가이드 **49경로**, Vite 2,914 modules, 정적 101페이지, exit 0. [로그:11](/tmp/wl-followup2/integration/logs/build.log:11) |
   | static | 통과, startup recovery 164 documents, exit 0. [로그:5](/tmp/wl-followup2/integration/logs/test-static.log:5) |
   | ads | **29상태: pass 26·대상 아님 1·관찰 기록 1·미확인 1**, fail 0. JSON의 29개 `allowedExternal` 모두 0. [로그:37](/tmp/wl-followup2/integration/logs/test-ads.log:37), [결과 JSON:6](/home/better0101/projects/wt-followup2-integration/tests/visual-artifacts/adsense-recheck/ad-smoke-results.json:6) |
   | discriminate | 스텁 제거 시 checker 실패 판별 성공, exit 0. [로그:7](/tmp/wl-followup2/integration/logs/test-ads-discriminate.log:7) |
   | office smoke | 다운로드 상태 15·캐시 상태 7·KO Calc 편집·저장 DOCX 5,088 bytes, exit 0. [로그:1](/tmp/wl-followup2/integration/logs/office-editor-smoke.log:1) |
   | visual/DOM | KO/EN ready 각각 guide 1·앱 블록 존재·FAQ 5, editing guide 0. Excel checked/unchecked 색 동일. [측정 JSON:2](/tmp/wl-followup2/integration/logs/visual-check.json:2) |

   통합 증거의 실행 HEAD는 `b984a73`이고 이후 `0523801`은 문서 4파일만 바꿨으므로 검사 결과를 재사용할 수 있다. WU-D의 가이드 영역 드롭·opening 비활성·저장 중 비렌더링 증거도 관련 구현이 동일하여 재사용 가능하다. [통합 보고:25](/home/better0101/projects/wt-followup2-integration/docs/jobs/todo/adsense-followup2-20260920/INTEGRATION-REPORT.md:25), [WU-D 측정:11](/tmp/wl-followup2/d/office-guide-check.json:11)

   통합 5장·WU-C 2장·WU-D 4장의 캡처가 존재한다. 통합 [KO ready](/tmp/wl-followup2/integration/shots/ko-office-ready.png)와 [KO editing](/tmp/wl-followup2/integration/shots/ko-office-editing.png)을 직접 열람했고, 가이드·FAQ 표시와 편집 중 비노출을 확인했다.

   **[미확인]** 실제 광고 overlay 겹침 S10은 기존 미확인 상태다. 이번 보고는 이를 pass로 합산하지 않았다. 새 브라우저 재현 및 나머지 캡처의 독립 열람은 하지 않았다.

5. **[비차단] 공통 기록 적합 / [권고] 런북 조건 명확화**

   CHANGELOG의 사용자 영향 문구와 Codx 서명, review-notes의 계약·accent 동등 치환·h2/h3 회부 및 **“Claude 판정 / Codx 확인”**, backlog의 잔여 4건 해소·h2/h3 대기·Muse 정지 조사가 반영됐다. h2/h3는 기존 비차단 회부로 유지된다. [CHANGELOG:7](/home/better0101/projects/wt-followup2-integration/CHANGELOG.md:7), [review-notes:7](/home/better0101/projects/wt-followup2-integration/docs/review-notes.md:7), [backlog:7](/home/better0101/projects/wt-followup2-integration/docs/backlog.md:7)

   런북 +16줄은 ADDENDUM의 Codex·Muse·Gemini 취지와 일치한다. 권한 검사를 끄라는 추가 문구는 없고 `--auto` 권한 해제를 명시적으로 금지한다. 다만 다음 두 곳은 조건을 보완하는 편이 좋다.

   - **[권고·신규 문구]** 모든 Codex worktree 실행에 `writable_roots`·`npm ci` 준비를 요구하는 표현은 읽기 전용 검수에도 적용되는 것으로 읽힐 수 있다. **승인된 구현·설치 작업에 한정**한다고 명시하면 기존 역할별 권한 규칙과 명확히 맞는다. [런북:61](/home/better0101/projects/wt-followup2-integration/docs/agent-dispatch-runbook.md:61), [기존 권한 구분:44](/home/better0101/projects/wt-followup2-integration/docs/agent-dispatch-runbook.md:44)
   - **[권고·신규 문구]** 원인 미확인 부트스트랩 정지에 “1회 재시도”를 지시하는 문구는 기존 “수정 가능한 원인을 확인한 경우 재시도”와 조건이 다르다. 재시도 전 진단 조건 또는 이 사례의 제한적 예외를 명시할 필요가 있다. [런북:137](/home/better0101/projects/wt-followup2-integration/docs/agent-dispatch-runbook.md:137), [기존 재시도 규칙:164](/home/better0101/projects/wt-followup2-integration/docs/agent-dispatch-runbook.md:164)

검수 기준은 전달된 1차 반박 요지와 PLAN v0.2이며, 이번 소견은 Claude 감사·최종 판정의 입력이다. 커밋·원격 반영·배포는 수행하지 않았다.

Codex session ID: 01a0bcbc-4335-78c3-bc38-f006f4254286
Resume in Codex: codex resume 01a0bcbc-4335-78c3-bc38-f006f4254286
