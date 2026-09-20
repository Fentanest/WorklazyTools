**[수정 후 재검수] — P2 결함 1건.** 열 너비 NaN 수정 자체와 실제 사용자 보고서 재생성은 통과했다. 다만 새 `reportIntegrity`가 **서식만 있는 빈 행을 데이터 행으로 인정**하여, 지시서의 “데이터 행 수 > 0인 시트가 최소 하나” 계약을 충족하지 못한다. 생산 검사와 신규 테스트 보조 함수가 같은 오판을 한다. 이 검수에서는 저장소를 수정하지 않았다. — Codx, 2026-09-07

**대상·실행 게이트·불변 증명**

- 대상 `/tmp/worklazy-xr`, 브랜치 `excel-report-width-20260907`, HEAD `ac9cc4a2638aeb497a69668079be050786e6edf7`. 부모는 기준 `5bc6854175331bdd73b267784d9633cdccda8446`, 차이는 정확히 1커밋이다.
- `PROJECT_RULES.md` 전문 → `AGENTS.md` → 검수/sol 디스패치 → sol 원출력 → X-A 정본·관련 review-notes를 읽었다. 열린 계획서 검색에서 중복키·머리글 후속 초안이 이 수정의 병합 뒤 착수하도록 분리되어 있음을 확인했다. 상반된 실행 지시 없음. [검색 원출력](logs/open-plan-gate.log).
- `git archive ac9cc4a…`를 `source/`에 해제했다. archive SHA-256은 `bceabea1c038a453961c75211c4251b3ce0afb5198ac62318ddeec61377bf5e2`. 기존 sol 의존성과 vendor를 `/tmp` 사본에 복사했고 설치하지 않았다. 테스트의 Git 파일 목록 조회를 위해 `/tmp/worklazy-xr-review/git-metadata`에 로컬 커밋 객체와 인덱스를 별도로 마련했다. 원 저장소 인덱스를 사용하거나 변경하지 않았다.
- [시작 상태](start-state.json) / [종료 상태](end-state.json) / [대조 결과](state-comparison.json): 시작·종료 `git status --porcelain=v1` 모두 빈 문자열, HEAD·브랜치 동일, **추적 파일 2,374개 SHA 변경 0, 사용자 XLSX 6개 SHA 변경 0, sol 오프라인 계획서 SHA 변경 0**. 빌드한 archive 사본의 추적 파일도 대상 커밋과 바이트 차이 0이다.
- 원 워킹트리·`/tmp/worklazy-dc-impl`·`/tmp/worklazy-xc-r1`에 수정·실행 산출물을 만들지 않았다. 커밋·push·브랜치 전환 없음. 검수 preview는 종료했다.

**항목별 판정**

아래 명령은 별도 표시가 없으면 `cd /tmp/worklazy-xr-review/source` 후 `source ../env.sh`를 적용한다. 프로브·원출력·생성 XLSX·CSV는 이 보고서와 같은 `/tmp/worklazy-xr-review/` 아래에 있다.

| 항목 | 판정 | 직접 실행한 재현 명령·출력 | 수정 지시 문안·심각도 |
|---|---|---|---|
| 1. 근본 원인 | [통과] | `node --experimental-strip-types ../probes/core.mts`: 기준 커밋의 `xlsxReport.ts`를 `git show`로 추출해 그대로 호출. index 0 hole → map에서도 hole → spread 첫 값 `undefined` → `Math.max=NaN`; 실제 4열 모두 NaN, 직렬화된 `<col>` 4개 모두 width 없음. 기존 사용자 다운로드도 9시트·95열 전부 width 누락. [core](logs/core-probes.log), [기존 다운로드 XML](logs/original-user-report.json) | 없음. Excel 애플리케이션의 폭 0 렌더링은 이번 환경에서 직접 실행하지 않았다. 이번 검수의 독립 증거는 JS 연산·XLSX XML과 LibreOffice 재개방이다. |
| 2. 너비 수정·경계·대량 | [통과] | 같은 core 프로브: 빈 시트는 열 정의 없음, 헤더만/모두 빈 문자열은 12, 긴 문자열은 48, 경계는 `[12,13,47,48,48]`, NaN/±Infinity/숫자/boolean/객체/행 hole에도 유한 폭. 50,000행과 150,000행 모두 생성·검사 성공, RangeError 없음. [원출력](logs/core-probes.log) | 없음. 기존 spread는 50,000 인자에서 NaN, 150,000 인자에서 `RangeError: Maximum call stack size exceeded`임도 별도 확인. [출력](logs/spread-limit.log) |
| 3a. custom-width 음성 대조·오류 귀결 | [통과] | width 제거·NaN·±Infinity·0·음수·빈 문자열/공백, 헤더만·시트 없음·0B·PK만 있는 버퍼와 두 번째 시트의 width 누락을 모두 `REPORT_INTEGRITY_FAILED`로 거부. 유효 보고서·데이터 시트+헤더 전용 시트·`customWidth='true'`는 통과. [core](logs/core-probes.log) | 없음. |
| 3b. 데이터 행 존재 검사 | **[결함]** | `node --experimental-strip-types --test ../probes/empty-data-negative.mts` → **exit 1, 0 pass / 2 fail, `Missing expected rejection.`**. 행 높이만 있는 2행과 서식만 있는 A2 모두 재개방 실데이터 0행인데 생산 검사와 보조 함수가 통과. LibreOffice CSV도 각각 `Header` 한 줄/7B뿐이다. [실패 원출력](logs/empty-data-negative.log), [CSV 실측](logs/empty-data-csv.json) | **P2 / R1:** 행 시작 태그의 `r>1`만으로 데이터 존재를 인정하지 말 것. 아래 구체 지시 참조. |
| 3c. 사용자 오류 문구·비용 | [통과] | `node ../probes/worker-safe-error.mjs`: production worker 응답의 너비 대입 1곳만 NaN으로 바꿔 실제 생성 실패 유발. ko/en 모두 worker 메시지는 `{type:"error",code:"REPORT_INTEGRITY_FAILED"}` 하나, 화면에는 각 언어 재시도 안내, 다운로드 링크 0, 내부 원인 노출 0. [출력](logs/worker-safe-error-retry.log). 실제 9시트·50,000레코드×13열 보고서에서 검사 327/240/199ms. [성능](logs/performance.log) | 이 표본에서는 검사 비용 수용 가능. 전체 생성 6,037ms/2,525,551B, 검사 약 3.3~5.4% 수준. max RSS 1,292,360KiB는 생성 포함 전체 프로세스 수치이며 검사 단독 증가량이나 저사양 브라우저 보장을 뜻하지 않는다. |
| 4. 소비처 3종·구성 | [통과] | 실제 브라우저 스모크 다운로드를 보존하고, 테스트 보조 함수와 별개인 Python `zipfile`+`ElementTree` 검사로 **17개 다운로드 XLSX의 모든 `<col>` width**를 확인. 비교 9시트/95열, 정리 대표 5시트/33열, QR 2시트/10열 모두 유한·양수. 시트 순서·열 이름 단언 통과. [수집 결과](logs/consumer-collection.log), [상세 XML](logs/consumer-xml.json) | 없음. `report.ts`, `output.ts`, `QrBulkPanel.tsx`는 기준 커밋과 SHA 동일. `REPORT_TOPOLOGY_INVALID` 방어 및 9시트 순서도 그대로다. |
| 5. 사용자 파일 실측 | [통과] | `node --experimental-strip-types ../probes/user-files.mts`: 지정 2파일, `최종`/머리글 1행/키 B열/duplicatePolicy=error. **713 matched / 37 changed / 48 added / 4 duplicate**, 나머지 0. 새 XLSX 54,122B, 9시트, `<col>` 68태그/논리 95열, 데이터 856행, width 12~48, 누락·비유한·0폭 0개. [실측](logs/user-files.log), [독립 XML](logs/user-xml.log) | 없음. LibreOffice 변환 exit 0, 첫 시트 CSV 99B/9행, 요약 수치 모두 일치. [변환](logs/libreoffice.log), [CSV 대조](logs/libreoffice-summary.json). CSV는 내용 재개방 증거이며 Excel GUI 시각 검사를 대신한다고 주장하지 않는다. |
| 6. 회귀·변경 범위 | [통과] | 아래 필수 회귀표 전부 최종 exit 0. diff 11파일, +186/−13. 생산 변경은 공용 폭 계산·새 검사·worker의 `await` 추가뿐. 비교 엔진·UI·중복키·3소비처·의존성 manifest/lock 변경 0. [diff](logs/diff-full.log), [동일 SHA 표면](logs/unchanged-surfaces.json) | 없음. |
| 7. 기록 | [통과] | `CHANGELOG.md`의 간결한 Codx 서명과 `docs/review-notes.md`의 원인·3소비처·실측 수치·기존 X-A 검사의 한계는 이번 실측과 일치. sol worktree의 gitignored `docs/jobs/todo/excel-compare-followup-20260903.md`는 존재하고 X-A 원인 확정으로 갱신됨. | R1 수정 뒤 검사 범위·음성 대조 수치를 기록에 추가할 것. sol의 “데이터 행 검사” 기술은 현재 빈 서식행을 배제하지 못하므로 함께 정정해야 한다. |
| 8. sol 범위 밖 발견 인계 | [미검증] | 지시된 `/tmp/worklazy-xr-out/REPORT.md`가 존재하지 않는다. 해당 디렉터리의 개별 로그는 있으나 별도 “범위 밖 발견” 목록은 확인할 수 없다. | **인계 보완 / 비차단:** sol 보고서를 복원하고 범위 밖 발견 유무를 명시할 것. 이를 근거로 새 제품 계약을 임의로 추가하지 않았다. 이번 R1은 이미 지시된 데이터 존재 계약 안의 결함이다. |

**R1 — 수정 지시 (P2, 재검수 필요)**

대상은 [reportIntegrity.ts:26](source/src/features/excel-compare/reportIntegrity.ts:26), [xlsx-report-assertions.mjs:30](source/tests/xlsx-report-assertions.mjs:30), 관련 unit 및 기록이다. 현재 두 검사는 `<row r="2" .../>`와 `<row r="2"><c r="A2" s="1"/></row>`를 모두 데이터 행으로 센다. ExcelJS 재개방에서는 두 경우 모두 `actualRowCount=1`이고, 헤더 이후 `row.hasValues`인 행은 0개다. 일반적인 서식만 있는 유효 XLSX이므로 손상된 XML을 억지로 만든 대조가 아니다.

1. **행 번호와 셀 데이터의 존재를 함께 확인한다.** 2행 이후에 값 또는 수식이 있는 셀이 최소 하나인 시트가 있어야 통과시킨다. 행 높이·스타일·값 없는 `<c>`만 남은 경우에는 거부한다. 명시적인 `0`, `false`, 빈 문자열, 유효 수식 셀은 서식뿐인 셀과 구별해 기존 데이터 표현을 유지한다. 모든 시트가 데이터 없는 경우는 기존 `REPORT_INTEGRITY_FAILED`로 귀결한다.
2. 테스트 보조 함수도 동일한 오판을 제거한다. 위 두 음성 대조를 커밋 unit에 넣고, 실패해야 하는 XLSX의 데이터 행 수는 생산 검사와 독립된 재개방/셀 검사로 먼저 0임을 확인한다. 유효 데이터 시트 하나+헤더 전용 시트, 정상 요약 count 0, 정상 보고서와 현재 width 음성 대조는 계속 통과/거부되어야 한다.
3. `../probes/empty-data-negative.mts`의 2건이 수정 후 pass여야 한다. 현재 프로브의 `committedHelper` 호출은 기존 보조 함수의 거짓 통과를 함께 증명하기 위한 것이므로, 보조 함수도 거부하도록 바뀌면 해당 부분은 거부 단언으로 조정해 사용할 것.
4. `docs/review-notes.md`와 `CHANGELOG.md`에 수정·독립 음성 대조를 기록하고, 50,000행과 실제 50,000레코드×13열 성능 및 필수 회귀를 다시 실행한다. 비교 엔진·UI·중복키 계약은 수정 범위가 아니다.

현재 사용자 보고서에는 실제 데이터가 있고, 열 폭과 내용은 위 실측대로 정상이다. 재검수 사유는 이번 수정에 명시적으로 추가한 빈 데이터 방어가 불완전하기 때문이다.

**필수 회귀 원출력**

공통 환경은 [env.sh](env.sh)의 `NODE_OPTIONS=--max-old-space-size=4096`, 사본 전용 TMPDIR/npm cache/compile cache, offline npm이다. production preview는 `npm run preview -- --host 127.0.0.1 --port 4370 --strictPort`로 실행했다. QR의 기존 임의 포트 proxy만 [외부 하니스](probes/browser-harness.mjs)로 4371에 고정했으며, 점유 시 실패하도록 그대로 두었다. 하니스는 다운로드 XLSX를 보존할 뿐 테스트 단언·제품 소스를 변경하지 않는다. 브라우저는 최종 채택 실행에서 빌드와 직렬이다.

| 명령 | 최종 결과 | 원출력 |
|---|---|---|
| `npx tsc -b` | exit 0 | [tsc](logs/tsc.log) |
| `npm run test:unit` | exit 0, 250/250 | [unit 재실행](logs/unit-retry.log) |
| `npm run build` | exit 0, 2,834 modules, 정적 61페이지 | [build](logs/build.log) |
| `npm run test:static` | exit 0, startup recovery 104문서 포함 | [static](logs/static.log) |
| `npm run test:excel-compare` | exit 0 | [최종 직렬 실행](logs/excel-compare-serial.log) |
| `npm run test:excel-cleaner` | exit 0 | [최종 직렬 실행](logs/excel-cleaner-serial.log) |
| `npm run test:qr-bulk` | exit 0, 7 payload/2시트 manifest/폰트·취소 회귀 | [QR](logs/qr-bulk.log) |
| `npm run test:browser` | exit 0, TEST_SCOPE 미설정 전체 Excel·Word·PDF | [전체 browser](logs/browser.log) |
| `npm run bundle:measure` | exit 0, 80 JS/1 CSS | [bundle 최종](logs/bundle-final.log) |
| `npm run css:orphans` | exit 0, zero-reference selector arms 0 | [CSS](logs/css-orphans.log) |
| `node tests/tool-registry-routes.mjs` | exit 0, 20개/missing·unexpected·duplicates 0 | [registry](logs/registry.log) |
| `git -C /tmp/worklazy-xr diff --check 5bc6854..ac9cc4a` 및 worktree diff | 둘 다 exit 0 | [커밋 diff](logs/diff-check-final.log), [worktree diff](logs/worktree-diff-check.log) |

별도 mutant 회귀는 `node --experimental-strip-types ../probes/mutant-golden.mts`를 실행해 **기대대로 exit 1**이었다. 수정 전 파일을 직접 불러 신규 골든이 `<col min="1" max="1" customWidth="1"/>`의 width 누락으로 실패함을 다시 확인했다. sol 로그를 복사해 판정하지 않았다. [실패 원출력](logs/mutant-golden.log).

실험 중 실패·재실행도 보존했다. 최초 unit 249/250은 archive에 `.git`이 없는 환경 문제였고 별도 metadata로 보완한 후 250/250이다. 최초 추가 worker 주입 검사는 대체 응답에 preview의 COEP 헤더를 누락해 파일 검사 대기에서 timeout이 났다. 헤더를 동일하게 보존한 하니스 재실행은 ko/en 모두 통과했다. 또한 최초 `bundle:measure`가 내부적으로 빌드를 수행함을 확인한 직후 중단했다(exit 130). 해당 시점에 겹친 Excel 비교·정리 스모크는 번들 빌드 종료 후 각각 직렬 재실행한 결과로 최종 판정했다. 원출력: [unit 최초](logs/unit.log), [worker 주입 최초](logs/worker-safe-error.log), [중단 bundle](logs/bundle.log), [명령별 실행 기록](checks.jsonl).

신규 UI·문구·라우트·SEO·광고 경로 변경은 없다. ko/en 기존 안전 오류를 실제로 확인했고, 정적·registry·전체 unit의 광고 허용목록 검사도 통과했다. 새 의존성이나 서버 전제 코드는 없다.

수정본 사용자 보고서: [user-file-report.xlsx](artifacts/user-file-report.xlsx), SHA-256 `a5b855897020cc65dd6e1e187a52efcfe2a835d3af046f9c766a015d9acc30fc`. [첫 시트 CSV](libreoffice-csv/user-file-report.csv). sol 산출물과 ZIP 내부 엔트리를 직접 대조했으며 차이는 `docProps/core.xml` 메타데이터 하나뿐이다. 모든 worksheet·sharedStrings는 바이트까지 일치한다. [대조 결과](logs/sol-report-crosscheck.json).

**[수정 후 재검수]**
