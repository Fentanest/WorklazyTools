# WU2-REPORT — 광고 상태 전환 스모크 (adsense-recheck-20260919)

| 항목 | 값 |
|---|---|
| 작업 ID | adsense-recheck-20260919 / WU2 |
| 지시서 | docs/jobs/todo/adsense-recheck-20260919/PLAN.md v0.3.1 (§4) |
| 요청 모드 | plan-and-implement, 구현 허가 있음 |
| 최종 SHA | `c40c2eb` (브랜치 `work/adsense-adtest-20260919`, 기준 `29fe72c`) |
| push | 금지 준수 — 원격 반영 없음 |
| 빌드 | `env -u VITE_LOCAL_QA npm run build` (VITE_LOCAL_QA 미설정), 종료 0, 101 localized pages |
| 서버 | `tests/recovery-server.mjs` 재사용, `RECOVERY_TEST_PORT=4182`, root `dist` |
| 브라우저 | playwright 1.63 + `/usr/bin/google-chrome` |
| 스텁 URL | `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8940087269746960` (정확 일치만 stub, 그 외 외부 HTTP(S) 전부 abort) |
| 세션 | `ses_f45cd39d4ffeMjz2CpUX4DjHJJ` / 모델 `opencode/muse-spark-1.3-contributor-free` |
| 서명 | Muse |

## 변경 파일 (커밋 3건)

- `a48121a` — `src/components/AdSenseLoader.tsx`: 구독 시점에 eligibility 재조정 1문장 추가(§4-3 범위). 아래 「발견 결함」 참조.
- `81b3fa1` — `tests/ad-eligibility-smoke.mjs`(신규), `tests/helpers/ad-stub.mjs`(신규), `package.json`에 `"test:ads"` 추가(끝 개행 없음 상태 유지).
- `c40c2eb` + 중간 1건 — 결과 키 통일(`docCommits`), S10 계수 추가 등 테스트 코드 정리. 제품 코드 추가 변경 없음.

금지 준수: guides.json·검증기·seo.ts·문서 본문·광고 정책 미수정, AppShell 비광고 줄·라우팅 미수정, 저장소 루트 새 파일 없음(산출물은 git 제외 `tests/visual-artifacts/adsense-recheck/`에만).

## 발견 결함 1건 (수정됨, §4-3 범위)

- 증상: S2(동의 granted + 허용 경로)에서 `script[data-worklazy-adsense]` 0개. S1·S4·S8(기대 0)은 통과하므로 격리·차단 문제가 아니라 삽입 자체가 안 됨.
- 원인: `ToolRouteLoading`이 `routePending`을 layout effect에서 설정 → 같은 커밋의 `wl-ad-eligibility-changed` dispatch가 `AdSenseLoader`의 passive 구독 연결 전에 발생 → 이벤트 유실. 컴포넌트 state는 `false`인 채 모듈 플래그는 `true`라서 삽입 effect가 조기 복귀하고, 이후 `routePending` 해제 이벤트는 `setIneligible(false)` no-op이라 재렌더 없이 교착. 사전 동의 사용자·lazy 경로에서 광고가 절대 삽입되지 않음(사후 동의 변경 시에만 삽입됨).
- 수정: `AdSenseLoader.tsx` 구독 effect 안에서 `handleEligibility()` 1회 재조정. 동일값이면 bail-out이라 루프 없음. `adEligibility.ts`·`AppShell` 변경 없음.
- 검증: 수정 후 rebuild → S2-ko/en, S3, S6 전제(script 1), S7, S9, S5-1a 전제 모두 통과. 스킬 B(vercel-react-best-practices) 참조.

## 시나리오별 결과 (27/27 pass, 실제 외부 허용 전부 0)

범례: 시도=정확한 AdSense URL 요청 수, 스텁=스텁 응답 수, 차단=abort된 외부 요청 수(분석 포함), 실제=continue된 외부 요청 수(항상 0), 문서=CDP loaderId 기준 새 문서 수(초기 진입 포함).

| # | URL/언어 | 상태 | script | 시도·스텁·차단·실제 | 문서 | 증거 |
|---|---|---|---|---|---|---|
| S1-unset | /ko/tools/text-merger | script 0, stub 0 | 0 | 0·0·0·0 | 1 | S1-unset.png |
| S1-denied | /ko/tools/text-merger | script 0, stub 0 | 0 | 0·0·0·0 | 1 | S1-denied.png |
| S2-ko | /ko/tools/text-merger | script 1, stub 1 | 1 | 1·1·2·0 | 1 | S2-ko.png |
| S2-en | /en/tools/text-merger | script 1, stub 1 | 1 | 1·1·2·0 | 1 | S2-en.png |
| S3 | /ko/tools/text-merger (chunk 2000ms 지연) | 로딩 중 script 0 확인 후 script 1 (로딩 관측 368ms, 완료 2303ms) | 1 | 1·1·2·0 | 1 | S3-ready.png |
| S4 | /ko/tools/text-merger (chunk 404 지속) | [data-route-error], reload 1회, chunk 404 2회 | 0 | 0·0·4·0 | 2 | S4-error.png |
| S6-ko-merge | — | **적용 대상 아님**: merge행 SPA 링크가 앱에 없음(사이드바·/ko/tools/ 목록·pdf 내부 내비 전수 0건). S8 직접 진입으로 대체 검증 | — | — | — | (수치, 스크린샷 없음) |
| S6-ko-hwp | /ko/text-merger → /ko/tools/hwp-editor | 문서 교체 정확히 1회(301 별도 기록), 5초 안정화 추가 0, SPA push 0/replace 1 | 0 | 1·1·4·0 | 2→3(S7 공유 세션) | S6-ko-hwp.png |
| S6-ko-doccompare | → /ko/tools/document-compare | 상동 | 0 | 1·1·4·0 | 2 | S6-ko-doccompare.png |
| S6-en-doccompare | /en/text-merger → /en/tools/document-compare | 상동 | 0 | 1·1·4·0 | 2 | S6-en-doccompare.png |
| S7 | hwp → 뒤로가기 → text-merger | script 1 재삽입(정책대로), 태그 ≤1, 신규 문서 1 | 1 | 누적 2·2·6·0 | +1 | S7-back.png |
| S8 | pdf-editor, pdf-editor/ocr, hwp(KO), document-compare, **results/1(만료 안내 `[data-testid=document-expired-result]` 1건 확인)**, pdf-compare, office-app(office meta+COI+SW controller), xls-preserve(excel meta+COI+SW), video-studio/video-studio/trim(video meta+COI+SW), document-redactor(redactor meta), EN merge·doccompare | 전부 script 0·시도 0·스텁 0. office·excel·redactor는 AnalyticsLoader disabled라 분석 요청 자체 0(차단 0, 정상). 빈 화면 아님(부팅·본문·meta·만료표식 중 1개 이상 확인) | 0 | 0·0·0~2·0 | 1~2(격리 COI 준비 reload 1 포함) | S8-*.png 13건 |
| S9 | text-merger 파일 1개(.txt 합성) → document-compare 이동 | 항목 2→0(이동 후 다른 도구 페이지라 당연 유실), **대화상자 0·경고 0·취소 흐름 없음**. 판정은 Claude (설계상 예상 vs 결함 후보) | 0 | 1·1·4·0 | 2 | S9-after-move.png |
| S5 | /ko/tools/qr-studio/bulk (아래 상세) | 동일 URL 경계 도달, script 0, 신규 스텁 0 | 0 | 0·0·4·0 | 2 | S5-error.png |
| S10 | 모바일(Pixel 7 뷰포트) text-merger | **미확인**: 스텁에 실제 overlay가 없어 겹침 검증 불가. 버튼 목록·스크린샷만 기록 | 1 | 1·1·2·0 | 1 | S10-mobile.png |
| 자체 판별력 | S2-ko를 스텁 없이(차단 유지) 재실행 | 기대대로 "스텁 1" 실패 → 검사기 판별력 입증 | — | — | — | ad-smoke-discrimination.json |

### S5 상세 (재현 불가가 아님 — 도달 가능한 형태로 검증, 편차 명시)

- PLAN 순서대로 (1) 사용자 동작 트리거 지연 import(QrBulkPanel chunk) fault부터 시도. 실측: bulk 탭 클릭 → chunk 404 → `vite:preloadError` → chunkRecovery가 **설계대로** 문서를 reload(세션 키 확인, reload 1회) → in-memory 모드 상태가 소실되어 create로 복귀, 경계 미도달. 즉 동일 문서 내 "script 1 유지 → 오류 전환"은 recovery reload가 가로막아 도달 불가(1a 기록: reload 1·URL 동일·경계 없음·스텁 누적 2=재삽입 정상).
- (1b) 트리거가 URL에 보존되는 `/ko/tools/qr-studio/bulk` 직접 진입 + 동일 fault: 초기 로드 실패 → reload 1회 → 두 번째 실패에서 키 존재 → reload 없음 → **동일 URL에서 `[data-route-error]`**, script 0, 스텁 누적 0(삽입 시점에 도달한 적 없음 — "(총 1 유지)" 전제와 다름을 명시), bulk 404 2회, 이후 reload 없음(루프 없음).
- (2) transform 방식도 시도했으나 Vite `__vitePreload`가 평가 실패까지 `vite:preloadError`로 바꿔 reload하므로 경계에 도달하지 못함. fault(실제 404) 방식을 채택, 테스트 전용 응답 변조는 최종 코드에 없음.
- 잔류 태그: recovery reload가 문서를 교체하므로 관찰 가능한 잔류 없음. 동일 문서 잔류 위험은 reload 설계상 발생할 수 없는 경로임을 기록(§4-3에 따라 수정 대상 아님).

## 실행 명령·종료 코드·로그 경로

- `npm ci` — 종료 0 (node_modules 부재 확인 후 실행).
- `env -u VITE_LOCAL_QA npm run build` — 종료 0 (수정 전·후 각 1회).
- `RECOVERY_TEST_PORT=4182 npm run test:ads` — 종료 0, 27/27 (최종). 중간 실패 실행 3회(수정 전 S2 계열 실패, S6 계수 방식·S5 접근법 수정 과정)는 위 결함·설계 확인의 근거로만 사용하고 최종 판정에 미사용.
- `RECOVERY_TEST_PORT=4182 node tests/ad-eligibility-smoke.mjs --discriminate` — 종료 0, `DISCRIMINATION OK`.
- 결과: `tests/visual-artifacts/adsense-recheck/ad-smoke-results.json`(+ `ad-smoke-discrimination.json`, `S*.png` 26건, `wu2-sample.txt`). 모두 git 제외 경로이며 저장소에는 테스트 코드만 추가됨.
- 콘솔 로그는 별도 파일로 보관하지 않음(위 명령 출력이 증거. 필요 시 동일 명령 재실행).

## 미완료·이월·제한

- S6-ko-merge: 적용 대상 아님(SPA 링크 부재). 제품 링크 추가는 범위 밖(광고 정책·내비 변경 금지)이라 수정하지 않음.
- S10: 미확인(실제 광고 필요). 사용자 계정 확인 항목으로 이월.
- S5 동일 문서 잔류 태그: 관찰 불가 경로(위 상세). S5-1b 경계 도달로 대체 검증, 최종 판정은 Claude.
- S9 상태 유실: 관찰 기록만, 판정은 Claude.
- 실패·권한 오류: 이번 턴 없음. (앞 턴의 /tmp 쓰기 거부는 작업 지시 조정으로 artifact dir 사용, 본 턴에서 발생 없음.)

## 통합 인계

- 고정 커밋: `c40c2eb` (그 앞 `a48121a` 제품 수정, `81b3fa1`·`7bfcf7c` 테스트). push 금지 준수.
- WU1 worktree·브랜치에 손대지 않음. 공통 CHANGELOG·review-notes·backlog는 직접 편집하지 않고 본 보고서로 전달.
- 유효 결과 재사용 근거: 최종 `c40c2eb`+동일 dist에서 `npm run test:ads` 27/27·discrimination 통과를 직접 실행으로 확인. 빌드는 VITE_LOCAL_QA 미설정으로 2회(수정 전·후) 수행, 최종 dist가 검사 대상과 일치.
