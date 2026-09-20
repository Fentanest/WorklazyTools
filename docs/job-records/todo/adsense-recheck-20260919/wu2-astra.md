WU2 결과 검수 — adsense-recheck-20260919 / WU2

검수자: Astra. Claude 감사·최종 판정에 제출하는 기술 검수 소견이다. 검수일: 2026-09-20 KST. 대상: `/tmp/wl-adsense/review/wu2-src`, 기준 `29fe72c`, 제출 HEAD `c40c2ebce243f8f2fda6c7f889502e62fef7687c`. 아래 상대 경로는 이 worktree 기준이다.

1. 대상 고정·실제 diff·증거

[비차단] 시작 명령과 출력:

```text
git -C /tmp/wl-adsense/review/wu2-src status --short
(출력 없음, exit 0)
git rev-parse HEAD
c40c2ebce243f8f2fda6c7f889502e62fef7687c (exit 0)
```

`git log --oneline 29fe72c..HEAD`: a48121a / 81b3fa1 / 7bfcf7c / c40c2eb, 총 4개. `git diff 29fe72c..HEAD --stat`: package.json +1, src/components/AdSenseLoader.tsx +5, tests/ad-eligibility-smoke.mjs +710, tests/helpers/ad-stub.mjs +108, 총 4파일 +824. 마지막 두 커밋도 실제로는 테스트 기록 코드 변경이며 단순 문서 커밋이 아니다. `git diff --check 29fe72c..HEAD` exit 0.

먼저 위 diff와 테스트 전체, PLAN.md §4·§8·§9, 결과 JSON을 읽고 보고의 결론과 대조했다. 제출 JSON은 27행 모두 `pass:true`, 각 행의 `counters.allowedExternal=0`이다. 26개 PNG와 모든 evidence 참조 대상이 존재한다. 이것은 제출된 실행의 관측이며 이번 검수의 27/27 재현 결과가 아니다.

증거 식별:

- `tests/visual-artifacts/adsense-recheck/ad-smoke-results.json`: 86,733 bytes, SHA-256 `777eabb57c85943bacaa48fe43fec26fb17be3121b4b2f46510e68664a57b6fd`. meta 실행 시간 2026-09-19T16:16:49.222Z–16:18:37.622Z, 4182, LOCAL_QA 미설정.
- `ad-smoke-discrimination.json`: 229 bytes, SHA-256 `7e9415abf3fde67c45baecebc3e7d227a796641db22d3a8c69599ff1e0c919d1`.
- Muse 보고 `docs/jobs/todo/adsense-recheck-20260919/WU2-REPORT.md:83`은 c40c2eb와 동일 dist 실행을 주장한다. JSON의 최종 필드와 코드가 대응하지만 JSON 자체에 SHA·빌드 해시는 없다. 별도 콘솔 로그는 보관하지 않았다고 보고서:69에 명시한다. 수정 전 실패 실행 및 transform 실험 원본 로그도 제공되지 않았다. 따라서 관측 JSON·캡처·자체 판별력은 제한적으로 재사용하고, 독립 실행 성공 또는 빌드 동일성을 완전히 증명한 것으로 확대하지 않는다.

2. 로더 수정·기준 결함

[비차단 / 기존 결함의 최소 수정] a48121a의 원인 서술은 초기 Suspense fallback이 커밋되는 조건에서 코드상 성립한다.

1) 기준 `git show 29fe72c:src/components/AdSenseLoader.tsx`의 초기 state는 `isAdIneligible()`=false, 동의는 granted이다. `src/app/App.tsx:36,97,163`에서 text-merger는 lazy/Suspense 경로이고 fallback의 layout effect가 `routePending=true`를 설정한다.
2) `src/app/adEligibility.ts:5`는 Set의 전체 boolean이 달라졌을 때만 동기 dispatch한다. layout effect의 true dispatch는 로더의 passive 구독 연결보다 먼저여서 유실될 수 있다.
3) 기준 로더의 구독 effect는 현재 값을 읽지 않는다. 이어지는 삽입 effect는 로컬 state=false여도 직접 읽은 `isAdIneligible()`=true로 조기 종료한다.
4) 정상 lazy 완료 시 fallback cleanup이 pending을 false로 만들고 이벤트를 보낸다. 로컬 state도 이미 false이므로 `setIneligible(false)`는 변경을 만들지 않는다. 동의와 ineligible 의존성이 유지되어 삽입 effect가 재실행되지 않는다. 따라서 별도 동의·적격성 변화가 없으면 광고 미삽입이 유지된다. 이는 기준 코드에서 실제 가능한 결함으로 논리 확정한다. 수정 전 브라우저 재현을 새로 수행했다는 뜻은 아니다. 빠른 캐시 적중 등 fallback이 커밋되지 않는 모든 lazy 진입까지 “절대 삽입 안 됨”으로 일반화한 보고서:28의 표현은 좁혀야 한다.

현재 `AdSenseLoader.tsx:18–27`의 구독 시 `handleEligibility()` 한 번이 누락된 true를 동기화한다. 이후 false 전환이 state 변경을 만들어 삽입 effect를 재실행한다. effect 의존성은 빈 배열이고 boolean 동값은 재렌더 원인이 아니며 dispatch도 하지 않아 자체 무한 루프는 없다. 5줄 중 실행문은 1줄, 나머지는 설명 주석이다.

광고 범위는 넓히지 않았다. `AdSenseLoader.tsx:30`의 PROD/LOCAL_QA/동의/로컬 및 전역 ineligible/중복 태그 조건은 동일하고, `AppShell.tsx:45–50,74–79,121`의 4경로군·격리 경로 제외 및 문서 교체도 무변경이다. 제출 S2/S3는 허용 경로 정상 완료 뒤 1, S1/S4/S8은 0으로 이를 뒷받침한다. 이미 삽입한 광고가 후속 같은 문서 오류에서 남는 S5는 별도 잔여 위험이며 이번 수정으로 해결됐다고 보지 않는다.

3. 네트워크 격리·계수

[비차단] `tests/helpers/ad-stub.mjs:50–99`는 context에 탐색 전 `**/*` 라우팅을 설치하고, 로컬 origin만 continue한다. 정확한 client query까지 포함한 AdSense URL만 fulfill하고 JS Content-Type·ACAO `*`·no-store를 붙인다. 다른 HTTP(S)는 분석 호스트 포함 abort한다. 다른 포트도 다른 origin이다. 비 HTTP(S) continue 분기는 외부 HTTP(S) 허용이 아니다. 스텁은 loads 증가와 push 무동작 계수만 수행한다(:17–28).

[비차단 / 새 실행] 실제 헬퍼를 import한 네트워크 없는 Node mock-route 표본: `node --input-type=module`에서 local URL, 정확 광고 URL, query가 추가된 광고 URL, 두 분석 호스트, example.invalid, 다른 로컬 포트를 각각 stub=true/false로 호출했다. 14개 분기·CORS/Content-Type·스텁 loads=1/pushes=1 단언 모두 통과(exit 0, 2026-09-19T16:26:01Z). stub=true 계수 attempt/stub/blocked/allowedExternal=1/1/5/0, stub=false=1/0/6/0. 실제 요청·브라우저 실행은 없었다. 이는 브라우저 격리 검사의 대체가 아니다.

[비차단 / 정적 확인·제출 결과 재사용] SW 허용 context에도 동일 firewall을 탐색 전에 설치한다(`ad-eligibility-smoke.mjs:49–59,426`). 설치된 Playwright 1.63.0의 `node_modules/playwright-core/lib/coreBundle.js:38200–38222,38271–38295`는 Chromium SW 네트워크를 context requestInterceptors로 전달한다. video의 COI worker는 실제 fetch를 전달한다(`node_modules/coi-serviceworker/coi-serviceworker.js:24–36`, `scripts/generate-static-pages.mjs:82–99`). 제출 video/trim JSON은 COI=true, SW controller 존재, 분석 차단 2를 기록한다. 현재 `PLAYWRIGHT_DISABLE_SERVICE_WORKER_NETWORK`는 미설정이다. SW 때문에 무조건 우회된다고 판정할 근거는 없다. 다만 제출 실행의 해당 환경변수 기록·SW 소유 요청 식별 로그는 없어 별도 실측 보증 범위는 제한된다.

[비차단 / 신규 검증 누락] 계수 정의 자체는 맞으나 “모든 시나리오에서 0 단언”은 사실이 아니다. S6-ko-merge(:341–357), S5-1a(:529–555), discrimination(:645–660)에는 `assertNoRealNetwork`가 없다. S5-1a의 네 종류 계수는 반환조차 하지 않고 stubTotal만 남긴다. `allowedExternal`은 0 초기화 후 증가 지점이 없는 구조상 상수(:37)로, 라우팅 밖 유출을 감지하는 독립 계측이 아니다. 현재 helper의 외부 continue 부재와 함께 해석해야 한다. 실유출 발견으로 판정하지 않되 누락 단언·계수는 보완해야 한다.

[비차단 / 신규 기록 누락] §4-1의 시나리오·문서별 네 계수, 문서별 loads 및 테스트 프로세스 누적값은 완전하게 보존되지 않는다. counters는 context 단위이고 S5-1a는 폐기되며, 대부분 행에 externalLog가 없다. S6/S7 공유 세션을 행별 합산하면 중복되고, 전 문서 loads도 보존하지 않는다. 총 실제 허용 0이라는 표현은 27행에 기록된 값의 범위로 제한한다.

4. 시나리오 27행 대응

아래 J는 `tests/visual-artifacts/adsense-recheck/ad-smoke-results.json`의 행 번호다. A/S/B/E는 attempt/stub/blocked/allowedExternal이다. 모두 제출 증거 재사용이며 새 브라우저 재현이 아니다.

| 시나리오 | JSON | 실제 관측 | 검수 |
|---|---:|---|---|
| S1-unset | J14 | script 0, A/S/B/E=0/0/0/0 | [비차단] 기대 일치 |
| S1-denied | J111 | script 0, 0/0/0/0 | [비차단] 기대 일치 |
| S2-ko | J208 | script=loads=1, 1/1/2/0 | [비차단] 기대 일치 |
| S2-en | J325 | EN text-merger, script=loads=1, 1/1/2/0 | [비차단] 기대 일치 |
| S3-delay | J442 | 로딩 372ms 관측 중 0, 2301ms 완료 후 script/loads 1 | [비차단] 기대 일치; 보고의 368/2303ms와 소폭 다른 실행 수치 |
| S4-chunk-failure | J542 | 404 2건, reload 1, script 0, 0/0/4/0 | [비차단] 오류 경계 캡처 일치 |
| S6-ko-merge | J680 | 링크 0이라는 별도 검사, 2/2/4/0, 제외 경로 이동 없음 | [차단] S6 미실행·N/A 오판 |
| S6-ko-hwp | J709 | 이동 중 새 문서 1, +stub 0, 1/1/4/0, 5초 추가 0 | [비차단] 핵심 단언 일치; docs에 후속 S7 혼입 |
| S6-ko-doccompare | J870 | 새 문서 1, +stub 0, 1/1/4/0, 301 별도 | [비차단] 핵심 단언 일치 |
| S6-en-doccompare | J1001 | 새 문서 1, +stub 0, 1/1/4/0, 301 별도 | [비차단] EN 표본 충족 |
| S7-back | J1132 | script/loads 1, 태그 ≤1, 새 문서 1, 누적 2/2/6/0 | [비차단] 기대 일치 |
| S8 KO pdf-editor | J1172 | script 0, 0/0/2/0 | [비차단] 직접 진입 |
| S8 KO pdf-editor/ocr | J1283 | script 0, 0/0/2/0 | [비차단] 직접 진입 |
| S8 KO hwp-editor | J1394 | script 0, 0/0/2/0 | [비차단] KO 전용 |
| S8 KO document-compare | J1505 | script 0, 0/0/2/0 | [비차단] 직접 진입 |
| S8 KO document-compare/results/1 | J1616 | expired marker 1, script 0, 0/0/2/0 | [비차단] 만료 안내 실제 열람 |
| S8 KO pdf-compare | J1727 | script 0, 0/0/2/0 | [비차단] 직접 진입 |
| S8 KO office-editor/app | J1838 | office meta, COI/SW, 2문서, 본문 991자, 0/0/0/0 | [비차단] 상태 기록 있음 |
| S8 KO excel-merger/xls-preserve | J1958 | excel meta, COI/SW, 2문서, 본문 3123자, 0/0/0/0 | [비차단] 상태 기록 있음 |
| S8 KO video-studio | J2078 | video meta, COI/SW, 2문서, 본문 2116자, 0/0/2/0 | [비차단] 상태 기록 있음 |
| S8 KO video-studio/trim | J2198 | video meta, COI/SW, 2문서, 본문 2357자, 0/0/2/0 | [비차단] 준비 화면 실제 열람 |
| S8 KO document-redactor | J2318 | redactor meta, COI=false/SW=null, 본문 1617자, 0/0/0/0 | [비차단] 상태 기록 있음 |
| S8 EN pdf-editor/merge | J2429 | script 0, 0/0/2/0 | [비차단] EN 직접 진입 |
| S8 EN document-compare | J2540 | script 0, 0/0/2/0 | [비차단] EN 직접 진입 |
| S9-file-then-move | J2651 | 항목 2→0, 대화상자 [], 문서 교체, script 0 | [비차단] 관측 기록; 상태 유실 판정은 Claude |
| S5-same-url-error | J2863 | 1a reload 후 script 1/stub 누적 2/경계 없음; 1b 처음부터 stub 0/오류 | [차단] 원래 S5 완료 증거 아님 |
| S10-mobile-overlay | J3066 | UNVERIFIED, 스텁만 로드 | [미확인] 실제 overlay 미검증 |

[비차단] S8은 요구 KO 11경로+EN 2표본을 모두 담는다. 모든 S8행에서 loading=0·routeError=0과 finalUrl·meta·bodyChars가 기록됐다. `ad-eligibility-smoke.mjs:442–452`의 일반 부팅 단언은 200자 이상 본문으로도 통과할 수 있어 도구 준비를 강하게 보증하지는 않는다. 이번 video 표본은 실제 준비 화면을 확인했다. EN HWP 정상 리다이렉트 기록은 27행에 없으며 보고서에도 구체 관측이 없다. `App.tsx:152–154`의 KoreanOnlyRoute는 이를 구현하지만 런타임은 [미확인]이다.

5. 통합을 막는 검증·보고 결함

[차단 / 신규] S5 대체 시나리오를 원래 S5 pass로 계수했다.

`ad-eligibility-smoke.mjs:517–599`, 보고서:55–60을 대조하면 (1) 사용자 동작 lazy 실패를 먼저 시도한 순서는 맞다. 그러나 1a는 reload 후 정상 화면으로 돌아오고 stub 총 2이며, 1b는 광고가 한 번도 삽입되지 않은 다른 context의 직접 진입 실패다. 어느 쪽도 “정상 script 1 → 같은 문서·URL 오류 화면 → 새 스텁 0·총 1·기존 태그 잔류 기록”을 검증하지 않는다. 1b는 S4와 유사한 초기 chunk 실패 표본으로 별도 보존할 수 있다.

보고서:59는 transform을 시도했다고만 하며 주입 코드·대상·요청·결과 로그가 없다. 모듈 평가 실패와 이미 로드된 컴포넌트의 후속 React 렌더 오류는 다르다. `chunkRecovery.ts:10–25`는 vite:preloadError만 reload하고, `RouteErrorBoundary.tsx:10–16,26–38`의 일반 렌더 오류 경계 자체는 자동 reload하지 않는다. 따라서 “같은 문서 잔류 위험은 reload 설계상 발생할 수 없음”(보고서:60,75, JSON:2895)은 근거 없는 일반화다. 순수 렌더 오류에서 기존 script 잔류 위험은 [미확인]으로 명시해야 한다.

해소 조건: §4-2의 (2) 실제 후속 렌더 오류 주입과 경계 도달 증거를 남기거나, 불가하면 시도·실패 근거와 함께 원래 S5를 재현 불가/미확인으로 분리하고 pass에서 제외한다. 잔류 위험은 §9에 남긴다. 제품 잔류 광고 제거를 새 구현 요구로 올리는 소견은 아니다.

[차단 / 신규] S6 PDF 경로군 검사 누락을 N/A로 정당화했다.

`ad-eligibility-smoke.mjs:337–357`은 `/tools/pdf-editor/merge` 정확 href만 검색한다. 그러나 `toolRegistry.ts:147–149`에 `/tools/pdf-editor`, `useToolCatalog.ts:19–23`에 언어 prefix, `AppShell.tsx:165`에 실제 NavLink가 있고, `App.tsx:63`에 정상 PDF 루트가 있다. 이 링크로 허용 경로에서 PDF 제외 경로군으로 SPA 이동 후 문서 교체를 시험할 수 있다. 루트는 merge URL과 동일 경로가 아니므로 대체를 명시해야 하지만 제품 링크 추가는 필요 없다. S8 직접 진입은 기존 광고 문서의 전환을 시험하지 않으므로 S6 대체가 아니다. 코드 주석:340의 “merge 양언어 S8 직접 진입”도 틀리다. 실제 S8은 KO 루트/ocr, EN merge이다.

해소 조건: PDF 루트 NavLink를 통한 S6 표본을 추가·명시하고, 정확 merge 링크 부재와 PDF 경로군의 전환 가능을 구분한다. 기존 미실행 행은 pass로 합산하지 않는다.

[차단 / 신규] §8 상태 구분을 무시한 27/27 집계.

`runCase`(:152–160)는 예외가 없으면 무조건 pass=true다. 이에 따라 N/A인 S6-ko-merge와 UNVERIFIED인 S10도 :683–699의 통과 분자에 들어가고, 미충족 S5도 포함된다. PLAN.md:174–175는 적용 대상 아님·재현 불가·미확인을 통과로 합산하지 말라고 명시한다. 보고서:32,66,83의 27/27은 실행 함수 무예외 집계일 뿐 완료 기준 통과 수가 아니다. 최소 3행을 분리해야 하며, 나머지 24행도 S9는 관측 완료이지 제품 동작 승인 판정이 아니다. 이 집계 수정은 제품 코드 변경 없이 가능하다.

6. S6 문서 교체·SPA/301 계수

[비차단] 핵심 문서 교체 단언은 초기 진입을 제외한다. :291의 commitsBefore, :309의 slice, :310의 정확히 1회 단언, :313–315의 5초 추가 0이 있고, 최상위 CDP Page.frameNavigated loaderId를 이용한다(:77–95). 같은 문서 pushState는 해당 새 문서 커밋과 별개이며 서버 301도 :318에 따로 기록한다. 제출 KO/EN doccompare는 처음+새 문서 2개와 301 1개로 맞는다.

[비차단 / 신규 기록 결함] :324는 docCommits 배열을 복제하지 않아 S6-ko-hwp 결과에 이후 S7 복귀 문서가 혼입된다(J709의 세 번째 문서 시간 16:17:23.297Z는 해당 행 ended 16:17:07.944Z 이후). 당시 exact-one 단언은 유효하나 저장된 행만 length-1 하면 오판한다. 단계별 스냅샷을 남겨야 한다.

[비차단 / 신규 기록 결함] :324의 spaMoves는 새 문서 after.nav만 기록한다. `addInitScript`(:60–67)가 매 문서 0으로 초기화하므로 이전 문서 NavLink의 pushState는 사라진다. 현재 기록 push=0/replace=1은 전환 전체 SPA 횟수가 아니며 새 문서 초기화 수치다. 소스 문서의 SPA 사건을 별도 수집할 필요가 있다.

[권고] :92는 마지막 저장값(loaderId 뒤 6자리)과 새 전체 loaderId를 비교한다(:93). 중복 제거 비교가 같은 표현이 아니다. 현재 제출 커밋수 자체가 틀렸다는 실측 증거는 없고 일반적인 CDP 새 문서 이벤트로는 값이 맞지만, 전체 ID로 비교하고 출력 시에만 축약하는 편이 정확하다.

7. 자체 판별력

[비차단 / 제출 결과 재사용] `--discriminate`(:641–663)는 stub:false를 전달하며 helper :83–86은 abort를 유지한다. 제출 discrimination JSON:1–6의 expectedFailure는 실제 `stub expected` assertion이다. 이 제출 실행이 다른 timeout을 광고 단언 실패로 보고했다는 징후는 없다. 오프라인 helper 실행도 stub=false에서 정확 광고 URL이 abort되고 stub=0임을 확인했다.

[권고 / 신규 검사기 취약점] :654–656은 탐색·대기·assert를 포함한 모든 예외를 checkerFailed=true로 삼는다. 향후 timeout도 “판별 성공”으로 오판할 수 있다. 기대 assertion인지 확인하고 attempt·stub·blocked·allowedExternal 및 loads를 실패 결과에도 기록해야 한다. 이번 브라우저 자체 판별력 재실행은 서버 권한 오류로 수행 불가다.

8. 필수 독립 실행 결과

[미확인 / 환경 제약, 제품 신규 실패로 분류하지 않음] 설치된 node_modules를 사용했다. npm ci, 추적 파일 수정, 빌드 우회, 권한 완화는 하지 않았다. 두 명령 모두 정확히 1회 시도했다. Python subprocess wrapper로 전체 stdout/stderr를 수집하고 UTC 시작·종료·monotonic 경과·종료 코드를 기록했다.

| 명령 | 시작 UTC | 종료 UTC | 경과 | exit | 실제 범위 |
|---|---|---|---:|---:|---|
| `env -u VITE_LOCAL_QA npm run build` (subprocess 환경에서 해당 키 제거) | 2026-09-19T16:24:20.314000Z | 16:24:21.066402Z | 0.752초 | 1 | prebuild guides·dependency patch·rhwp 검증 후 벤더 다운로드 실패 |
| `RECOVERY_TEST_PORT=4283 npm run test:ads` | 2026-09-19T16:24:52.209795Z | 16:24:52.875731Z | 0.666초 | 1 | 서버 listen 실패, 브라우저·시나리오 0건 |

핵심 실제 출력:

```text
Guides validation passed.
Dependency patches verified: pdfjs-dist@6.2.108 (RGB source offsets).
rhwp Studio 0.8.6 vendor validation passed (77 files, 60680448 bytes).
TypeError: fetch failed
  at async vendorZetaOffice (.../scripts/vendor-browser-runtimes.mjs:102:24)
  [cause]: Error: getaddrinfo ENOTFOUND cdn.zetaoffice.net
  code: 'ENOTFOUND'
Node.js v22.17.1

> worklazytools@0.1.0 test:ads
> node tests/ad-eligibility-smoke.mjs
Error: listen EPERM: operation not permitted 127.0.0.1:4283
  code: 'EPERM', errno: -1, syscall: 'listen',
  address: '127.0.0.1', port: 4283
Node.js v22.17.1
```

`vendor-browser-runtimes.mjs:74–111`은 고정 해시를 만족하는 로컬 캐시가 없으면 네트워크에서 가져오는 기존 처리다.
해당 캐시는 비어 있고 dist도 없었다. 빌드 실패로 현재 소스의 실행용 dist가 만들어지지 않았으며 스모크는 그보다 앞선 listen 권한 단계에서 실패했다. 특정 시나리오 실패나 타이밍 불안정으로 판정할 수 없고 27/27·allowedExternal=0 독립 재현을 달성하지 못했다. 4181·4182는 새 실행에 사용하지 않았다. 광고 도메인으로 실제 요청을 내보내지 않았다. 자동 승인 재심사 거절이 아니라 실행 환경의 DNS/소켓 오류이며 권한 변경 요청은 하지 않았다.

F 적용 구분: 이번 실행은 필수 build/test:ads 시도 및 네트워크 없는 helper 분기 재현, 재사용은 Muse JSON·PNG·discrimination, 이월은 실행 가능한 지정 환경에서의 성공 빌드와 4283 스모크 및 수정된 S5/S6 표본이다. 전체 unit/static/전 도구 회귀는 WU2 이번 독립 검수 대상이 아니며 PLAN §6의 통합 담당 검사로 남긴다. 실패한 필수 독립 재현을 기존 통과 기록으로 대체 완료 처리하지 않는다.

9. 편차·캡처·남은 판정

[비차단 / 요구 누락] `package.json`은 기준·HEAD 모두 마지막 바이트가 `}`이고 LF가 없다(`git show` byte 검사). §4-1의 끝 개행 복원은 미수행이다. 보고서:20에도 유지했다고 명시한다. 런타임 영향은 없으나 지시 이행은 정정해야 한다. 보고서:17의 “커밋 3건”도 실제 4건과 맞지 않는다.

[비차단] diff상 AppShell 비광고 줄·라우팅·guides·seo·검증기·의존성 변경 없음. 제품 범위 위반 없음.

[비차단 / 실제 열람] 기존 PNG 5개를 view_image로 열었다. 새로 촬영한 증거가 아니다.

- `S4-error.png`: 도구 로드 실패 안내와 다시 시도 버튼, 정상 앱 shell. route-error 상태와 일치.
- `S5-error.png`: 같은 오류 경계 화면. S4와 파일 해시까지 같음(`75af65f78f0c2041340e8c5b58af081308cd6230a38d859adf896f6fdfa65fca`). 공통 경계 UI이므로 동일 화면 자체는 이상이라고 단정하지 않는다. URL·이전 광고·같은 문서 전환은 이 캡처만으로 증명하지 못한다.
- `S8-_ko_tools_document-compare_results_1_.png`: “비교 결과를 다시 열 수 없어요”, 문서 재선택·탭 내 유지 안내. 만료 marker 1과 일치.
- `S8-_ko_tools_video-studio_trim_.png`: 비디오 자르기/스튜디오와 “멀티스레드 인코딩 준비됨”, 파일 선택 UI. 빈 화면이 아니며 COI 준비 상태 기록과 일치.
- `S2-ko.png`: 텍스트 병합 입력 UI가 있으며 오류 경계가 아니다. 본문이 옅게 보인다. `.page-enter` 0.42초 등장 애니메이션(`src/styles/global.css:329`) 중 촬영 가능성이 있으나 원인 확정은 아니다. script/stub 존재는 PNG로 확인할 수 없고 JSON/DOM 계측 근거다. [권고] 안정화 후 캡처하면 가독성이 좋아진다.

[미확인] S10 실제 광고 overlay, 실제 노출·계정 Auto ads 설정·심사 결과·운영 반영은 검수하지 않았다. S9 파일 상태 유실과 경고/취소 흐름의 최종 적정성은 Claude 판정 입력이다. 이번 변경의 신규 제품 결함으로 확정하지 않는다. S5 순수 렌더 오류 잔류 광고는 위와 같이 미확인으로 유지한다.

추적 파일 수정·커밋·push·배포 없음. 검수 보고서 외 생성물은 빌드 시도에서 만든 worktree 내부 gitignore 벤더 산출물뿐이며 제출 증거 JSON·캡처는 변경하지 않았다.

10. 종료 상태

[비차단] 종료 명령과 실제 출력:

```text
git -C /tmp/wl-adsense/review/wu2-src status --short
(출력 없음, exit 0)
git rev-parse HEAD
c40c2ebce243f8f2fda6c7f889502e62fef7687c (exit 0)
```

시작·종료 모두 clean, HEAD 동일. 제출 두 JSON SHA-256 재확인도 일치했다. 산출물은 이 보고서 `/tmp/wl-adsense/review/wu2-astra.md` 한 파일이다. 제품 수정의 최소성은 확인했지만 검증 완료 판정은 보류한다. 지정 구현자의 S5/S6·집계·기록 보완 뒤 해당 변경만 재검수하고, 실행 가능한 검수 환경에서 필수 빌드/스모크 성공 증거를 회수해야 한다. Claude의 감사·최종 판정 및 통합·배포 권한을 대신하지 않는다.

WU2 통합 후보 적합 여부: 부적합(S5 요구 미충족을 pass로 계수, S6 PDF 전환 검증 누락, N/A·미확인 통과 합산; 필수 독립 빌드·스모크도 환경 오류로 미완료).
