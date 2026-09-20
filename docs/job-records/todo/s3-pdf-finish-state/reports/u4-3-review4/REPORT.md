**[검수 통과] — U4-3 fix-3 재검수(4차), Codx, 2026-09-07**

R1 잔여인 숫자 표기 변경 8건과 같은 설정의 탭 전환 2건이 해소됐다. sol의 전용 스모크를 무수정 실행한 10/10과 독립 경로의 10/10에서 재검사·만들기 활성·실제 PDF 생성을 확인했다. Office 원명령은 별도 1회와 연속 10회 모두 통과했다. F1~F9 되돌림이나 새 제품 결함은 발견하지 않았다. 공통 검증 35개 실행은 전부 exit 0이며, 시각 회귀는 두 LANG 각각 203/203, 기준선 파일 변경 0이다.

| 기준 | 확인값 |
|---|---|
| 대상 | `/home/better0101/projects/worklazytools`, `s3-pdf-finish` |
| HEAD | `31529570059efe2478fb0326baf7740bc4861783` |
| 수리 전 비교 | `37470534a28b1bf1752a6d659820240fc3bc1b2a` |
| main | `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be`, 대상 브랜치에 미병합 |
| 환경 | Node 22.17.1 · Chrome 152.0.7977.64 · Poppler 24.02.0 |
| 검증 위치 | 해당 SHA의 git archive 사본 `repo/`; 수리 전 사본 `before/`; QR 비교 main 사본 `main/` |
| 실행 제약 | `NODE_OPTIONS=--max-old-space-size=4096`, build·browser·visual 직렬, visual concurrency 1; Vite 4270/4272 `--strictPort`, recovery 4271 정확 bind |
| 불변 | 09:55:24~10:51:30 UTC, 원본 추적 2,588파일 SHA 동일, HEAD·branch·main·status 동일, 앞선 감사 산출물 316개 SHA 동일 |

첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 AGENTS, 지정 dispatch, 3·2차 보고와 fix-3 지시서, sol 보고·31개 원로그, PDF 정본의 관련 계약·F9 확정 문안·기각 이력을 대조했다. 열린 계획 19개를 스캔했고 이번 검수와 상반된 지시는 없었다. 사용자 미추적 DOCX 2개·네이버 HTML·`newui/`는 열거나 수정하지 않았다. 금지된 세 작업 트리에 접근하지 않았고, Excel 브랜치 비교는 대상 저장소의 git 객체만 읽었다. 추적 파일 수정·커밋·push·브랜치 전환·실제 merge를 하지 않았다.

**항목별 판정**

아래 명령의 cwd·환경·exit·시간·원출력은 [commands.jsonl](commands.jsonl)과 [전체 실행표](command-table.md)에 있다. 원본 조사 스크립트의 종료 코드만으로 판정하지 않고 저장된 관측값을 대조했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R1 잔여 10건 | **통과** | `npm run test:pdf-finish`의 `testPreflightRawInputAndTabChanges` 무수정: 숫자 8·탭 2·생성 10 통과. `node probes/independent-browser.mjs`: 별도의 모바일 경로 10/10에서 `ready→idle→checking→ready`, 버튼 활성, 각 1,179B/2쪽 PDF 재개방. Poppler로 모든 파일에서 `1/2`, `2/2` 추출. | 없음. |
| 검사 호출·타이핑 | **통과, 증가 범위 명시** | `node probes/preflight-measure.mjs`를 수리 전/후 QA 빌드에 각각 실행: 각 48개 표본. 아래 호출 수 표 참조. 원시 표기 변경의 재검사는 늘지만, 반복 루프나 입력 수를 넘는 증폭은 없음. | 없음. 모든 타이핑을 항상 1회 검사한다고 확대하지 않는다. |
| 겹친 재검사·stale 결과 | **통과** | 후속 계측 ko/en 6건: 실제 파일 읽기 지연 650/15ms에서 이전 요청 AbortError·마지막 요청만 ready. 먼저 끝난 검사 결과의 전달을 보류한 성공/오류 두 경계도 abort된 결과가 화면을 덮어쓰지 않음. | 없음. |
| 정상 idle·기존 가드 | **통과** | 파일 없음 각 0호출·idle·설정/버튼 미표시. 무효 시작 쪽 8건은 0호출·idle·차단, 정상값 복귀 8건은 1호출·ready. 같은 탭/위치 재클릭 4건은 0호출·ready 유지. 실제 값 변경·취소/재시도는 무수정 전용 스모크도 통과. | 없음. |
| Office 제품 불변·스모크 정당성 | **통과** | `3747053..3152957` Office 제품 blob 동일. `npm run test:office` 별도 1회 + 연속 10/10 실패 0. 조건 관측 보충 3/3도 저장값 보존. 고정 시간 경과가 아닌 실제 A1/A2 선택·편집값으로 대기 종료. | 제품/스모크 수정 없음. 지시서의 과거 실패 설명 정정은 아래 별도 메모. |
| 기록 정정 4건 | **통과** | `fix3.diff`, `locale-changes.json`, 실제 ko/en 제한 안내 캡처. R1 원인·수리·재검증, 고정 S3 번들 기준, 기준선 파일 변경 0 표현, 입력 시도에 대한 300자 문구 모두 반영. | 없음. |
| F1 시작 쪽 오류 | **통과** | 원본 보충 browser: ko/en × 빈 값·0·−1·1.5 = 8/8, routeError 0·필드 오류·파일/폼 보존·1 복귀 후 활성. | 없음. |
| F2 보호/손상 업로드 | **통과** | R2/R6 보호 4종 + 손상 1종 × 기존 파일 유/무 × ko/en = 20/20. 오류 안내 구별, routeError 0, 정상 재업로드 성공. | 없음. |
| F3 미리보기 | **통과** | portrait/landscape × 6영역 × ko/en × light/dark = 48/48 canvas 내부. 종횡비·wrapper·가운데 오차 최대 0. 대표 캡처 직접 확인. | 없음. |
| F4 경계 밖 CropBox | **통과** | 원본 engine 24/24 위치·upright. 보충 네 회전 각각 PDF.js 빨간 픽셀 40·Poppler 50, MARK 추출·수평 bbox/upright 유지. | 없음. UserUnit의 전 렌더러 전체 픽셀 동일성으로 확대하지 않음. |
| F5 사전 오류·안내 | **통과** | 이모지·제어문자·날짜 오류의 행/열, 말줄임·줄 생략·약 3.8MB·미정의 토큰 경고, 좁은 영역/여백 구별 재현. 변조 글꼴은 ko/en 각 1요청·현지화 오류·실행 차단·다운로드 0. | 없음. |
| F6 취소 부분 결과 | **통과** | 원본 partialOutputs 1·secondReads 0. 보충 reads `[1,0,0]`/`[1,1,0]`, 두 경우 모두 완료 PDF 919B/1쪽 재개방, 세 번째 파일 read 0. | 없음. `partialResults` 공개 계약 유지. |
| F7 QR 출력 | **통과** | 원본 `qr-compare.mjs` 내용 무수정. subset 661,064B·full 3,911,538B, cdb4007과 byte/SHA/Info/Producer/Creator/날짜 및 Poppler 2쪽 SHA 동일. | 없음. |
| F8 821px·navigation | **통과** | 영어 821px client 523/scroll 764, 링크 5개 client=scroll=148. ko/en×6폭×active/start/end 36상태 실패 0. active 직접 진입·overflow·fade 일치. | 없음. |
| F9 확정 4항 | **통과** | 두 preset×ko/en 기본 템플릿/위치·10pt/24pt/#34343a 확인, 실제 PDF opacity 0.9. 출력명 함수·unit 및 끝 공백 browser 4건 유지. 범위 오류 8건과 실제 300/300·새 안내 양 언어 확인. | 없음. |
| 범위·보호 표면 | **통과** | 정확히 7파일 +168/−6. Office·vendor·시각 기준선 보호 blob 294개 변경 0. archive의 추적 2,588파일도 원본 기준 SHA와 동일. | 없음. |
| 공통 게이트 | **통과** | tsc, unit301, production/QA build, static, 모든 지정 스모크·oracle·visual·a11y·CLS·bundle·CSS·legacy·registry·diff-check 실제 실행. 아래 표와 전체 원로그 참조. | 없음. |

**R1 독립 재현과 호출 수**

[독립 경로 원관측](independent-browser.json), [실제 PDF 10개](independent/), [Poppler 텍스트](independent-pdf-text.json), [전용 스모크 원출력](logs/pdf-finish.log). 독립 경로는 각 숫자 표기마다 새 페이지에서 기본 번호 설정으로 시작했다. 탭 반례는 머리말 탭의 템플릿을 `{page} / {pages}`, 위치를 아래 가운데로 맞추고 페이지 번호 탭으로 돌아왔다. 모든 생성은 새 결과에서 bytes를 읽고 PDF 파싱 및 페이지별 텍스트까지 확인했다.

호출 계측은 생성된 `PdfFinishPanel` JS 응답에서 실제 preflight 함수만 감싼다. [계측 함수](probes/instrumentation.mjs)는 입력·신호·결과를 원함수에 그대로 전달하며 호출/abort/완료 시각을 기록한다. 저장소와 archive의 제품 소스·빌드 파일은 고치지 않았다. 수리 전/후 모두 같은 최종 [계측 경로](probes/preflight-measure.mjs)를 사용했다. 전체 입력 시각과 원관측은 [before](preflight-before.json), [after](preflight-after.json), [비교](preflight-comparison.json)에 있다.

| 입력 | ko 수리 전→후 | en 수리 전→후 | 해석 |
|---|---:|---:|---|
| 각 `10→10.0`/`24→24.0`/`1→01` 4종 | 각각 0→1 | 각각 0→1 | 이전 idle 고착을 1회 재검사로 해소 |
| 동일 설정 탭 전환 | 0→1 | 0→1 | 위와 동일 |
| 이미 선택된 탭/위치 | 각각 0→0 | 각각 0→0 | ready 유지 |
| 텍스트 10자, 자동화 지정 간격 25ms | 1→1 | 1→1 | 빠른 입력 묶음의 재검사 1회 |
| 숫자 5자리, 지정 간격 25ms | 1→2 | 1→1 | 실제 키 간격은 지정 간격과 달라질 수 있음. 아래 관측 참고 |
| 텍스트 4자, 지정 간격 190ms | 3→3 | 4→4 | 브라우저 처리 시점에 따라 합쳐지는 입력 존재 |
| 숫자 4자리, 지정 간격 190ms | 4→4 | 4→4 | 수리 전후 동일 |
| 매 검사 완료를 기다린 텍스트/숫자 4자 | 각각 4→4 | 각각 4→4 | 입력당 한 번, 중복 호출 없음 |
| `10` 뒤 `.0000`, 지정 간격 25ms | 0→1 | 0→1 | raw 표기 변화도 마지막 상태 검사 |
| `10` 뒤 `.0000`, 지정 간격 190ms | 0→4 | 0→4 | 네 raw 변화에 각각 재검사. 기존 0은 성능 최적화가 아니라 idle 고착 |
| 파일 없음·무효 시작 쪽 | 0→0 | 0→0 | 정상 idle 유지 |
| 무효→유효 복귀 | 각각 1→1 | 각각 1→1 | ready·활성 복귀 |

한국어 빠른 숫자 입력의 수리 후 원시 시각은 `123` 입력 17125.63ms → 중간 검사 시작 17265.48ms → `1234` 입력 17268.48ms다. **실제 입력 간격 142.85ms**에 120ms 예약이 실행됐고, 다음 입력에서 중간 요청이 abort됐다. 최종 `12345` 검사만 정상 완료했다. 따라서 호출 증가 1건을 숨기거나 “빠른 입력은 무조건 1회”라고 쓰지 않는다. 기존 120ms debounce·cleanup은 그대로이며, 이 표본에서 입력 수를 넘는 중복/루프성 재검사는 없었다. 느린 숫자 표기 입력의 추가 검사는 이번 수리 방식에 따른 명시적인 비용이다.

[취소 경합 6건](preflight-comparison.json): ko/en 각각 (1) 이전 파일 읽기를 650ms, 다음 읽기를 15ms 지연해 새 검사 완료 뒤 옛 검사가 AbortError로 종료됨을 확인했다. (2) 실제 이모지 검사 오류 결과의 전달을 보류한 뒤 정상 텍스트로 변경하고 옛 결과를 풀어도 ready·오류 없음 유지. (3) 유효 결과의 전달을 보류한 뒤 글자 크기를 5로 바꾸고 풀어도 필드 오류·idle·비활성 유지. (2)(3)은 늦은 promise 정착을 강제한 스트레스 표본이며 원함수의 오류/성공 판정을 바꾸지는 않는다.

[소스 대조](preflight-source-audit.json): 파일/선택/필드 유효성의 early return, 동일 값 재클릭 가드, 120ms timeout, cleanup의 clearTimeout/abort, resolve/reject 양쪽의 `!signal.aborted`, `preflight.status !== "ready"` 실행 차단 모두 유지됐다. idle 은닉이나 버튼 강제 활성화는 없다.

**Office 보강과 과거 실패 설명**

[제품/보호 파일 blob](protected-blobs.json), [정확한 변경 diff](fix3.diff), 원명령 [별도 실행](logs/office.log) 및 [연속 01](logs/office-repeat-01.log)~[10](logs/office-repeat-10.log). sol의 기존 20/20 원로그도 직접 읽었고 보관사본 SHA와 일치했다. 이번 직접 재실행은 **연속 10/10 + 별도 1회 = 11/11**, 실패 0이다. 이는 이번 표본의 결과이며 미래의 모든 환경에서 플래키가 없다는 보증으로 확대하지 않는다.

`waitForCalcState`는 최대 200회, 재시도 사이 25ms를 두되 매번 실제 worker `documentModel`의 controller 선택 범위와 첫 시트 A1/A2 값을 조회한다. 조건이 맞으면 즉시 반환한다. worker 호출 시간까지 포함한 절대 5초 timeout이라는 뜻은 아니다. Ctrl+Home 뒤 A1·원래 한글, ArrowDown 뒤 A2·원래 값, Enter 뒤 A1 보존·A2 편집 반영을 기다린다. 기존 저장 파일을 ExcelJS로 재개방하는 한글/편집 문자열 단언은 삭제·완화되지 않았다.

동일 테스트에 관측 기록만 붙인 [보충 스크립트](probes/office-timing.mjs)도 QA에서 3/3 통과했다. [추가 내용 diff](office-timing.diff), [관측 요약](office-timing-summary.json).

| 보충 실행 | Ctrl+Home 첫 관측→A1 | ArrowDown 첫 관측→A2 | Enter 후 편집값 |
|---|---:|---:|---|
| 1 | G14→A1, 337ms | A1→A2, 119ms | 첫 관측에서 A1 한글 보존·A2 편집 반영 |
| 2 | G14→A1, 330ms | A1→A2, 125ms | 동일 |
| 3 | G14→A1, 161ms | A1→A2, 115ms | 동일 |

**지시서의 과거 실패 설명은 정정이 필요하다.** 3차 REPORT·Office 관측 JSON·원로그를 검색했으나 `2424/2449/2465ms`의 노드 detach 근거는 없었다([검색 대상과 결과](office-prior-timing-audit.json)). 3차에 실제 보존된 실패는 QA 16번째 실행의 저장값 `["Arrow navigation verified", "이동 전"]`, 즉 A2 이동 전에 A1을 편집한 사례다. 현재 원명령 11회와 관측 3회에서 저장값 불일치·노드 detach 오류는 없었다. 근거 없는 특정 과거 타이밍의 소실까지 증명했다고 쓰지는 않는다.

문서 정정 문안: “3차의 Calc 저장값 불일치와 키 입력 반환 후 선택 셀 반영 지연을 재현 기준으로 삼는다. 2424/2449/2465ms node detach가 별도 사건이면 해당 원로그를 별도로 연결한다.” 제품 수정 잔여나 U4-3 차단 사유로 판정하지 않는다.

**기록·현지화·SEO·광고 영향**

- `docs/review-notes.md` fix-3 절은 새 숫자 표기 8·탭 전환 2의 원인, effect 예약 조건 수리, 10/10 재검증을 fix-2의 재클릭 표본과 구분했다.
- fix-2 번들 수치의 기준을 고정 S3 `/tmp/s3-bundle-baseline.json`으로 정정했다. 기준선의 실측 SHA-256은 **`2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`**다.
- “변경 픽셀 0”을 **기준선 파일 변경 0**으로 정정했다. 실제 시각 조건은 threshold 0.1, 상이 픽셀 비율 ≤0.1%, AA 무시 및 기존 footer 허용 영역 유지다. 성공 로그가 정확한 diffPixels 0을 보증하지는 않는다.
- locale 변경은 양 언어 모두 `pdf.finish.fieldErrors.templateLength` 한 키뿐이다([leaf 대조](locale-changes.json)). 실제 299자 뒤 `BC` 입력 시 값은 300자, counter는 300/300이고 C가 반영되지 않았다. 새 한국어 안내는 “입력한 내용이 300자 한도를 넘어 일부만 반영되었습니다”, 영어 안내는 “Some of the attempted input was not applied because it exceeded the 300-character limit.”이다. [ko 실제 화면](independent/ko-limit.png), [en 실제 화면](independent/en-limit.png)을 직접 열어 문구·줄바꿈·카운터를 확인했다.

변경 문구에는 내부 구현 명칭이나 원시 예외가 없다. 사용자 입력 결과를 설명하는 한 쌍의 현지화 문구이며 새 SEO 정책이나 route 설명을 요구하지 않는다. route·SEO·정적 페이지 입력·광고 격리·의존성·서버 전제 제품 코드는 변경되지 않았다. production static의 67페이지/113문서 검증, repo-wide 실행 파일 광고 최소 허용목록 unit, 일반/격리 경로 스모크가 통과했다. QA a11y·CLS·독립 브라우저에서 외부 요청은 0이다. [실행 파일 후보 스캔](repo-wide-candidates.json), [기록 대조](records-audit.json), [육안 확인 목록](visual-review.json).

**완료 기준 재실행**

아래는 실제 실행 결과다. 세부 명령·환경·시간과 원출력 링크를 모두 보존한 [49회 전 실행표](command-table.md)를 함께 본다. 표의 공통 검증 성공과 아래 계측 하네스의 초기 실패를 혼동하지 않는다.

| 명령 | 실제 결과 |
|---|---|
| `npx tsc -b` | exit 0, 진단 0 |
| `npm run test:unit` | 301/301, fail 0, skip 0 |
| `npm run build` · `npm run test:static` | 2,845 modules, 정적 67페이지, startup recovery 113문서 |
| `npm run test:pdf-finish` | 기존 회귀 + raw 숫자 8·동일 설정 탭 2·해당 새 PDF 10 통과 |
| `TEST_SCOPE=pdf npm run test:browser` · 전체 `test:browser` | 통과 |
| `test:new-tools` · `test:utilities` | 통과; 기존 Dolby Vision host capability skip 및 결정적 fallback 결과는 원로그에 보존 |
| `test:office` | 원명령 11/11, 관측 보충 3/3 |
| `test:qr-bulk` · `test:qr-font-render` | subset/full/corrupt/404·취소·재실행 통과; 3 fixture Poppler changedPixels 0·PDF.js 추출 동일 |
| `test:recovery` | 147 cases 통과 |
| `fixtures:pdf-legacy-oracle` | client 3·structure 4·render 32·output 4·input 1, 총 diff 0 |
| `test:excel-cleaner` · `test:excel-compare` | 통과 |
| `LANG=ko_KR.UTF-8 npm run test:visual` | 203/203, 하네스 7m17.38s |
| `LANG=en_US.UTF-8 npm run test:visual` | 203/203, 하네스 7m19.11s |
| 시각 기준선 | 203파일 SHA 변경 0; 두 실행 합 14m36.49s <20분, shell 합 878.446s도 <20분 |
| `VITE_LOCAL_QA=1 npm run build` | 통과 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 11페이지, 위반 0·외부 요청 0 |
| `npm run test:rendering` | 6대상×3회, 외부 요청 0. 기존 3대상 CLS 0, finish 세 경로 최대 각각 0.0001480365514755249 <0.1 |
| `npm run bundle:measure` | 고정 S3 기준 5종 상한 통과, 아래 실측값 |
| `npm run css:orphans` | zero-reference 0 |
| `npm run legacy:manifest` | 155 rules / 153 removed / 0 split / 2 active |
| `node tests/tool-registry-routes.mjs` | 20, missing/unexpected/duplicates 0 |
| `git diff --check` 및 `3747053..3152957`, `446a1e3..3152957` | 모두 exit 0, 출력 없음([원관측](diff-check.json)) |

고정 S3 대비 번들 증분은 sol 수치와 정확히 일치한다. QR에서 shared로 이동한 **509,380B**는 실제 순증가와 분리했다. shared gross +511,431B에서 이동을 뺀 net은 +2,051B다. [측정 JSON](bundle-pdf.json), [잔여 계산](budget-remaining.json).

| gzip 지표 | 고정 상한 B | 현재 누적 증분 B | U4-4 이후 남은 예산 B | 잔여 비율 |
|---|---:|---:|---:|---:|
| entry JS | 20,480 | 4,860 | **15,620** | 76.27% |
| PDF route JS | 61,440 | 13,801 | **47,639** | 77.54% |
| shared JS net | 30,720 | 2,051 | **28,669** | 93.32% |
| app JS | 81,920 | 21,152 | **60,768** | 74.18% |
| CSS | 10,240 | 118 | **10,122** | 98.85% |

`overrides={}`, `multiplier=1`. 잔여는 각 게이트의 동시 준수 한도이며 서로 더해 쓸 수 있는 독립 할당량은 아니다. 앞으로 main 동기화나 U4-4 이후 변경이 들어가면 같은 고정 기준선으로 다시 측정한다.

**실험 하네스의 두 초기 실패 — 원출력 보존**

공통 검증은 전부 첫 실행에서 통과했다. 새 호출 계측에서는 제품 실패와 다른 두 과도한 단언을 만났다. [첫 after 로그](logs/preflight-after.log)는 190ms 지정 간격의 4글자 입력을 무조건 4호출이라고 가정했으나 실제 3호출·정상 ready였다. [첫 before 로그](logs/preflight-before.log)는 25ms 지정 숫자 입력을 무조건 1호출이라고 가정했으나 실제 2호출이었다.

[초기 스크립트/JSON](harness-first-run/)을 보존하고, 최종 계측에는 실제 input 시각을 추가했다. 자유 입력은 관측값을 보고하며 입력 수 초과 호출·정상 최종값/ready 실패를 차단하고, 정확한 4회 비교는 매 검사 완료를 기다리는 별도 표본으로 고정했다. 제품 상태·기대 출력·상한·기준선·기존 테스트는 변경하지 않았다. 같은 최종 스크립트로 [before 재실행](logs/preflight-before-rerun.log)과 [after 재실행](logs/preflight-after-rerun.log)이 모두 exit 0, 각각 48개 표본이며 after의 취소 경합 6건도 통과했다. 이 두 초기 실패를 삭제하거나 제품 결함으로 판정하지 않는다.

PDF 텍스트 추가 집계의 최초 비교도 추출기가 생략하는 `/` 주변 공백을 문자 그대로 기대했다. 원자료를 보존하고 페이지별 공백을 정규화해 실제 내용 `1/2`, `2/2`가 10/10임을 확인했다. 전용/독립 생성 테스트의 성공 자체를 바꾼 것은 아니다.

**범위·불변 증명과 다음 단계**

[diff stat](diff-stat.txt)은 정확히 7파일 +168/−6: panel 1줄의 의존성 변경, ko/en 안내 각 1키, 두 스모크, 두 기록 파일이다. [보호 blob](protected-blobs.json) 294개 변경 0, [원본 불변](invariance.json)의 추적 2,588파일 변경 경로 `[]`, [검증 archive](archive-source-invariance.json)의 추적 2,588파일도 기준 SHA와 동일하다. 생성물·Office 제품 코드·시각 기준선·검증 기준을 손으로 수정하지 않았다.

이전 검수에서 보존한 원본 probe SHA 6/6 및 3차의 복사본 SHA 6/6이 현재와 일치했다([원본](prior-probe-baseline-check.json), [3차 복사본](prior-review3-copy-baseline-check.json)). 이번 검수 시작·종료의 선행 감사 probe/log/보고·JSON 등 316개 SHA도 동일하다. 이 증명 범위 밖에 과거 해시가 없는 파일까지 소급 불변이라고 주장하지 않는다. sol 31개 원로그·보관사본은 모두 SHA 일치했다. 새 실험만 `/tmp/worklazy-u4-3-review4/`에 작성했다.

기존 engine·QR·보충 engine은 내용 무수정 실행했다. 기존 focused/보충 browser의 이번 사본은 포트만 4270으로 바꿨고, 원래 경로는 `bwrap --bind / / --dev-bind /dev /dev --bind <review4> <원래 검수 경로>`로 이번 사본에 매핑했다([복사 SHA](probe-copies.json)). 독립 의존성 사본을 사용했으며 원본 `node_modules`로 쓰기 링크를 만들지 않았다. 모든 검증 서버는 종료했다.

- **main 동기화 merge:** 이번 착수 시점의 cdb4007→3152957 공통 변경은 `CHANGELOG.md`, `docs/review-notes.md`, `package.json` 3개이며, 독립 git 객체 저장소의 `merge-tree`는 기록 2개 내용 충돌·package 자동 병합을 재현했다. **실제 동기화 착수 시점에는 HEAD와 main을 다시 측정**해야 한다([병합 미리보기](merge-preview.json)).
- **U4-4 착수:** 검수상 차단 요인은 해소됐다. Claude의 U4-3 종결 판정, 예정된 Excel 선행 main 병합 및 최신 main→s3 동기화 merge·해당 검증, 정본 U4-4 디스패치 수신 후 착수 가능하다. 이번 검수에서 merge나 U4-4 구현은 하지 않았다.
- **Excel 선행 병합 영향:** root git 객체에서 확인한 열 너비 브랜치 `88fa10e`와 s3의 공통 변경은 두 기록 파일뿐이다. 기존 기록 충돌의 합칠 내용은 늘 수 있으나 현재 공통 제품 파일 추가는 없다. 실제 main 병합 결과로 재측정한다([예측 근거](excel-merge-prediction.json)). U4 전체 종료 뒤 1회 배포 계약은 유지한다.

**최종 판정: [검수 통과] — Codx**
