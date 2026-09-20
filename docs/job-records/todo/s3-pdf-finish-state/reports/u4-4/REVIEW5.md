# U4-4 fix-4 범위 한정 재검수 5차 — c328885

검수자: Codex / gpt-6-astra. 2026-09-08 KST. Worklazy Tools 자체 제품의 품질 검증.

**최종 판정: [수정 후 재검수]. 잔여는 이번 수정에서 추가한 새로고침 버튼의 light 대비 1건(P2)이다.** R-A 기능 복구, R-B 계측 완전성, 기존 R-C 오류 두 요소, Claude가 변경한 R-D 대체 요구는 독립 재현으로 해소했다. 그러나 새 버튼은 ko/en light에서 **4.2746:1 < 4.5:1**이다. 기존 공용 부채로 면제할 수 없는 신규 회귀다. 다크는 실제 배경 픽셀로 6.57:1 이상임을 확인했다.

## 실행 경계와 기준

- 원본 `/home/better0101/projects/worklazytools`, `s3-pdf-finish`, HEAD **`c3288856b10953e663a0910a9ca125c7bfe667eb`**. 시작값 일치. `git archive c328885`를 이 디렉터리의 `repo/`로 풀어 검증했다.
- 선독: PROJECT_RULES.md → AGENTS.md → 4차 REPORT → fix-4 지시서 → sol REPORT/산출물. PDF finish 정본, 관련 review-notes 및 열린 계획 19개를 대조했다. [실행 게이트](evidence/open-plan-gate.json), [시작 상태·SHA](evidence/start.json).
- 검수 산출물은 모두 `/tmp/worklazy-u4-4-review5/`. 추적 파일 수정·커밋·push·브랜치 전환을 하지 않았다. 접근 금지로 지정된 다른 작업 디렉터리에 접근하지 않았다.
- 빌드와 브라우저는 직렬, `NODE_OPTIONS=--max-old-space-size=4096`. Vite는 **4280/4281/4282/4283, `--strictPort`**. legacy HTTP fixture의 임의 포트 요청은 [외부 shim](probes/strict-legacy-port.cjs)으로 4289에 고정했다. 모든 검수 서버 종료 후 4280~4289 리스너가 없다.
- Node 22.17.1, Chrome 152.0.7977.64, Poppler 24.02.0, Playwright 1.63.0/axe-core 4.13.0. [도구 버전](evidence/toolchain.json).
- 의존성·벤더는 앞선 PDF 검수의 캐시를 **복사**한 뒤 현행 prebuild 검증을 실행했다. 새 `npm ci` 결과라고 주장하지 않는다. baseline의 node_modules는 이번 사본 안의 복사본을 참조한다. 원본 node_modules에 쓰지 않았다.
- 아래 `node probes/…`, `python3 probes/…`는 본 디렉터리 기준, npm 명령은 `repo/` 기준이다. [실행기](probes/run.py), [브라우저 실행기](probes/browser-run.py), 각 단계 command JSON에 환경과 출력을 보존했다.

## 항목별 판정

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| **신규 P2: 새로고침 버튼 대비** | **수정 필요, fix-4 신규 회귀** | `node probes/reload-contrast.mjs` + `python3 probes/contrast-calculate.py`: ko/en light **4.2746:1**, Axe serious 각 1노드. `node probes/reload-gate.mjs`: 원래 집계기도 두 언어 모두 거부 | `pdfUi.tsx:75`의 새 버튼에 대비를 만족하는 명시적 전경색을 부여하고, 표시 자산 첫 로드 실패의 ko/en×light/dark를 접근성 검사에 등록. 상세 문안 아래 |
| R-A 첫 표시 요청 실패·복구 | 기능 해소 | `node probes/runtime.mjs`: ko/en×watermark/organize/pdf-to-image/convert **8/8**, 자동 재시도·자동 reload 0, 재선택 안내·버튼·선택 폐기 확인. watermark 양 언어 preview/save 성공 | 기능 계약 유지. 새 버튼 대비만 수리 |
| R-A 정상 표시 URL·fallback·취소 | 통과 | `test:pdf-finish` 단일 표시 URL; `test:pdf-watermark-performance` Worker 생성 불가 preview/download 성공, route error 0. 독립 128MiB 취소 6회 통과 | worker나 fallback을 제거하지 말 것 |
| R-B 동일 생성 절차·파일 집합 | 해소 | scoped/full `bundle:measure` exit 0, 독립 census에서 production/measurement **142 실행 경로 SHA 차이 0** | 현행 생성 완료 후 측정 순서 유지 |
| R-B 독립 네트워크 음성 대조 | 통과 | `runtime.mjs`: 정상 실행 21경로 모두 포함. `/vendor/review5-excluded-negative.mjs`를 실제 import·실행하면 원래 inventory 검증이 누락으로 거부 | raw network에 배포 제외 규칙을 재사용하지 말 것 |
| R-B 양방향 inventory·SHA 중복 비용 | 통과 | `meter.mjs`: 측정 후 `.mjs` 추가 및 기존 파일 삭제 각각 거부. 동일 SHA 별칭 비용 0; 내용 변경 시 **+113,807B**, shared/app 예산 거부 | 양방향 guard와 SHA/모든 경로 목록 보존 |
| R-C invalid textarea/empty-text notice | 해소 | 공식 a11y 및 독립 계산: 네 상태 두 요소 모두 **6.9595:1 이상** | 기존 F2 marker·상한 유지 |
| R-C 접근성 귀속·공용 영향 | 기존 F2 귀속 유지 | marker 15→15, 위반 0/F2 incomplete 0/inherited 253. target·owner·reason 누락 및 F2 incomplete 강제 음성은 원래 집계기 거부 | 공용 부채는 UI 재설계 백로그. 신규 버튼은 이에 섞지 않음 |
| R-D 16/32/64MiB | 통과 | 3회 중 최대 **149.350/172.445/165.725ms**, 각각 ≤200ms | 200ms 기준 유지 |
| R-D 128MiB 대체 요구 | **Claude 변경 기준 충족** | 실제 저장 진행 프레임 3회, 취소 **최대 46.571ms**, 늦은 결과 0, 같은 탭 128MiB 재시도 6/6 | 예전 200ms 목표의 **목표 미달** 기록을 지우지 않음 |
| 과거 회귀 네 가지·A3 | 통과 | legacy diff 0, 골든 160/160, 6.2.109 주입 build Vite 전 exit 1, 12입력×3 측정; A3 ko/en 14사례 기대와 일치 | 기존 차단·허용·의존 패치 계약 유지 |
| 좁은 회귀·watermark 시각 | 통과 | tsc, unit 320/320, production/QA build, PDF finish, scoped/full bundle, 지정 a11y 5페이지, visual **8/8** | 아래 전체 회귀는 병합 직전 1회로 이월 |

## 신규 P2 — 표시 실패 복구 버튼의 대비 미달

정상 PDF를 처음 선택할 때 `assets/pdf-*.mjs` 요청만 중단하면 실제 제품 화면에서 재현된다. 버튼은 정상 상태의 작은 글자(14px)이며, light에서 **전경 `#e7000b` / 배경 `#f2f2f7` = 4.2745895:1**이다. ko/en에서 동일하다. Axe의 `color-contrast` serious 위반과 독립 색/픽셀 계산이 일치한다.

[원시 Axe·색·픽셀](evidence/reload-contrast.json), [독립 대비 계산](evidence/contrast-calculated.json), [한국어 버튼](shots/reload-contrast/ko-light.png), [영어 버튼](shots/reload-contrast/en-light.png), [원래 집계기의 실제 거부](evidence/reload-gate.json).

**신규 귀속 근거:** `git show e30018d:src/features/pdf-editor/pdfUi.tsx`에는 `pdf-display-reload`가 0개이고 c328885에는 1개다. 해당 `Button`은 이번 수정으로 추가됐고, `outline` variant에 전경색이 없어 오류 컨테이너의 `text-destructive`를 상속한다. 공용 버튼 원본과 색 토큰은 변경되지 않았지만, 미달인 색 조합으로 **새 복구 조작을 만든 것은 이번 수정**이다. [발생 시점 증거](evidence/new-defect-origin.json), [원래 diff](evidence/scope.diff).

현재 공식 a11y의 5페이지는 정상 watermark 및 empty-text 오류 네 상태라 표시 모듈 로드 실패를 포함하지 않는다. 따라서 그 검사 통과와 이 신규 위반은 양립한다. 수집된 실제 위반을 신규 상태로 등록해 현행 `assertAccessibilityResults`에 전달하면 **`Accessibility limits exceeded`**로 거부한다. 원래 상한을 바꿔야 해결되는 문제가 아니다.

dark의 새 버튼은 배경 gradient 때문에 Axe가 incomplete로 남겼다. 이를 pass로 세지 않고, 같은 버튼의 글자색만 투명하게 해 실제 배경 픽셀을 채취했다(배경·레이아웃 불변, 내부 영역에서 테두리 제외). ko **6.5720~6.6599:1**, en **6.6017~6.6599:1**로 수치 확인했다. 공용 오류 제목/설명에 남아 있는 기존 gradient 관련 incomplete와 새 버튼의 light 확정 위반을 구분한다.

**sol 수정 지시 문안:**

> `src/features/pdf-editor/pdfUi.tsx:75`의 `data-testid="pdf-display-reload"` 버튼이 오류 컨테이너의 `text-destructive`를 그대로 상속하지 않게, 버튼 범위에 정상·hover·focus에서 4.5:1 이상인 명시적 전경색을 둔다. 공용 팔레트를 광역 변경할 필요는 없다. 최초 표시 자산 요청 중단으로 도달하는 ko/en × light/dark 4상태를 기본 접근성 검사에 추가하고 이 새 버튼의 대비를 직접 검증한다. gradient로 incomplete이면 실제 배경 측정으로 해소하며 기존 shared 부채로 면제하지 않는다. 기존 F2 marker·한도·분류를 유리하게 바꾸지 않는다. 기존 새로고침 안내, 자동 재시도 0, 재선택 후 preview/save, 단일 표시 URL 계약을 보존한다.

좁은 재검수는 이 버튼 4상태의 대비·원래 집계기 거부/통과, ko/en 첫 로드 실패 복구, 영향 있는 시각·단위 검증 및 번들 5종을 확인하면 된다. 앞선 통과 표면의 전량 재실행을 이번 잔여 수정만을 이유로 되돌릴 필요는 없다.

## R-A 복구 정책·정상 표면

[독립 브라우저 결과](evidence/runtime-independent.json), [기본 smoke 런타임](evidence/runtime-assets.json), [실행 로그](logs/runtime.log).

실패 안내를 기다린 뒤 1.2초 동안 추가 표시 모듈 요청과 문서 reload가 없었다. 안내는 연결 확인→새로고침→PDF 재선택이며 손상 파일로 안내하지 않는다. 8상태 모두 사용자 오류 문구에 raw exception, `/assets/`, runtime/Worker/내부 오류 클래스 이름이 없다. 버튼으로 reload 후 input.files와 선택 목록이 비워지고, 같은 정상 PDF로 복구한다. watermark는 다운로드 bytes의 `%PDF-` 헤더까지 확인했고, 기존 세 모드는 실제 썸네일 이미지 로드를 확인했다.

복구 정책의 근거도 재현했다. 실패 뒤 동일 URL `fetch`는 **200/853,555B**지만 같은 문서의 동일 URL `import`는 여전히 거부된다. 명시적 문서 새로고침은 이 브라우저 모듈 캐시를 비우며, 파일을 다시 고르라는 안내도 실제 행동과 맞는다. query를 늘려 재시도하는 대안은 URL/realm 수명 관리 복잡도를 더하므로 이번 안정 URL 계약에서 이 선택을 변경할 근거는 없다.

main과 thumbnail worker가 `pdf-CCjkBPdx.mjs` 한 배포 자산을 공유하며 PDF.js 내부 worker도 남아 있다. 여러 realm의 동일 URL 요청은 별도 배포 파일 중복으로 세지 않았다. Worker 생성 불가 fallback은 기본 성능 검사에서 기능 보존을 확인했으며 대형 fallback까지 200ms를 보장했다고 확대하지 않는다.

## R-B 계측 완전성과 예산

기준선 소스는 `git archive 5bc6854175331bdd73b267784d9633cdccda8446`. 양쪽 모두 **현행 Vite config/계측 build → 현행 정적 생성기 → 같은 output tree 측정**이다. 소스 root만 다르고 override는 없다. 현행 생성기가 현행 SEO 정의를 읽는 것도 양쪽 동일하다. baseline에 필요한 당시 vendor/runtime 입력을 준비했다.

[baseline 실제 명령](evidence/baseline-build-commands.jsonl), [current 실제 명령](evidence/current-build-commands.jsonl), [기준선](evidence/bundle-baseline.json), [scoped](evidence/bundle-scoped.json), [full](evidence/bundle-full.json).

측정기가 종료 때 지우는 output tree와 module metadata를 [외부 preload](probes/preserve-measurement.cjs)로 **삭제 직전에 복사만** 했다. 계측·생성 코드나 출력 bytes는 바꾸지 않았다. 독립 census는 `.js/.mjs` 전부를 먼저 기록하고 계약상 제외 여부를 별도 기재했다. 정상 production과 측정 tree의 **제외 대상까지 포함한 전체 실행 자산 142개가 경로·SHA·bytes·gzip까지 동일**했다. [전수 목록·음성 대조](evidence/meter-independent.json).

| 대상 | 전체 JS/MJS 경로 | 계약상 포함 경로 | 고유 SHA | 중복 경로 | 양방향 missing | SHA당 gzip 합계 |
|---|---:|---:|---:|---:|---:|---:|
| baseline | 133 | 99/99 | 83 | 16 | 0/0 | 5,843,715B |
| current | 142 | 105/105 | 89 | 16 | 0/0 | 5,912,244B |

공통 생성 service worker의 locale 별칭도 inventory에 남는다. 독립 gzip 합계는 meter의 app 합계와 일치했다. sol 산출물과 내용 SHA·경로·bytes·gzip·귀속·metrics가 같다. baseline manifestSources의 두 node_modules 상대 경로는 캐시의 물리 위치 차이이며 파일 내용 차이가 아니다.

네트워크에는 배포 제외 predicate를 적용하지 않았다. 정상 실제 요청 21경로는 모두 포함된다. `/vendor/review5-excluded-negative.mjs`를 Playwright 응답으로 공급해 실제 `import`하고 전역 실행 표식까지 확인하자, 원래 `assertLazyChunks` 함수가 **`loaded execution asset is missing from bundle inventory`**로 거부했다. 제품/배포 파일을 고쳐 만든 정상 결과가 아니며, 실제 네트워크와 실행을 갖춘 음성 대조다.

별도 출력 fixture에서 측정 후 `late-generated/after-measurement.mjs` 추가는 missingFromMeasurement, `assets/pdf-CCjkBPdx.mjs` 제거는 missingFromDeployment로 거부됐다. 동일 내용 별칭은 경로만 1개 증가·app delta 0이고, 그 내용을 바꾸자 **113,807B** 증가가 실제 shared/app 상한을 넘겨 거부됐다. SHA 1회 부과가 실증분을 숨기지 않는다.

| gzip 지표 | 증분 B | 상한 B | 잔여 B |
|---|---:|---:|---:|
| entry JS | 7,288 | 20,480 | 13,192 |
| PDF route JS | 58,423 | 61,440 | 3,017 |
| shared JS (귀속 이동 제외) | 2,095 | 30,720 | 28,625 |
| app JS | 68,529 | 81,920 | 13,391 |
| CSS | 300 | 10,240 | 9,940 |

override `{}`, multiplier **1**, 상한 불변. full 비교도 통과하며 affected 전체 합계 증분은 **−450,647B**다. PDF 단독 증분 58,423B를 따로 확인했으므로 다른 route 감소로 PDF 증가를 감추지 않았다.

## R-C 오류 대비·접근성 귀속

| 언어 | 테마 | invalid textarea | empty-text notice |
|---|---|---:|---:|
| ko | light | 7.6428:1 | 6.9595:1 |
| ko | dark | 8.9891:1 | 8.3795:1 |
| en | light | 7.6428:1 | 6.9595:1 |
| en | dark | 8.9891:1 | 8.3795:1 |

[공식 a11y](evidence/a11y.json), [독립 DOM·색·귀속 원시값](evidence/contrast-independent-raw.json), [독립 계산](evidence/contrast-calculated.json), [음성 집계](evidence/a11y-negatives.json), [marker 소스 대조](evidence/marker-source.json).

계산은 렌더된 색을 sRGB로 읽고, 실제로 보이는 배경층만 alpha 합성한 뒤 상대휘도로 수행했다. 불투명 Card 뒤의 body gradient는 표시 결과에 기여하지 않는다. 네 상태 모두 최소 **6.9595:1**, 이전 4차 light 4.36/3.98, dark notice 4.20 미달을 해소했다.

F2 marker는 소스에서 **15→15**이고 제거되지 않았다. 수정은 watermarkActive 범위의 textarea/notice class에 한정되며 공용 스타일 파일과 공용 Button 구현은 그대로다. 공식 5페이지는 violations 0, F2 incomplete 0, inherited incomplete **253**, 외부 요청 0이다. 독립 표본의 nav-caption/사이드바 링크 등은 실제 F2 영역 밖이고 원시 target/reason이 남아 있다. owner·target·reason 삭제와 F2 incomplete 강제는 원래 집계기가 거부한다.

**기존 결함 백로그 귀속:** 253개는 접근성 통과 노드가 아니다. 공용 AppShell/팔레트의 기존 부채이며 `docs/backlog.md`의 「U4-4(F2) 접근성 감사에서 분리된 기존 결함」 및 UI theme redesign 계획 소관이다. 이번 단계를 막지 않는다. 신규 새로고침 버튼의 light 위반은 이 253개에 포함된 옛 상태가 아니므로 별도 P2로 남긴다.

## R-D 응답성·Claude의 128MiB 대체 기준

`npm run test:pdf-watermark-performance`, 12개 고정 입력×각 3회 새 browser context, viewport 1280×900/DPR1, CPU·네트워크 throttle 없음. curve 입력은 preview에 이어 생성 요청·saving·다운로드 준비까지 수집한다. 아래 MiB는 fixture manifest의 **decoded 데이터 크기**이며, 128MiB fixture 자체는 Flate 압축 PDF 131,009B다. [원시 36회](evidence/performance.json), [최댓값 판정](evidence/performance-verdict.json), [실행 로그](logs/performance.log).

| fixture | 총시간 중앙값 ms | 전체 heartbeat 최대의 3회 값 ms | 판정 |
|---|---:|---|---|
| raw-1KiB-w1024 | 574.908 | 40.455 / 37.320 / 49.740 | ≤200ms 충족 |
| raw-10KiB-w1024 | 532.091 | 44.780 / 49.390 / 44.110 | ≤200ms 충족 |
| raw-64KiB-w1024 | 542.405 | 46.245 / 57.125 / 31.920 | ≤200ms 충족 |
| raw-200KiB-w1024 | 552.184 | 49.705 / 37.785 / 44.805 | ≤200ms 충족 |
| raw-1MiB-w1024 | 558.095 | 53.890 / 37.750 / 42.670 | ≤200ms 충족 |
| flate-1MiB-w8192 | 561.713 | 53.250 / 42.095 / 42.020 | ≤200ms 충족 |
| flate-4MiB-w8192 | 629.069 | 40.160 / 49.700 / 41.855 | ≤200ms 충족 |
| flate-8MiB-w8192 | 725.210 | 56.810 / 48.175 / 41.525 | ≤200ms 충족 |
| curve-16MiB-w8192 | 1722.331 | 149.350 / 135.605 / 147.800 | ≤200ms 충족 |
| curve-32MiB-w8192 | 2098.604 | 146.905 / 51.950 / 172.445 | ≤200ms 충족 |
| curve-64MiB-w8192 | 3266.528 | 165.725 / 164.355 / 86.990 | ≤200ms 충족 |
| curve-128MiB-w8192 | 5804.670 | 179.050 / 160.265 / 171.650 | 상한 적용 제외, 대체 요구 판정 |

16/32/64MiB는 중앙값으로 초과를 숨기지 않고 **모든 실행의 최댓값**을 대조했다. 총시간 중앙값 128/16 비는 **3.3702**, 준선형 곡선을 유지한다.

**128MiB 옛 ≤200ms 목표는 목표 미달 이력을 유지한다.** sol 원시 값 **347.185 / 161.810 / 154.410ms**와 4차 검수 초과 표본을 지우지 않는다. 이번 세 번이 179.050/160.265/171.650ms로 200ms 이하였다는 관찰은 미래 전체 실행 보장을 뜻하지 않는다. 표준 측정 JSON의 `target.met=true`는 이번 표본에 대한 값이다. Claude는 saving 구간의 분할 불가능한 직렬화와 저장기 재설계 비용을 근거로 128MiB 상한을 제외했다. 이번에는 그 결정을 적용했으며, serializer 내부 병목 원인을 새 profiler 실험으로 다시 확정했다고 주장하지 않는다.

128MiB 대체 네 요구는 별도로 재현했다.

1. **실제 진행 표시:** `node probes/progress128.mjs` 3회, saving 문구가 보이는 RAF 27/28/27회. Chromium compositor 프레임에서도 **Saving the finished PDF…**와 **Cancel operation**을 확인했다. [프레임 타임라인](evidence/progress128.json), [실제 표시 프레임](shots/progress/run-0-frame-032.png). 이 별도 screencast 실행을 위 heartbeat 수치에 혼합하지 않았다.
2. **취소 ≤250ms:** `node probes/cancel128.mjs`는 외부 CDP mousePressed 직전부터 UI 취소 반영까지 측정했다. 선택자 탐색·스크롤·좌표 준비는 시간에서 분리했다. 검사 중 3회와 실제 saving 안내 중 3회 모두 **최대 46.571ms**다.
3. **늦은 결과 0:** 취소 UI 반영 뒤 6.5초 관측에서 download 노드/늦은 등록 0. 기존 완료 결과를 재사용하지 않았다.
4. **같은 탭 재시도:** 6회 모두 같은 탭에서 같은 128MiB 파일로 재시도해 131,943B PDF 결과와 `%PDF-` 헤더를 확인했다.

| 취소 구간 | 회차 | 외부 입력→UI ms | 늦은 결과 | 같은 탭 재시도 |
|---|---:|---:|---:|---|
| inspection | 1 | 28.562 | 0 | 성공 (131,943B PDF) |
| inspection | 2 | 14.683 | 0 | 성공 (131,943B PDF) |
| inspection | 3 | 18.904 | 0 | 성공 (131,943B PDF) |
| creation-saving | 1 | 46.571 | 0 | 성공 (131,943B PDF) |
| creation-saving | 2 | 24.777 | 0 | 성공 (131,943B PDF) |
| creation-saving | 3 | 41.519 | 0 | 성공 (131,943B PDF) |

[취소·재시도 원시값](evidence/cancel128.json). 표준 64MiB 검사 중 취소도 **91.609ms**, stale canvas/result false, retry true였다. 대형 Worker 불가 fallback의 200ms 한계는 이전부터 있던 호환 경로 성능 부채로 유지하며 이번 회귀라고 재분류하지 않는다.

**정본 후속 반영 문안(Claude 소관):** “128MiB decoded 입력은 ≤200ms 보장 대상에서 제외한다. 16/32/64MiB는 ≤200ms를 유지한다. 128MiB는 실제 진행 표시·취소 ≤250ms·늦은 결과 0·같은 탭 재시도 성공 및 준선형 총시간으로 판정한다. 이전 347.185ms 목표 미달과 직렬화 한계를 기록하고, 저장기 재설계는 별도 성능 백로그로 둔다.” 추적 문서 편집 금지에 따라 여기 기록하며 정본 파일을 직접 수정하지 않았다.

## 과거 회귀와 좁은 검증 출력

- `fixtures:pdf-legacy-oracle`: client 3/structure 4/render 32/output 4/input 1, **totalDiffs 0**. [로그](logs/legacy.log).
- `test:pdf-finish`: 직접 진입 16, preview 배치 48, 복구·출력·취소·단일 런타임 검사 및 PDF.js/Poppler **image 128 + text 32 = 160골든 통과**. [로그](logs/pdf-finish.log).
- 의존 패치: manifest의 네 파일 SHA 일치. 격리 복사본에서 `pdfjs-dist` 6.2.109를 넣고 실제 `npm run build` → **exit 1**, `expected pdfjs-dist@6.2.108, received 6.2.109`, **Vite 전 중단**. [원시 실패](logs/dependency-negative.log), [해시·판정](evidence/dependency.json). 앞선 4빌드 전 렌더 매트릭스는 재실행하지 않았다.
- A3: `node probes/a3.mjs` ko/en 14 UI 사례. 정상 inline-EI 파일 위험 경고 0·성공, 공백/줄바꿈 및 회전 이탈 차단, 1픽셀 교차 허용, 위험 동의 유지, 확실한 zero clip 결과 거부를 확인했다. [결과](evidence/browser-contracts.json). 불확실 line clip의 기존 한계는 과잉 차단으로 바꾸지 않았다.
- watermark 시각은 필터 `VISUAL_ONLY=pdf-finish-watermark`, **8/8**, concurrency 1, 기준선 갱신 없음. [로그](logs/visual.log). 오류 상태와 복구 상태는 별도 실제 스크린샷도 검토했다.

| 실행 명령 | exit | 소요 | 출력 |
|---|---:|---:|---|
| `tsc`: `npx tsc -b` | 0 | 18.68s | [로그](logs/tsc.log) |
| `unit`: `npm run test:unit` | 0 | 5.61s | [로그](logs/unit.log) |
| `build`: `npm run build` | 0 | 111.71s | [로그](logs/build.log) |
| `pdf-finish`: `npm run test:pdf-finish` | 0 | 183.31s | [로그](logs/pdf-finish.log) |
| `legacy`: `npm run fixtures:pdf-legacy-oracle` | 0 | 5.08s | [로그](logs/legacy.log) |
| `performance`: `npm run test:pdf-watermark-performance` | 0 | 103.79s | [로그](logs/performance.log) |
| `bundle-baseline`: `npm run bundle:measure` | 0 | 79.39s | [로그](logs/bundle-baseline.log) |
| `bundle-scoped`: `npm run bundle:measure` | 0 | 77.27s | [로그](logs/bundle-scoped.log) |
| `bundle-full`: `npm run bundle:measure` | 0 | 76.63s | [로그](logs/bundle-full.log) |
| `build-qa`: `npm run build` | 0 | 94.80s | [로그](logs/build-qa.log) |
| `a11y`: `npm run test:a11y` | 0 | 28.79s | [로그](logs/a11y.log) |
| `visual`: `npm run test:visual` | 0 | 30.70s | [로그](logs/visual.log) |

환경 세부: [initial](evidence/initial-env.json), [bundle](evidence/bundle-env.json), [QA](evidence/qa-env.json). 독립 브라우저 명령: [A3·초기 이력](evidence/independent-commands.json), [취소](evidence/independent-recheck-commands.json), [복구·실제 진행 프레임](evidence/runtime-progress-commands.json), [대비·귀속](evidence/contrast-review-commands.json), [새 버튼 픽셀 대조](evidence/reload-pixel-review-commands.json).

**프로브 실패 이력도 보존했다.** 첫 runtime 프로브는 trailing slash 정규화 navigation을 자동 reload로 오인한 단언, 두 번째는 기존 thumbnail이 img인데 canvas를 기다린 선택자 오류로 실패했다. 최초 취소 프로브는 decoded 128MiB를 PDF 결과 파일 크기로 오인해 실패했다. [runtime 1차](logs/runtime-first.log), [runtime 2차](logs/runtime-second.log), [취소 최초](logs/cancel128-first.log), [원시 최초 측정](evidence/cancel128-first.json). 이 가정들을 고친 뒤 같은 제품 사본에서 재실행했다. 독립 색 계산 첫 시도는 불투명 Card 뒤의 body gradient도 거부해 중단했고, 보이는 배경층까지만 합성하도록 수정했다. 새 버튼 dark처럼 gradient가 실제로 보이는 경우는 픽셀 측정으로 분리했다. merge-tree의 첫 UTF-8 디코드도 binary 출력 때문에 실패해 재실행의 원시 bytes를 보존했다. 이들은 제품 회귀로 세지 않는다. **새 버튼의 4.2746:1 실패는 프로브 수정 후에도 독립적으로 재현된 제품 회귀**다.

## 다음 게이트·이월 목록·main 동기화

**U4-5(F3 도장·서명) 착수 조건:** 신규 P2 버튼 대비 수정 → 범위 한정 astra 재검수 통과 → Claude 잔여 0 게이트 및 128MiB 후속 정본 반영 → U4-5 정본 지시서를 sol에 전달. 이번 보고는 F3 착수 승인이 아니다. 현재 PDF route 잔여 3,017B와 app 잔여 13,391B에서 후속 비용을 차감해 판단한다.

**이번에 실행하지 않은, 병합 직전 1회 이월 목록:** `npm run test:browser` 전체, `npm run test:new-tools`, `npm run test:utilities`, `npm run test:office`, `npm run test:qr-bulk`, `npm run test:qr-font-render`, `npm run test:recovery`, `npm run test:static`, 전체 `npm run test:a11y`, `npm run css:orphans`, `npm run legacy:manifest`, `node tests/tool-registry-routes.mjs`. 전체 시각/CLS 및 정본의 영향 범위 추가 회귀도 병합 직전 통합 게이트에서 취합한다. 이번에 앞선 전 스코프 검사를 재실행하지 않았다.

main **`597a92ff56ed9c3eb23755a58df2580b0269b8bd`**와 read-only 3-way 비교했다. 공통 수정 파일은 `CHANGELOG.md`, `docs/review-notes.md`, `package.json`이다. 문서 두 개는 textual conflict, package.json은 이 비교에서 자동 합성된다. 현재 기준으로 제품 src 교집합은 없다. 실제 동기화 때 최신 main과 package scripts/prebuild hook의 의미 충돌을 다시 확인해야 한다. 실제 병합·index 갱신은 하지 않았다. [교집합](evidence/main-overlap.json), [충돌 분류](evidence/main-merge-conflicts.json), [원시 merge-tree](evidence/main-merge-tree.raw).

## 저장소 불변과 보고서 보존

시작·종료 HEAD/브랜치/status 동일. **원본 추적 파일 2,621개 SHA 변화 0**, c328885 검증 사본 2,621개 변화 0, 고정 baseline 사본 2,373개 변화 0. [종료 상태](evidence/end.json), [불변 판정](evidence/invariance.json), 재현 `python3 probes/invariance.py`. 사용자 기존 미추적 파일 상태도 그대로다.

이 REPORT.md와 원시 로그·JSON·PDF·화면을 지정 경로에 저장했다. 존재·크기·SHA 및 보고서 링크 검사는 [저장 확인](evidence/report-verification.json)에 기록한다. 저장소 수정·커밋·push·브랜치 전환은 없다.

**최종 판정: [수정 후 재검수] — 새로고침 버튼 light 대비 1건.**
