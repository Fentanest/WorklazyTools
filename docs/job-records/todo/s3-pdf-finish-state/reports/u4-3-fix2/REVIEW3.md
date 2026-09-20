**[수정 후 재검수] — U4-3 fix-2 재검수(3차), Codx, 2026-09-07**

2차 R1의 **같은 탭·위치 재클릭 4건**과 R2의 **끝 공백 출력명**은 수리됐다. 그러나 R1의 핵심 계약인 “유효 입력이 재검사 미예약 idle에 남지 않는다”는 **숫자 표기 변경 8건·같은 설정의 두 탭 간 전환 2건에서 여전히 실패**한다. 정상 입력인데 오류 없이 만들기 버튼이 계속 비활성이다. 이 잔여를 수리한 뒤 다시 검수해야 한다.

F1~F9의 기존 통과 표본과 공통 검증은 유지됐고, 시각 기준선 변경은 0이며 ko/en 각각 203/203 통과했다. Office의 같은 저장값 불일치도 직접 재현했으며, 소스 무변경 다음 실행은 통과했다. 독립 셀 위치 계측을 합쳐 **스모크의 입력 동기화 누락에 따른 플래키**로 판정한다. Office 저장·변환 엔진 회귀를 뒷받침하는 증거는 없었다.

| 기준 | 확인값 |
|---|---|
| 저장소 | `/home/better0101/projects/worklazytools` |
| 브랜치·대상 HEAD | `s3-pdf-finish` · `37470534a28b1bf1752a6d659820240fc3bc1b2a` |
| 2차 / 1차 / 구현 기준 | `ff0452b` / `c8bff1f` / `446a1e3` |
| main 비교 기준 | `cdb4007faea277ffc3ae9f3f7f4fe6fd8b8ba7be` — 미병합 상태 |
| 환경 | Node 22.17.1 · Chrome 152.0.7977.64 · Poppler 24.02.0 |
| 실행 | git archive 사본, `NODE_OPTIONS=--max-old-space-size=4096`, build·browser·visual 직렬, visual concurrency 1, preview 4250 및 recovery 4251 |
| 저장소 불변 | 07:39:27~08:42:54 UTC, 추적 **2,588파일 SHA 동일**, HEAD·branch·status·main 동일 |
| 검수 산출물 | `/tmp/worklazy-u4-3-review3/` |

첫 행동으로 `PROJECT_RULES.md` 전문을 읽고 AGENTS, 지정 재검수·fix-2 지시서, 자신의 1·2차 보고와 제품 결정문·재현 스크립트, fix-1의 F9 확정 4항, sol 보고·원로그, PDF finish 정본의 관련 계약과 기각 이력을 대조했다. 열린 계획 19개를 스캔했다. UI 재설계의 S3 이후 단계 경계와 병행 문서 비교·Excel 작업은 이번 읽기·검수 범위와 충돌하지 않았다. 금지된 두 작업 트리는 접근하지 않았고, 사용자 미추적 DOCX·HTML·newui 파일은 열거나 수정하지 않았다. 원본에서 추적 파일 수정·커밋·push·브랜치 전환을 하지 않았다.

**항목별 판정**

`원본`은 1차 astra probe, `보충`은 2차 astra probe다. QR·engine·보충 두 스크립트는 내용 무수정, 원본 browser/focused는 사본의 포트만 4283→4250으로 바꿨다. 경로는 `bwrap`으로 이번 archive에 매핑했다. 원본 파일은 모두 SHA 불변이며 sol 외부 드라이버를 판정 근거로 사용하지 않았다. 실행 명령·cwd·환경·exit·시간은 [commands.jsonl](commands.jsonl), 전 실행표는 [command-table.md](command-table.md), 수치 집계는 [findings.json](findings.json)에 있다. 조사 probe의 exit 0 자체를 제품 합격으로 읽지 않고 원관측값으로 판정했다.

| 항목 | 판정 | 재현 명령·출력 | 수정 지시 문안 |
|---|---|---|---|
| R1 재클릭 및 미예약 idle 불변식 | **잔여 · P2** | `node probes/edge-browser.mjs`: 원래 재클릭 **4/4 통과**, 실제 위치·크기·시작 쪽 변경 **6/6** idle→checking→ready 및 PDF 생성 2건. 숫자 표기 **8/8**, 동일 폼의 다른 탭 선택 **2/2**는 idle·비활성·alerts=[]·routeError=0. 2차 보충 원본에서도 재클릭 4건 정상. | 아래 R1 문안. raw 입력/탭 변화와 effect 재예약 조건을 일치시키고 10개 반례를 회귀로 고정. |
| R2 출력명 | **통과** | 보충 engine의 함수 16건, 전체 unit, 자체 Chrome download **14/14** + 2차 원본의 문제 이름 4/4. 끝 공백·반복 확장자·fallback·무확장자·Unicode 공백 모두 기대명. | 없음. |
| F1 시작 쪽 입력 | **통과** | 원본 browser `""`, `0`, `-1`, `1.5` routeError 0. 보충 ko/en **8/8** 필드 오류·실행 차단·파일/폼 보존·1 복귀 후 활성. | 없음. 숫자값이 같은 표기 변화의 R1 잔여와 구분. |
| F2 암호·손상 업로드 | **통과** | 원본 R2/R6 보호 4 fixture 모두 오류 표시. 보충 보호4+손상1 × 기존 파일 유/무 × ko/en **20/20**, routeError 0·정상 재업로드 성공. | 없음. |
| F3 미리보기 | **통과** | 원본 업로드 **24건**: 중앙 최대 0.0078125px, 비율 오차 최대 0.0000095733, body overflow 0. 보충 portrait/landscape×6영역×ko/en×light/dark **48/48** canvas 포함, 중앙·비율·wrapper 오차 0. | 없음. 실제 QA 캡처도 열어 확인. |
| F4 경계 밖 CropBox | **통과** | 원본 engine **24/24** 위치/upright. 보충 4회전에서 PDF.js **40픽셀**, Poppler **50픽셀**, MARK 텍스트·upright/수평 bbox 모두 확인. | 없음. UserUnit 전 렌더러 동등성으로 확대하지 않음. |
| F5 사전 안내·위치 | **기존 표본 통과 / R1 별도 잔여** | 보충 ko/en의 이모지 1행2열·제어문자 2행4열·날짜 2행3열 사전 차단. 말줄임·줄 생략·약3.8MB·알 수 없는 토큰 경고는 실행 전 표시. 좁은 영역/무효 여백 구별. 변조 font 각 1요청·현지화 오류·다운로드0. | 사전 검사 초기화의 R1 잔여 수리. |
| F6 취소 시 완료 결과 보존 | **통과** | 원본 partialOutputs 1·secondReads 0. 보충 read 전 취소 `[1,0,0]`, read 중 취소 `[1,1,0]`, 각각 첫 결과 **919B/1쪽** 재개방 성공·세 번째 read 0. | 없음. `partialResults` 공개 계약 유지. |
| F7 QR 불변 | **통과** | **`probes/qr-compare.mjs` 원본 내용 무수정**: cdb4007과 subset **661,064B**, full **3,911,538B** byte/SHA/Info/Producer/Creator/날짜 동일, 각각 Poppler 2쪽 SHA 동일. | 없음. |
| F8 영어 821px·navigation | **통과** | 원본 focused: nav client523/scroll764, 링크5개 client=scroll=148. 보충 ko/en×6폭×active/start/end **36건 실패0**, 실제 overflow·fade·직접 진입 active 가시. | 없음. 사용자가 직접 스크롤한 뒤 active가 밖으로 나가는 정상 상태와 구분. |
| F9 확정 4항 | **계약 통과 / 문구 정정 잔여** | 두 preset ko/en 4표본의 템플릿·위치·10pt/24pt/#34343a 확인. 실제 PDF opacity0.9. 출력명 R2 해소. 범위 밖 수치 8건 오류, 300자 counter·초과 시도 안내 ko/en 확인. | 전차에 덧붙인 “현재 개수 초과” 문구 부정확성은 남았다. 아래 비차단 정정 항목으로 분리. |
| 시각 기준선 | **통과** | `git diff --name-only ff0452b..3747053 -- tests/visual-baselines`: **0파일**. ko/en 각각 **203/203**, 7m18.09s/7m12.65s. 기준선 203파일 시작·종료 SHA 동일. | 없음. 정확한 픽셀 차이 0이라는 기록은 정정. |
| 범위·공통 검증 | **통과** | fix-2 정확히 **6파일 +167/−12**. 기존4모드·공용 lifecycle·Excel·Office diff0. tsc/unit301/build/static/전용·전체 스모크/a11y/CLS/bundle/CSS/registry/diff-check 최종 통과. Office의 중간 실패는 별도 보존·판정. | R1이 전용 스모크를 통과하는 구멍을 메운다. |
| Office 첫 실패→다음 통과 | **플래키 재현** | 원명령 **23회 중1회 실패**: QA16 실패의 값이 sol과 동일, QA17 소스 무변경 통과. 셀 위치를 기다린 대조 **3/3 통과**. keypress 반환 후 A1 잔류 **3/3**, 다음 관측 A2. | 제품 저장 코드를 바꾸지 말고, 스모크가 실제 A1/A2 선택과 편집 반영을 확인한 뒤 다음 조작/저장하도록 보강. |
| 기록 | **정정 필요** | sol 원로그·보관사본 **29/29 SHA 동일**. R1/R2 원인·수리 기록은 존재. 새 R1 반례, 번들 기준 오기, 시각 픽셀 표현을 구분해 정정해야 함. | 아래 기록 문안. 검수는 원본 review-notes를 수정하지 않고 이 보고서에 남김. |

**R1 · P2 — 원래 재클릭 반례는 수리됐지만, 유효 입력의 미예약 idle이 여전히 존재한다.**

[독립 재현](probes/edge-browser.mjs)은 2차 `supplement-browser.mjs`의 fixture·업로드·상태 관측 함수를 재사용한 astra 보충이다. 솔 구현자의 외부 드라이버를 사용하지 않았다. 결과는 [원관측](edge-browser.json), [중복 연속 상태만 접은 요약](edge-summary.json), [원출력](logs/browser-edges.log)에 있다.

| 조작 | ko | en | 상태·버튼 |
|---|---|---|---|
| 이미 선택된 페이지 번호 탭 재클릭 | 통과 | 통과 | ready 유지, 활성, 새 상태 전이 없음 |
| 이미 선택된 아래 가운데 위치 재클릭 | 통과 | 통과 | ready 유지, 활성, 새 상태 전이 없음 |
| 실제 위치·글자 크기·시작 쪽 변경 | 3/3 통과 | 3/3 통과 | idle → checking → ready, 이후 PDF 생성 성공 |
| 글자 크기 `10` → `10.0` | 실패 | 실패 | ready → idle, 1.5초 후에도 비활성 |
| 여백 `24` → `24.0` | 실패 | 실패 | 동일 |
| 시작 번호 `1` → `01` | 실패 | 실패 | 동일 |
| 시작 쪽 `1` → `01` | 실패 | 실패 | 동일 |
| 두 탭의 설정을 같게 만든 뒤 다른 탭 선택 | 실패 | 실패 | 동일 |

잔여 **10/10**은 alerts=[], routeError=0이며 파일과 입력값을 보존한다. 숫자 표기는 달라도 값은 10·24·1로 유효하다. 이들은 잘못된 입력이라 검사를 예약하지 않는 정상 idle과 다르다. 반면 원래 2차의 4개 재클릭 반례는 모두 사라졌고, 실제 값 변경 6건은 재검사를 거쳐 정상 생성했다.

원인 위치: `PdfFinishPanel.tsx:192`의 `updateForm`, `:202`의 `updatePreflightInput`, `:209`의 `selectTab`, `:275`부터의 preflight effect와 `:309` 의존성 목록. `Object.is`는 원시 문자열을 비교한다. `"10" !== "10.0"`이므로 preflight를 idle로 지우지만, effect는 문자열 대신 `numericInput` 결과인 `fontSize`, `margin`, `startingNumber`, `startingPage`를 의존한다. 이 숫자들과 `lowerBound`/`selection`이 모두 같아 effect가 재실행되지 않는다. 또한 `selectTab`은 실제 탭이 바뀌면 idle로 지우지만 `activeTab`은 effect 의존성에 없다. 두 탭이 같은 템플릿·위치·크기·여백·색이면 역시 재검사를 예약하지 않는다.

탭 반례의 구체 순서: 2쪽 PDF 업로드 → 머리말 탭 → 템플릿을 `{page} / {pages}`, 위치를 아래 가운데로 바꿔 검사 완료 → 페이지 번호 탭 클릭. 양 탭의 검사 입력이 같으므로 idle에 남는다. 숫자 반례는 정상 PDF 업로드·ready 확인 후 해당 필드 하나에 표의 값을 붙여넣으면 된다. 정상 입력의 재검사 지연은 120ms인데, 관측에는 ready→idle 하나만 있고 checking이 없다. 코드의 의존성 불변과 관측을 합쳐 단순 느린 검사가 아닌 미예약 상태로 판정했다.

**수정 지시 문안:** 현재의 동일 탭·위치 무시 로직은 유지한다. idle을 만드는 원시 숫자 입력 변화와 탭 변화가 effect의 재예약 조건과 일치하도록 `form.fontSize`, `form.margin`, `startNumber`, `startPage`, `activeTab`을 effect 의존성에 반영한다(또는 같은 효과의 검사 입력 동일성 정책으로 초기화와 예약을 일치시킨다). 파일 없음·유효하지 않은 입력의 정상 idle은 허용한다. ko/en에 위 10개 반례를 전용 스모크의 단언으로 추가하고, 오류 없는 유효 입력은 검사 결과 보존 또는 재검사 후 ready·실행 활성·실제 PDF 생성에 도달해야 한다. `idle` 상태만 감추거나 버튼을 강제로 활성화하지 않는다. 원래 재클릭 4건·실제 값 변경·무효→유효 복귀·취소 회귀를 유지한다.

**R2 — 해소.**

Chrome download 속성 **14/14**에서 보통 이름, `report.pdf.pdf`, `.pdf`, 확장자 없는 `report`, U+2003/U+00A0 앞뒤 공백, `"  report.pdf  "`, `" .pdf "`를 ko/en으로 확인했다. 끝 공백 report는 `report-마무리.pdf` / `report-finished.pdf`, 공백으로 둘러싼 `.pdf`는 `Worklazy-PDF-마무리.pdf` / `Worklazy-PDF-finished.pdf`다. 엔진 보충의 함수 경계값 16건 및 unit의 ko/en 기대값도 통과했다. Unicode 공백 실제 다운로드까지 포함하며 빈 basename과 확장자 1회 계약을 만족한다. [다운로드 관측](edge-summary.json), [함수 관측](supplement-engine.json).

**기록의 정정 사항 — 기능 결과와 구분.**

- `docs/review-notes.md`의 fix-2 절에는 R1·R2 원인·수리·재검증이 있고 앞선 fix-1 기록도 유지했다. 다만 6개 조합의 통과를 모든 유효 입력의 idle 불변식으로 확대할 수 없다. 위 잔여를 후속 수리 기록에 추가해야 한다.
- `review-notes`와 sol REPORT의 “기준 ff0452b3 대비” 번들 수치는 실제로 S3 고정 `/tmp/s3-bundle-baseline.json` 대비다. 이번 재실측은 entry +4,834B, PDF route +13,791B, shared net +2,062B, app +21,143B, CSS +118B로 sol JSON과 일치한다. 이전 astra ff0452b 측정값 대비 실제 변화는 순서대로 **−3/+38/−4/+34/0B**다. 상한 위반은 없지만 기준 표기를 정정해야 한다. [기록 대조](records-audit.json).
- 시각 로그는 per-pixel threshold 0.1, 다른 픽셀 비율 ≤0.1%, AA 무시의 통과를 기록한다. 성공 표본의 정확한 diffPixels는 로그에 없으므로 “변경 픽셀 0”은 이 근거로 단정할 수 없다. **기준선 파일 변경 0**과 **203/203 회귀 통과**로 기록하는 것이 정확하다.
- 2차 보고에서 덧붙였던 300자 초과 시도 문안은 여전히 현재 count가 초과했다고 설명한다(`src/locales/ko/features.json:964`, `en` 동형). native 제한·카운터·초과 안내라는 F9의 최소 4항 계약은 유지됐지만, 300/300 상태에서의 문구 정확성은 미해소다. fix-2 dispatch의 R2는 출력명으로 범위를 한정했고 locale 수정은 요구하지 않았으므로, 이를 sol의 새 범위 위반이나 새로운 주요 결함으로 확대하지 않는다. 후속 문안은 “입력한 내용이 300자 한도를 넘어 일부만 반영되었습니다”처럼 입력 시도를 설명하도록 정정한다.

**Office — 원문과 같은 불일치 및 소스 무변경 재실행 통과를 확인했다.**

원명령은 모두 `TEST_BASE_URL=http://127.0.0.1:4250 npm run test:office`이며 매번 새 Chrome과 임시 DOCX/XLSX fixture를 쓴다. production 6회는 6회 통과했다. QA 빌드에서는 추가 16번째 호출이 다음처럼 실패했고, **바로 다음 17번째 동일 명령이 통과**했다. 테스트 원문의 SHA는 대상 커밋과 동일한 `19fb8ee3…543b15`다. 즉 테스트·기대값·제품 소스를 고쳐 재실행한 것이 아니다.

```text
QA run 16: exit 1
Calc did not preserve Korean text and keyboard cell editing:
["Arrow navigation verified","이동 전"]

QA run 17: exit 0
Office editor smoke passed: 96 download states, 7 cached states,
Korean Calc keyboard edit and 5089 saved DOCX bytes.
```

[실패 원출력](logs/office-qa-repeat-16.log), [바로 다음 통과](logs/office-qa-repeat-17.log), [반복 실행 기록](office-qa-repeats.json), [집계·소스 SHA](office-summary.json).

원명령 관측률은 **production 0/6, QA 1/17, 합계 1/23 ≈4.35%**다. 이는 이번 환경·표본의 관측값이며 고정 발생률을 뜻하지 않는다. “첫 실행”에만 발생하는 결정적 fixture 오류도 아니다.

원인 교차 실험은 [독립 Office probe](repo/tests/office-review-probe.mjs)로 했다. 기존 스모크의 fixture 생성·키 순서·한글 보존·저장 결과 단언을 유지하면서, 실제 Office 문서 controller의 선택 범위와 A1/A2 값을 읽는 계측 및 조건 대기만 추가했다. DOM의 파일명/활성 표시를 셀 이동 완료로 간주하지 않았다. 문서·선택을 강제로 고치는 코드는 없다. [원문 대비 diff](office-probe.diff), [대조1](office-observed-1/samples.json), [대조2](office-observed-2/samples.json), [대조3](office-observed-3/samples.json).

- `await Ctrl+Home` 직후 **2/3**은 여전히 G14(row13,col6), 다음 관측에서 A1이었다.
- `await ArrowDown` 직후 **3/3**은 여전히 A1(row0,col0), 25ms 간격의 다음 관측에서 A2(row1,col0)였다.
- 실제 A2 선택을 확인한 뒤 타이핑·Enter를 하고 편집 반영을 확인하면 **3/3** 모두 A1=`한글 셀 표시 확인`, A2=`Arrow navigation verified`를 메모리와 저장 파일에서 보존했다. 저장된 XLSX도 각 대조 디렉터리에 남겼다.

따라서 키 입력 API의 완료와 Office의 셀 이동 완료 사이에 시간차가 존재한다. 기존 `office-editor-smoke.mjs:130`~`:144`는 Ctrl+Home→ArrowDown→타이핑→저장을 선택 상태 확인 없이 잇는다. 실패의 두 값도 fixture 생성/직렬화 파손 형태가 아니라 **A2 대신 A1에 편집한 결과**와 일치한다. 원증상의 간헐 재현·즉시 재실행 통과·독립 선택 계측·조건 대기의 보존 결과를 합쳐 **입력 동기화가 없는 스모크의 플래키**로 판정했다. Office 저장·변환 엔진 결함이나 U4-3의 Office 회귀로 확대하지 않는다. 이 판정은 Office의 모든 입력 경계를 무결하다고 보증하는 것은 아니다.

후속 하네스 문안: 고정 sleep이나 기대값 완화로 덮지 말고 Ctrl+Home 후 A1, ArrowDown 후 A2, Enter 후 A2 내용 반영을 확인한 뒤 다음 조작·저장을 실행한다. 기존 한글 보존 단언은 유지한다. 이번 검수에서는 추적 테스트나 제품 코드를 수정하지 않았다.

**공통 검증의 실제 실행 결과**

모든 실행의 상세 환경·명령·실패 원문을 보존했다. Office 반복과 아래 환경 설정 실패까지 포함한 [전 실행표](command-table.md), [commands.jsonl](commands.jsonl), [원로그](logs/).

| 명령·범위 | 결과 |
|---|---|
| `./node_modules/.bin/tsc -b` | exit0, 진단0 — 저장소 설치 compiler 직접 실행 |
| `npm run test:unit` | **301/301**, fail0·skip0 |
| `npm run build` · `npm run test:static` | **2,845 modules**, 정적 **67페이지**, startup recovery **113**, 통과 |
| `npm run test:pdf-finish` | 12 직접 진입, 보호/손상·입력 복귀·사전 안내·재클릭/변경6·출력명4·preview48·경계4회전·취소/재시도 통과 |
| `TEST_SCOPE=pdf npm run test:browser` · 전체 `test:browser` | 통과 |
| `test:new-tools` · `test:utilities` | 통과; 기존 Dolby Vision host capability skip 및 결정적 fallback 경로 유지 |
| `test:office` | 최종 통과, 중간 플래키 1/23은 위와 같이 보존·판정 |
| `test:excel-cleaner` · `test:excel-compare` | 통과 |
| `test:qr-bulk` · `test:qr-font-render` | 통과; subset/full/corrupt/font404, render 3fixture changed pixels0 |
| `test:recovery` | **147 cases** 통과 |
| `fixtures:pdf-legacy-oracle` | client3·structure4·render32·output4·input1, **totalDiffs0** |
| `LANG=ko_KR.UTF-8 npm run test:visual` | **203/203**, 하네스7m18.09s |
| `LANG=en_US.UTF-8 npm run test:visual` | **203/203**, 하네스7m12.65s — 합계14m30.74s<20분; shell 합계도14m32.688s |
| `VITE_LOCAL_QA=1 npm run build` | exit0, 2,845 modules·67페이지 |
| `A11Y_MAX_TOTAL=0 npm run test:a11y` | 11페이지 violations0·외부요청0. 자체 업로드 상태 4표본도 axe0 |
| `npm run test:rendering` | 6대상×3회, 외부요청0. finish 세 route 최대 CLS 각각 **0.0001480365514755249** <0.1 |
| `BUNDLE_BASELINE=/tmp/s3-bundle-baseline.json BUNDLE_ROUTES=pdf-editor npm run bundle:measure` | 5종 상한 통과; override `{}`·multiplier1 |
| `npm run css:orphans` · `npm run legacy:manifest` | orphan0; 155rules/153removed/0split/2active |
| `node tests/tool-registry-routes.mjs` | 20, missing/unexpected/duplicates 모두[] |
| `git diff --check` 및 `ff0452b..3747053`, `446a1e3..3747053` | 모두 exit0, 출력 없음 |

고정 baseline SHA-256=`2605437e04a5d77ed41c2dbfac4fae864a6a9c8b5e56941e696a80b7f76ac692`. [이번 번들 JSON](bundle-pdf.json)에서 entry/PDF route/shared net/app/CSS 증분은 **4,834/13,791/2,062/21,143/118B**, 상한은 **20,480/61,440/30,720/81,920/10,240B**다. QR→shared 이동 **509,380B**는 순증분과 분리했다.

**재현 방법·실행 중 예외의 범위**

보존된 `repo/dist`는 QA 빌드다. 원본 probe의 하드코딩 경로를 이번 사본으로 매핑해 실행하며, QR 비교의 `main/`은 cdb4007 archive다. 다음 preview를 별도 프로세스에서 실행한 뒤 browser 명령을 실행한다. 모든 브라우저·빌드 명령은 직렬로 실행한다.

```bash
cd /tmp/worklazy-u4-3-review3/repo
export NODE_OPTIONS=--max-old-space-size=4096
export TMPDIR=/tmp/worklazy-u4-3-review3/tmp
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4250 --strictPort
```

```bash
cd /tmp/worklazy-u4-3-review3/repo
export NODE_OPTIONS=--max-old-space-size=4096
node /tmp/worklazy-u4-3-review3/probes/edge-browser.mjs
bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review3 /tmp/worklazy-u4-3-review2 --chdir /tmp/worklazy-u4-3-review2/repo node /tmp/worklazy-u4-3-review2/probes/supplement-browser.mjs
bwrap --bind / / --dev-bind /dev /dev --bind /tmp/worklazy-u4-3-review3 /tmp/worklazy-u4-3-review --chdir /tmp/worklazy-u4-3-review/repo node --experimental-strip-types /tmp/worklazy-u4-3-review/probes/qr-compare.mjs
TEST_BASE_URL=http://127.0.0.1:4250 npm run test:office
```

초기 bwrap 환경에서 독립 engine/QR/보충 engine 및 원본 browser/focused/보충 browser가 `EACCES`로 중단됐다. 원인은 root 경로 매핑 때 `/dev`를 별도로 유지하지 않아 child stdio의 `ignore` 처리가 실패한 것이다. 같은 `pdftoppm -v`도 해당 환경에서 `stdio=ignore`면 실패하고 inherit면 통과했으며, `--dev-bind /dev /dev` 추가로 동일 명령이 통과했다. **제품·probe 원문·검증 상한을 고치지 않고 환경만 보정한 뒤 6개를 모두 재실행**했다. [환경 원인](bwrap-environment.json), [실패/재실행 로그](logs/).

원본 1차 browser의 4개 조사 항목은 별도로 `probeError` 타임아웃이 남는다. 이모지·제어문자·날짜 오류는 “만들기 클릭 이후 오류”를 기다리던 코드인데 수리 후에는 사전 차단되며, 변조 글꼴도 이미 비활성인 만들기 클릭을 기다린다. 원본을 수정해 통과시키지 않았다. 해당 상태는 사전 검사를 기다리는 2차 보충 원본으로 직접 재검증해 필드 위치·차단·현지화·다운로드0을 확인했다. 이 네 타임아웃을 제품 회귀나 통과한 생성 호출로 세지 않았다. [원래 probeError](findings.json), [보충 원관측](supplement-browser.json).

실험 준비의 한 가지 이탈을 공개한다. 최초 tsc/build 착수 시 의존성을 원본 `node_modules`로 링크해 **ignored `node_modules/.tmp`의 TypeScript 증분 캐시**가 원본 쪽에 기록됐다. 이를 확인한 뒤 의존성을 `/tmp/worklazy-u4-3-review3/node_modules`의 독립 사본으로 바꾸었으며 후속 출력은 이번 `/tmp` 안에 생성했다. **추적 파일 수정은 없었고** 원본 추적 SHA 2,588개가 같음을 확인했다. “저장소의 모든 비추적 파일까지 무변경”이라고 주장하지 않는다. [의존성 격리 기록](dependency-isolation.json).

PDF.js standardFontDataUrl·Poppler OTF·vm-browserify eval 및 큰 청크 경고는 원출력에 보존했다. 렌더러 실제 픽셀·텍스트/QR oracle과 예산 검증을 대신 면제하지 않았다. QA의 외부 요청은0이었다. 직접 연 대표 QA 이미지는 [육안 확인 목록](visual-review.json), DOM 실측은 [visual-metrics.json](visual-metrics.json), [focused-visual.json](focused-visual.json), [supplement-browser.json](supplement-browser.json)에 있다.

**범위·불변 증명·종결 조건**

`git diff --stat ff0452b..3747053`은 **6파일 +167/−12**다: panel, outputName, 전용 browser smoke, engine unit, CHANGELOG, review-notes. 시각 기준선·locale·SEO·정적 페이지 입력·광고 격리·의존성 변화는 이번 fix-2에 없다. 실제 존재하는 기존4모드 패널·worker/client·공용 lifecycle·cooperativeCancel·Excel·legacy oracle 경로를 구현 기준446a1e3부터 대조해 diff0을 확인했다. fix-2에서 preview/thumbnail·engine·QR·공용 font helper도 diff0이다. unit의 광고·격리 계약과 static 검증을 다시 실행했다. [범위](scope.json), [fix-2 전체 diff](fix2.diff), [diff-check](diff-check.json).

main(cdb4007)과 대상 브랜치의 merge-base는 **5bc6854**이며 공통 변경 파일은 **CHANGELOG.md·docs/review-notes.md·package.json** 3개다. archive의 독립 `.git`에서 `git merge-tree --write-tree 3747053 cdb4007`로만 미리 계산했으며, **두 기록 파일은 내용 충돌, package.json은 자동 병합**이었다. 실제 워킹트리 병합·커밋은 하지 않았다. [병합 미리보기](merge-preview.json).

원본 시작·종료 status에는 같은 사용자 미추적 4항목만 있다: after.docx, before.docx, 네이버 확인 HTML, newui/. **추적2,588파일 변경 경로[]**, HEAD·branch·status·main 동일, 원본 재현 스크립트6개 SHA 동일, 시각 기준선203파일 SHA 동일이다. [시작](start.json), [종료](end.json), [불변 증명](invariance.json), [시작 SHA](tracked-sha-start.json), [종료 SHA](tracked-sha-end.json). 검수 preview는 종료했다.

**다음 단계 한 줄:** U4-3은 **R1 잔여10건 수리·회귀 및 기록 정정 후 astra 재검수→Claude 게이트 통과**로 종결하며 **현재 U4-4 착수 불가**; 통과 후 다음 단계 전 main(cdb4007)→s3 동기화를 별도 merge로 처리하고(공통3파일, 기록2개 충돌), **s3→main 병합·배포는 U4 전체 종료 때 1회**라는 정본을 유지한다.

**최종 판정: [수정 후 재검수] — Codx**
